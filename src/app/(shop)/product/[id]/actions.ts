"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { submitReview } from "@/lib/reviews";
import { requireNotBanned } from "@/lib/moderation";

export type SubmitReviewState = { error?: string; success?: boolean };

export async function submitProductReview(
  _prevState: SubmitReviewState,
  formData: FormData
): Promise<SubmitReviewState> {
  const session = await auth();
  if (!session?.user?.discordId) {
    return { error: "Kamu harus login dulu." };
  }
  const banError = await requireNotBanned(session.user.discordId);
  if (banError) {
    return { error: banError };
  }

  const productId = formData.get("product_id");
  const ratingRaw = formData.get("rating");
  const comment = formData.get("comment");

  if (typeof productId !== "string" || !productId) {
    return { error: "Produk tidak valid." };
  }
  const rating = Number(ratingRaw);

  const { error } = await submitReview(
    productId,
    session.user.discordId,
    session.user.name ?? "Unknown",
    rating,
    typeof comment === "string" ? comment : null
  );

  if (error) {
    return { error };
  }

  revalidatePath(`/product/${productId}`);
  return { success: true };
}
