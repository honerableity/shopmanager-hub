import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { isAdmin } from "@/lib/admin";
import { getProductTypes } from "@/lib/products";

import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    redirect("/");
  }

  const productTypes = await getProductTypes();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
      <BackButton fallbackHref="/admin/products" />
      <ProductForm productTypes={productTypes} />
    </div>
  );
}