import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { getPublicProductById } from "@/lib/products";
import { canReviewProduct, getOwnReview, getReviewsForProduct } from "@/lib/reviews";
import { getPaidOrderMapForBuyer } from "@/lib/orders-catalog";

import { ProductDetailView } from "./product-detail-view";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getPublicProductById(id);
  if (!product) {
    notFound();
  }

  const session = await auth();
  const discordId = session?.user?.discordId;

  const [reviewSummary, canReview, ownReview, paidOrderMap] = await Promise.all([
    getReviewsForProduct(id),
    discordId ? canReviewProduct(id, discordId) : Promise.resolve(false),
    discordId ? getOwnReview(id, discordId) : Promise.resolve(null),
    discordId ? getPaidOrderMapForBuyer(discordId) : Promise.resolve({} as Record<string, string>),
  ]);

  return (
    <ProductDetailView
      product={product}
      reviewSummary={reviewSummary}
      canReview={canReview}
      ownReview={ownReview}
      isLoggedIn={Boolean(discordId)}
      ownedOrderId={paidOrderMap[id]}
    />
  );
}
