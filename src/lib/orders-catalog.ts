import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Ambil id order (bukan cuma product_id) untuk semua produk unlimited
 * yang sudah dibayar lunas oleh buyer ini. Dipakai di shop page supaya
 * ProductCard tahu kapan harus menampilkan "Buka File" (dan tautan ke
 * order mana) alih-alih "Beli".
 *
 * Sengaja tidak menyertakan produk stok terbatas -- itu boleh dibeli
 * berkali-kali, jadi tidak relevan untuk logika "sudah pernah beli".
 */
export async function getPaidOrderMapForBuyer(
  buyerDiscordId: string
): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, product_id, created_at")
    .eq("buyer_discord_id", buyerDiscordId)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat riwayat pembelian: ${error.message}`);
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    // Baris pertama per product_id (sudah diurutkan terbaru dulu) yang
    // dipakai -- cukup satu order id representatif untuk link "Buka File".
    if (!(row.product_id in map)) {
      map[row.product_id] = row.id;
    }
  }
  return map;
}

export type PurchasedOrder = {
  id: string;
  product_id: string;
  product_name: string | null;
  price_idr: number;
  download_url: string | null;
  paid_at: string | null;
};

/**
 * Ambil SEMUA order lunas milik buyer (beda dari getPaidOrderMapForBuyer
 * yang cuma satu representatif per produk) -- dipakai di halaman profil
 * untuk daftar "produk yang sudah dibeli", termasuk produk stok
 * terbatas yang boleh dibeli berkali-kali (tiap pembelian tampil
 * sebagai baris terpisah).
 */
export async function getPurchasedOrdersForBuyer(
  buyerDiscordId: string
): Promise<PurchasedOrder[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, product_id, price_idr, download_url, paid_at, products(name)")
    .eq("buyer_discord_id", buyerDiscordId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat riwayat pembelian: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const productRelation = (
      row as unknown as { products: { name: string } | null }
    ).products;
    return {
      id: row.id,
      product_id: row.product_id,
      product_name: productRelation?.name ?? null,
      price_idr: row.price_idr,
      download_url: row.download_url,
      paid_at: row.paid_at,
    };
  });
}
