import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type BannedUser = {
  discord_id: string;
  reason: string | null;
  banned_by: string;
  banned_at: string;
};

/**
 * Dipakai oleh proxy.ts (Next.js "proxy", pengganti middleware, jalan
 * di Node.js runtime) untuk cek status ban di SETIAP navigasi halaman
 * -- bukan cuma saat login -- supaya user yang lagi login lalu diban
 * admin langsung ke-block di request berikutnya, tanpa perlu menunggu
 * token/sesi lama habis.
 *
 * PENTING: proxy.ts hanya melindungi navigasi HALAMAN. Server Actions
 * (mis. addProductToCart, checkoutCart, startCheckout) adalah endpoint
 * POST tersendiri yang bisa dipanggil langsung tanpa lewat proxy kalau
 * matcher proxy mengecualikan path-nya -- jadi fungsi ini JUGA dipanggil
 * ulang di dalam server action-server action yang membuat/mengubah
 * order (lihat requireNotBanned di bawah), bukan cuma di proxy.
 *
 * Query sengaja seringan mungkin (select 1 kolom, maybeSingle) karena
 * ini jalan di setiap navigasi halaman & setiap pemanggilan action.
 */
export async function isDiscordIdBanned(discordId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("banned_discord_users")
    .select("discord_id")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error) {
    // Kalau query moderasi gagal (mis. Supabase down sesaat), jangan
    // ikut memblokir SEMUA user yang lagi login -- fail-open di sisi
    // ban-check ini spesifik supaya outage infrastruktur tidak jadi
    // insiden akses buat seluruh toko. isAdmin() tetap jalan terpisah
    // sebagai lapisan proteksi admin.
    console.error("Gagal cek status ban:", error.message);
    return false;
  }

  return Boolean(data);
}

/**
 * Guard untuk dipanggil di awal Server Action yang membuat/mengubah
 * data (checkout, tambah ke keranjang, dst) -- proxy.ts TIDAK cukup
 * untuk ini karena Server Action adalah endpoint POST tersendiri yang
 * bisa dipanggil langsung tanpa lewat halaman. Mengembalikan string
 * pesan error kalau akun ini diban (siap dipakai sebagai
 * `{ error: ... }` di action-nya), atau null kalau tidak diban.
 */
export async function requireNotBanned(
  discordId: string
): Promise<string | null> {
  const banned = await isDiscordIdBanned(discordId);
  if (banned) {
    return "Akun Discord kamu sudah diban dari toko ini.";
  }
  return null;
}

/**
 * Ban satu akun Discord: mereka langsung tidak bisa akses halaman apa
 * pun lagi (proxy.ts redirect ke /banned) dan sesi mereka yang sedang
 * aktif dipaksa logout dari sana. HARUS dipanggil dari server action
 * yang sudah memverifikasi isAdmin() -- fungsi ini sendiri tidak cek
 * admin supaya logikanya cuma ditulis sekali di pemanggilnya.
 */
export async function banDiscordUser(
  discordId: string,
  reason: string | null,
  bannedByDiscordId: string
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.from("banned_discord_users").upsert({
    discord_id: discordId,
    reason,
    banned_by: bannedByDiscordId,
  });

  if (error) {
    return { error: `Gagal mem-ban akun: ${error.message}` };
  }
  return {};
}

export async function unbanDiscordUser(
  discordId: string
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("banned_discord_users")
    .delete()
    .eq("discord_id", discordId);

  if (error) {
    return { error: `Gagal membatalkan ban: ${error.message}` };
  }
  return {};
}

