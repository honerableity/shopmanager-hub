import Image from "next/image";
import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import type { Product } from "@/lib/products";
import type { ProductReview, ReviewSummary } from "@/lib/reviews";

import { AddToCartButton } from "./add-to-cart-button";
import { ReviewForm } from "./review-form";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProductDetailView({
  product,
  reviewSummary,
  canReview,
  ownReview,
  isLoggedIn,
  ownedOrderId,
}: {
  product: Product;
  reviewSummary: ReviewSummary;
  canReview: boolean;
  ownReview: ProductReview | null;
  isLoggedIn: boolean;
  ownedOrderId?: string;
}) {
  const isOutOfStock = product.stock !== null && product.stock <= 0;
  const alreadyOwned = product.stock === null && Boolean(ownedOrderId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <BackButton fallbackHref="/" />

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Tidak ada gambar
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h1 className="text-xl font-semibold">{product.name}</h1>

          {reviewSummary.totalReviews > 0 ? (
            <div className="flex items-center gap-2">
              <StarRating value={reviewSummary.averageRating ?? 0} />
              <span className="text-sm text-muted-foreground">
                {reviewSummary.averageRating?.toFixed(1)} ({reviewSummary.totalReviews}{" "}
                review)
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada review</p>
          )}

          <p className="text-2xl font-semibold">
            {formatRupiah(product.price_idr)}
          </p>

          {isOutOfStock ? (
            <Badge variant="destructive">Stok habis</Badge>
          ) : product.stock !== null ? (
            <Badge variant="secondary">Sisa {product.stock}</Badge>
          ) : null}

          {product.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {product.description}
            </p>
          )}

          <div className="pt-2">
            {!isLoggedIn ? (
              <Button asChild>
                <Link href="/login">Login untuk membeli</Link>
              </Button>
            ) : alreadyOwned ? (
              <Button asChild variant="secondary">
                <Link href={`/orders/${ownedOrderId}`}>Buka File</Link>
              </Button>
            ) : (
              <AddToCartButton
                productId={product.id}
                productName={product.name}
                formSchema={product.form_schema}
                isForm={product.delivery_type === "form"}
                disabled={isOutOfStock}
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Review Pembeli</h2>

        {isLoggedIn && canReview && (
          <ReviewForm productId={product.id} ownReview={ownReview} />
        )}

        {reviewSummary.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada review untuk produk ini.
          </p>
        ) : (
          <div className="space-y-3">
            {reviewSummary.reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {review.buyer_username}
                    </span>
                    <StarRating value={review.rating} size={14} />
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
