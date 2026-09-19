import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createDeposit, getDepositStatus } from "@/lib/ramashop";
import { logPurchaseToDiscord } from "@/lib/purchase-log";

// Produk di bawah harga ini dianggap gratis -- tidak perlu QRIS sama
// sekali, order langsung dibuat berstatus "paid" (lihat createOrder).
const FREE_PRICE_THRESHOLD_IDR = 100;

export type Order = {
  id: string;
  product_id: string;
  buyer_discord_id: string;
  price_idr: number;
  deposit_id: string;
  total_amount: number;
  qr_image: string | null;
  qr_string: string | null;
  expired_at: string;
  status: "pending" | "paid" | "expired" | "failed" | "revoked";
  download_url: string | null;
  created_at: string;
  paid_at: string | null;
  form_responses: Record<string, string> | null;
  // Ditambahkan untuk fitur keranjang/voucher (lihat lib/order-groups.ts).
  // Order lama (sebelum fitur ini ada) punya order_group_id = null dan
  // discount_idr = 0 -- tetap tampil & berfungsi seperti sebelumnya.
  order_group_id: string | null;
  discount_idr: number;
  // Diisi lewat fitur moderasi (lihat lib/moderation.ts::revokeOrder)
  // saat admin mencabut akses pembeli ke produk yang sudah dibeli.
  // null untuk order yang belum pernah dicabut.
  revoked_at: string | null;
  revoked_reason: string | null;
  revoked_by: string | null;
};

/**
 * Buat order baru untuk satu produk: ambil harga produk langsung dari
 * DB (jangan pernah percaya harga dari client), buat deposit QRIS di
 * Rama Shop, lalu simpan sebagai baris `orders` berstatus pending.
 *
 * Aturan pembelian ulang (lihat product-card / actions untuk
 * penegakan penuh):
 * - Produk stok terbatas (stock bukan null): boleh dibeli berkali-kali,
 *   tiap klik "Beli" = order baru.
 * - Produk unlimited (stock null): kalau buyer sudah pernah punya order
 *   `paid` untuk produk ini, JANGAN buat order baru -- arahkan ke order
 *   lama itu saja (tombol berubah jadi "Buka file" di UI).
 *
 * formResponses: WAJIB diisi kalau produk delivery_type='form' (lihat
 * validasi di bawah, mengulang aturan form_schema di server -- jangan
 * cuma percaya validasi required di client). Untuk delivery_type lain
 * diabaikan (biarpun dikirim, tetap tidak disimpan) karena hanya
 * relevan untuk form.
 *
 * buyerUsername: nama Discord pembeli (session.user.name), dipakai
 * hanya untuk log webhook -- tidak disimpan ke tabel orders.
 *
 * Produk dengan price_idr < Rp100 dianggap gratis: order dibuat
 * langsung berstatus "paid" (skip pembuatan deposit QRIS sama sekali),
 * supaya alur beli langsung ke halaman order yang sudah "selesai"
 * alih-alih ke halaman pembayaran.
 */