export async function listBannedUsers(): Promise<BannedUser[]> {
  const { data, error } = await supabaseAdmin
    .from("banned_discord_users")
    .select("*")
    .order("banned_at", { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat daftar ban: ${error.message}`);
  }
  return (data ?? []) as BannedUser[];
}

export type ModerationOrder = {
  id: string;
  product_id: string;
  product_name: string | null;
  buyer_discord_id: string;
  price_idr: number;
  status: "pending" | "paid" | "expired" | "failed" | "revoked";
  paid_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
};

/**
 * Cari order untuk kebutuhan moderasi (revoke/unrevoke) -- ShopManager
 * tidak punya tabel `users` terpusat atau UI pencarian nama Discord,
 * jadi admin cari lewat Discord ID pembeli (bisa dilihat dari log
 * webhook pembelian) atau ID order itu sendiri (mis. dari keluhan
 * pembeli). Sengaja dibatasi 25 hasil terbaru per pencarian -- cukup
 * untuk kebutuhan moderasi manual, bukan laporan penjualan.
 */
export async function searchOrdersForModeration(
  query: string
): Promise<ModerationOrder[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const isUuidLike = /^[0-9a-f-]{8,36}$/i.test(trimmed);

  let request = supabaseAdmin
    .from("orders")
    .select(
      "id, product_id, buyer_discord_id, price_idr, status, paid_at, revoked_at, revoked_reason, products(name)"
    )
    .order("created_at", { ascending: false })
    .limit(25);

  request = isUuidLike
    ? request.or(`id.eq.${trimmed},buyer_discord_id.eq.${trimmed}`)
    : request.eq("buyer_discord_id", trimmed);

  const { data, error } = await request;

  if (error) {
    throw new Error(`Gagal mencari order: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const productRelation = (
      row as unknown as { products: { name: string } | null }
    ).products;
    return {
      id: row.id,
      product_id: row.product_id,
      product_name: productRelation?.name ?? null,
      buyer_discord_id: row.buyer_discord_id,
      price_idr: row.price_idr,
      status: row.status,
      paid_at: row.paid_at,
      revoked_at: row.revoked_at,
      revoked_reason: row.revoked_reason,
    };
  });
}

/**
 * Cabut (revoke) satu order yang sudah 'paid' -- dipakai untuk "tarik
 * lagi" produk yang sudah dibeli. Order TIDAK dihapus (riwayat & bukti
 * transaksi tetap ada), cuma status berubah jadi 'revoked' sehingga:
 * - Halaman /orders/[id] menampilkan order ini sebagai dicabut, bukan
 *   lagi menawarkan tombol buka file.
 * - whitelist_entries terkait ikut dihapus supaya akses Roblox (kalau
 *   ada) juga ikut tercabut.
 *
 * Hanya order berstatus 'paid' yang boleh di-revoke -- order pending/
 * expired/failed tidak relevan untuk dicabut, dan order yang sudah
 * revoked tidak perlu diproses ulang.
 */
export async function revokeOrder(
  orderId: string,
  reason: string | null,
  revokedByDiscordId: string
): Promise<{ error?: string }> {
  const { data: order, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    return { error: `Gagal memuat order: ${fetchError.message}` };
  }
  if (!order) {
    return { error: "Order tidak ditemukan." };
  }
  if (order.status !== "paid") {
    return { error: "Hanya order yang sudah lunas yang bisa dicabut." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
      revoked_by: revokedByDiscordId,
    })
    .eq("id", orderId)
    .eq("status", "paid"); // guard dari race/klik ganda

  if (updateError) {
    return { error: `Gagal mencabut order: ${updateError.message}` };
  }

  // Hapus whitelist_entries terkait supaya akses Roblox (kalau produk
  // ini grants_whitelist) ikut tercabut, bukan cuma status order-nya.
  const { error: whitelistError } = await supabaseAdmin
    .from("whitelist_entries")
    .delete()
    .eq("order_id", orderId);

  if (whitelistError) {
    // Order sudah terlanjur revoked -- laporkan tapi jangan gagalkan
    // seluruh operasi, karena bagian utama (order revoked) berhasil.
    return {
      error: `Order dicabut, tapi gagal menghapus akses whitelist: ${whitelistError.message}`,
    };
  }

  return {};
}

/**
 * Batalkan revoke: kembalikan order jadi 'paid' seperti semula. Tidak
 * mengembalikan whitelist_entries yang sudah terhapus secara otomatis
 * -- itu akan dibuat ulang sendiri lewat ensureWhitelistForOwnedOrder
 * saat pembeli membuka halaman order-nya lagi (kalau syaratnya masih
 * terpenuhi, sama seperti alur order lama yang belum sempat dapat
 * whitelist).
 */
export async function unrevokeOrder(
  orderId: string
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      revoked_at: null,
      revoked_reason: null,
      revoked_by: null,
    })
    .eq("id", orderId)
    .eq("status", "revoked");

  if (error) {
    return { error: `Gagal membatalkan pencabutan: ${error.message}` };
  }
  return {};
}
