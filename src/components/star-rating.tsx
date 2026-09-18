"use client";

import { Star } from "lucide-react";

/**
 * Dua mode:
 *  - display (default): hanya tampilkan bintang terisi sesuai `value`,
 *    tidak interaktif. Dipakai di product card & ringkasan review.
 *  - interactive: `onChange` disediakan -> bintang bisa diklik untuk
 *    pilih rating 1-5. Dipakai di form submit review.
 */
export function StarRating({
  value,
  onChange,
  size = 16,
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: number;
}) {
  const stars = [1, 2, 3, 4, 5];
  const interactive = Boolean(onChange);

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
          aria-label={`${star} bintang`}
        >
          <Star
            size={size}
            className={
              star <= Math.round(value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }
          />
        </button>
      ))}
    </div>
  );
}