export async function createOrder(
  productId: string,
  buyerDiscordId: string,
  buyerUsername: string,
  formResponses?: Record<string, string>
): Promise<{ order?: Order; error?: string }> {
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select(
      "id, name, price_idr, stock, is_active, delivery_type, form_schema, download_url, grants_whitelist"
    )
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    return { error: `Gagal memuat produk: ${productError.message}` };
  }
  if (!product || !product.is_active) {
    return { error: "Produk tidak ditemukan atau sudah tidak dijual." };
  }
  if (product.stock !== null && product.stock <= 0) {
    return { error: "Stok produk sudah habis." };
  }

  // Produk unlimited: cegah beli ulang kalau sudah pernah lunas.
  if (product.stock === null) {
    const existing = await getPaidOrderForProduct(productId, buyerDiscordId);
    if (existing) {
      return { error: "Kamu sudah membeli produk ini sebelumnya." };
    }
  }

  let formResponsesToStore: Record<string, string> | null = null;
  if (product.delivery_type === "form") {
    const schema = (product.form_schema ?? []) as {
      label: string;
      required: boolean;
    }[];

    // Jangan cuma percaya `required` yang divalidasi di client --
    // tolak lagi di sini kalau ada pertanyaan wajib yang kosong.
    for (const field of schema) {
      const answer = formResponses?.[field.label]?.trim();
      if (field.required && !answer) {
        return { error: `Pertanyaan "${field.label}" wajib diisi.` };
      }
    }

    // Simpan hanya jawaban untuk pertanyaan yang memang ada di schema
    // saat ini -- kalau admin sempat ganti pertanyaan sebelum submit,
    // jangan simpan jawaban untuk pertanyaan yang sudah tidak berlaku.
    formResponsesToStore = {};
    for (const field of schema) {
      const answer = formResponses?.[field.label]?.trim();
      if (answer) {
        formResponsesToStore[field.label] = answer;
      }
    }
  }

  const isFree = product.price_idr < FREE_PRICE_THRESHOLD_IDR;

  let order: Order;

  if (isFree) {
    // Gratis: tidak ada deposit QRIS sama sekali -- deposit_id di
    // schema NOT NULL + unique, jadi diisi placeholder unik per order
    // (bukan dipakai untuk apa pun, tidak pernah di-poll ke Rama Shop
    // karena syncOrderStatus() no-op untuk order yang bukan "pending").
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        product_id: product.id,
        buyer_discord_id: buyerDiscordId,
        price_idr: product.price_idr,
        deposit_id: `free-${crypto.randomUUID()}`,
        total_amount: 0,
        qr_image: null,
        qr_string: null,
        expired_at: new Date().toISOString(),
        status: "paid",
        paid_at: new Date().toISOString(),
        download_url: product.download_url,
        form_responses: formResponsesToStore,
      })
      .select()
      .single();

    if (insertError) {
      return { error: `Gagal menyimpan order: ${insertError.message}` };
    }
    order = inserted as Order;

    // Kurangi stok & proses whitelist sama seperti order berbayar yang
    // baru lunas (lihat markOrderPaid) -- produk gratis tetap ikut
    // aturan stok/whitelist yang sama, cuma skip tahap pembayarannya.
    if (product.stock !== null) {
      await supabaseAdmin
        .from("products")
        .update({ stock: Math.max(0, product.stock - 1) })
        .eq("id", product.id);
    }
    if (product.grants_whitelist) {
      await grantWhitelistIfEligible(order);
    }
  } else {
    let deposit;
    try {
      deposit = await createDeposit(product.price_idr);
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Gagal membuat pembayaran QRIS, coba lagi.",
      };
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        product_id: product.id,
        buyer_discord_id: buyerDiscordId,
        price_idr: product.price_idr,
        deposit_id: deposit.depositId,
        total_amount: deposit.totalAmount,
        qr_image: deposit.qrImage,
        qr_string: deposit.qrString,
        expired_at: deposit.expiredAt,
        status: "pending",
        form_responses: formResponsesToStore,
      })
      .select()
      .single();

    if (insertError) {
      return { error: `Gagal menyimpan order: ${insertError.message}` };
    }
    order = inserted as Order;
  }

  // Log ke webhook Discord untuk SEMUA pembelian (gratis maupun yang
  // masih menunggu pembayaran) -- supaya order form/adminprocessed
  // bisa langsung diproses admin dari log ini.
  await logPurchaseToDiscord({
    buyerUsername,
    buyerDiscordId,
    productName: product.name,
    deliveryType: product.delivery_type,
    formResponses: formResponsesToStore,
  });

  return { order };
}

/**
 * Ambil satu order milik buyer tertentu. Selalu filter
 * buyer_discord_id di query -- ini satu-satunya lapisan proteksi yang
 * mencegah user A melihat/mengambil link download order user B lewat
 * tebak ID order (tidak ada RLS policy publik di tabel orders).
 */
export async function getOwnedOrder(
  orderId: string,
  buyerDiscordId: string
): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("buyer_discord_id", buyerDiscordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat order: ${error.message}`);
  }
  return data as Order | null;
}

async function getPaidOrderForProduct(
  productId: string,
  buyerDiscordId: string
): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("product_id", productId)
    .eq("buyer_discord_id", buyerDiscordId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat riwayat order: ${error.message}`);
  }
  return data as Order | null;
}

/**
 * Sinkronkan status order pending dengan Rama Shop lewat polling, lalu
 * terapkan efek sampingnya (copy download_url, kurangi stok) begitu
 * order jadi paid. Dipanggil berulang oleh halaman order (client
 * polling ke route handler yang memanggil fungsi ini) -- bukan lewat
 * webhook, karena Rama Shop tidak menyediakannya.
 *
 * Idempoten: kalau order sudah bukan pending, langsung dikembalikan
 * apa adanya tanpa hit Rama Shop lagi.
 */
