import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { isAdmin } from "@/lib/admin";
import { getProductTypes } from "@/lib/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { VoucherForm } from "../voucher-form";

export default async function NewVoucherPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    redirect("/");
  }

  const productTypes = await getProductTypes();
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="min-h-svh flex flex-col items-center gap-4 p-4 pt-8">
      <div className="w-full max-w-lg">
        <BackButton fallbackHref="/admin/vouchers" />
      </div>
      <VoucherForm productTypes={productTypes} products={products ?? []} />
    </div>
  );
}
