"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import type { ProductReview } from "@/lib/reviews";

import { submitProductReview, type SubmitReviewState } from "./actions";

const initialState: SubmitReviewState = {};

export function ReviewForm({
  productId,
  ownReview,
}: {
  productId: string;
  ownReview: ProductReview | null;
}) {
  const [state, formAction, isPending] = useActionState(
    submitProductReview,
    initialState
  );
  const [rating, setRating] = useState(ownReview?.rating ?? 0);

  return (
    <form action={formAction} className="space-y-2 rounded-md border p-3">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="rating" value={rating} />

      <p className="text-sm font-medium">
        {ownReview ? "Ubah review kamu" : "Tulis review"}
      </p>
      <StarRating value={rating} onChange={setRating} size={20} />
      <Textarea
        name="comment"
        placeholder="Bagaimana pengalamanmu dengan produk ini? (opsional)"
        defaultValue={ownReview?.comment ?? ""}
        rows={3}
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-500">Review tersimpan, terima kasih!</p>
      )}
      <Button type="submit" size="sm" disabled={isPending || rating === 0}>
        {isPending ? "Menyimpan..." : ownReview ? "Perbarui Review" : "Kirim Review"}
      </Button>
    </form>
  );
}