export async function syncOrderStatus(order: Order): Promise<Order> {
  if (order.status !== "pending") {
    return order;
  }

  const depositStatus = await getDepositStatus(order.deposit_id);

  if (depositStatus.status === "pending") {
    return order;
  }

  if (depositStatus.status === "expired") {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({ status: "expired" })
      .eq("id", order.id)
      .eq("status", "pending") // guard dari race polling ganda
      .select()
      .single();

    if (error) throw new Error(`Gagal update order: ${error.message}`);
    return (data as Order) ?? order;
  }

  // "success" atau "already" -- keduanya berarti sudah lunas.
  return markOrderPaid(order);
}

async function markOrderPaid(order: Order): Promise<Order> {
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("download_url, stock, grants_whitelist")
    .eq("id", order.product_id)
    .single();

  if (productError) {
    throw new Error(`Gagal memuat produk untuk order: ${productError.message}`);
  }

  // eq("status", "pending") sebagai guard: kalau dua polling request
  // nyaris bersamaan lolos pengecekan status pending di atas, hanya
  // satu yang berhasil melakukan update ini (yang lain dapat 0 row
  // affected dan .single() akan error -- ditangani dengan fallback
  // baca ulang order di bawah).
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      download_url: product.download_url,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal update order: ${error.message}`);
  }

  if (!data) {
    // Sudah diproses oleh request polling lain barusan -- baca ulang.
    const { data: refetched, error: refetchError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", order.id)
      .single();
    if (refetchError) {
      throw new Error(`Gagal memuat ulang order: ${refetchError.message}`);
    }
    return refetched as Order;
  }

  // Kurangi stok kalau bukan unlimited. Dilakukan setelah update order
  // berhasil (bukan sebelumnya) supaya guard status=pending di atas
  // tetap jadi satu-satunya titik "hanya sekali dieksekusi".
  if (product.stock !== null) {
    await supabaseAdmin
      .from("products")
      .update({ stock: Math.max(0, product.stock - 1) })
      .eq("id", order.product_id);
  }

  // Kalau produk ini memberi whitelist Roblox, catat entry-nya sekarang
  // (bukan lagi di titik lain) -- ini masih dalam "hanya sekali
  // dieksekusi" yang sama karena hanya request yang berhasil melakukan
  // update status di atas yang sampai ke sini.
  if (product.grants_whitelist) {
    await grantWhitelistIfEligible(data as Order);
  }

  return data as Order;
}

/**
 * Buat baris whitelist_entries untuk order yang baru lunas, kalau
 * buyer sudah mengisi Roblox User ID mereka di halaman profil. Kalau
 * belum diisi, tidak ada entry dibuat -- akun Roblox mereka bisa
 * ditautkan belakangan lewat halaman order/riwayat pembelian, yang
 * akan memicu ulang pembuatan whitelist saat itu (lihat
 * `ensureWhitelistForOwnedOrder` di lib ini).
 *
 * order_id di-unique-kan di skema supaya fungsi ini aman dipanggil
 * ulang (insert kedua untuk order yang sama akan gagal karena
 * constraint, diabaikan dengan upsert onConflict).
 */
async function grantWhitelistIfEligible(order: Order): Promise<void> {
  const { data: link } = await supabaseAdmin
    .from("user_roblox_links")
    .select("roblox_user_id")
    .eq("discord_id", order.buyer_discord_id)
    .maybeSingle();

  if (!link) {
    return;
  }

  await supabaseAdmin.from("whitelist_entries").upsert(
    {
      order_id: order.id,
      product_id: order.product_id,
      buyer_discord_id: order.buyer_discord_id,
      roblox_user_id: link.roblox_user_id,
    },
    { onConflict: "order_id" }
  );
}

/**
 * Dipanggil dari halaman order/riwayat pembelian: kalau order ini
 * untuk produk yang grants_whitelist dan buyer BELUM punya whitelist
 * entry untuk order ini (misal saat pembayaran lunas dia belum isi
 * Roblox ID), coba buat sekarang. Aman dipanggil berkali-kali (no-op
 * kalau entry sudah ada atau syarat belum terpenuhi).
 */
export async function ensureWhitelistForOwnedOrder(order: Order): Promise<void> {
  if (order.status !== "paid") {
    return;
  }

  const { data: product, error } = await supabaseAdmin
    .from("products")
    .select("grants_whitelist")
    .eq("id", order.product_id)
    .maybeSingle();

  if (error || !product?.grants_whitelist) {
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("whitelist_entries")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existing) {
    return;
  }

  await grantWhitelistIfEligible(order);
}
