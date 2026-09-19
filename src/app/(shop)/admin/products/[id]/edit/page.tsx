import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { isAdmin } from "@/lib/admin";
import { getAdminProductById } from "@/lib/products";
import { getProductTypes } from "@/lib/products";

import { ProductForm } from "../../product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    redirect("/");
  }

  const { id } = await params;
  const [product, productTypes] = await Promise.all([
    getAdminProductById(id),
    getProductTypes(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
      <BackButton fallbackHref="/admin/products" />
      <ProductForm productTypes={productTypes} product={product} />
    </div>
  );
}
