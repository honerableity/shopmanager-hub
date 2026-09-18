import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProductReview = {
  id: string;
  product_id: string;
  buyer_discord_id: string;
  buyer_username: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ReviewSummary = {
  reviews: ProductReview[];
  averageRating: number | null;
  totalReviews: number;
};

export async function getReviewsForProduct(productId: string): Promise<ReviewSummary> {
  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat review: ${error.message}`);
  }

  const reviews = (data ?? []) as ProductReview[];
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : null;

  return { reviews, averageRating, totalReviews };
}

/**
 * Cek apakah buyer boleh mereview produk ini -- syaratnya cuma punya
 * minimal satu order berstatus 'paid' untuk produk ini (tidak peduli
 * order_group/voucher/dst, cukup pernah lunas). Dipakai untuk
 * menampilkan/menyembunyikan form review di halaman detail produk.
 */
export async function canReviewProduct(
  productId: string,
  buyerDiscordId: string
): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("buyer_discord_id", buyerDiscordId)
    .eq("status", "paid");

  if (error) {
    throw new Error(`Gagal memuat riwayat pembelian: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

export async function getOwnReview(
  productId: string,
  buyerDiscordId: string
): Promise<ProductReview | null> {
  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("buyer_discord_id", buyerDiscordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat review: ${error.message}`);
  }
  return data as ProductReview | null;
}

/**
 * Submit (atau update, lewat upsert onConflict) review pembeli untuk
 * satu produk. Menegakkan syarat "sudah pernah beli lunas" DI SINI
 * (bukan cuma di UI) supaya endpoint ini tidak bisa disalahgunakan
 * lewat panggilan langsung tanpa lewat form.
 */
export async function submitReview(
  productId: string,
  buyerDiscordId: string,
  buyerUsername: string,
  rating: number,
  comment: string | null
): Promise<{ error?: string }> {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return { error: "Rating harus antara 1 sampai 5." };
  }

  const allowed = await canReviewProduct(productId, buyerDiscordId);
  if (!allowed) {
    return { error: "Kamu harus membeli produk ini dulu sebelum memberi review." };
  }

  const { error } = await supabaseAdmin.from("product_reviews").upsert(
    {
      product_id: productId,
      buyer_discord_id: buyerDiscordId,
      buyer_username: buyerUsername,
      rating,
      comment: comment?.trim() || null,
    },
    { onConflict: "product_id,buyer_discord_id" }
  );

  if (error) {
    return { error: `Gagal menyimpan review: ${error.message}` };
  }
  return {};
}

/**
 * Rata-rata rating semua produk sekaligus (productId -> {avg, count}),
 * dipakai di daftar shop supaya tiap product card bisa tampilkan
 * bintang rata-rata tanpa query per-produk satu-satu.
 */
export async function getRatingSummaryForProducts(
  productIds: string[]
): Promise<Record<string, { average: number; count: number }>> {
  if (productIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .select("product_id, rating")
    .in("product_id", productIds);

  if (error) {
    throw new Error(`Gagal memuat ringkasan review: ${error.message}`);
  }

  const grouped: Record<string, number[]> = {};
  for (const row of data ?? []) {
    grouped[row.product_id] = grouped[row.product_id] ?? [];
    grouped[row.product_id].push(row.rating);
  }

  const result: Record<string, { average: number; count: number }> = {};
  for (const [productId, ratings] of Object.entries(grouped)) {
    result[productId] = {
      average: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      count: ratings.length,
    };
  }
  return result;
}
