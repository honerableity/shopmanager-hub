import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Dipakai bersama oleh semua endpoint whitelist-check (Roblox sekarang,
 * Discord bot belakangan) supaya query intinya cuma ditulis sekali.
 * Kalau nanti butuh multi-game (roblox_universe_id), tambahkan
 * parameter di sini + kolomnya di whitelist_entries (lihat komentar
 * di 003_roblox_whitelist.sql).
 */
export async function isRobloxUserWhitelisted(
  robloxUserId: string,
  productSlug: string
): Promise<{ owned: boolean; error?: string }> {
  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, grants_whitelist")
    .eq("slug", productSlug)
    .maybeSingle();

  if (productError) {
    return { owned: false, error: `Gagal memuat produk: ${productError.message}` };
  }
  if (!product) {
    return { owned: false, error: "Produk tidak ditemukan." };
  }
  if (!product.grants_whitelist) {
    return { owned: false, error: "Produk ini tidak memberi whitelist." };
  }

  const { data, error } = await supabaseAdmin
    .from("whitelist_entries")
    .select("id")
    .eq("product_id", product.id)
    .eq("roblox_user_id", robloxUserId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { owned: false, error: `Gagal mengecek whitelist: ${error.message}` };
  }

  return { owned: Boolean(data) };
}

/**
 * Sama seperti di atas tapi query berdasarkan SEMUA produk yang
 * grants_whitelist -- dipakai kalau pemanggil cuma mau tahu "apakah
 * roblox user ini punya whitelist apa pun", tanpa spesifik produk.
 * Belum dipakai endpoint manapun saat ini, disiapkan untuk kebutuhan
 * lanjutan (mis. /api/discord-check).
 */
export async function getWhitelistedProductSlugs(
  robloxUserId: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("whitelist_entries")
    .select("products(slug)")
    .eq("roblox_user_id", robloxUserId);

  if (error) {
    throw new Error(`Gagal memuat whitelist: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => (row as unknown as { products: { slug: string } | null }).products?.slug)
    .filter((slug): slug is string => Boolean(slug));
}
