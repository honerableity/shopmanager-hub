import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { getCartWithProductDetails } from "@/lib/cart";

import { CartView } from "./cart-view";

export default async function CartPage() {
  const session = await auth();
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const items = await getCartWithProductDetails();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Keranjang</h1>
        <BackButton fallbackHref="/" />
      </div>

      <CartView items={items} />
    </div>
  );
}
