import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOrdersForGroup, getOwnedOrderGroup, syncOrderGroupStatus } from "@/lib/order-groups";
import { ensureWhitelistForOwnedOrder } from "@/lib/orders";

import { OrderGroupStatusView } from "./order-group-status-view";

export default async function OrderGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const group = await getOwnedOrderGroup(id, session.user.discordId);
  if (!group) {
    notFound();
  }

  const freshGroup = await syncOrderGroupStatus(group);
  const orders = await getOrdersForGroup(id);

  // Sama seperti halaman order tunggal: jaga-jaga kalau whitelist
  // belum sempat dibuat otomatis saat lunas (mis. Roblox ID baru
  // diisi belakangan).
  for (const order of orders) {
    if (order.status === "paid") {
      await ensureWhitelistForOwnedOrder(order);
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <OrderGroupStatusView group={freshGroup} orders={orders} />
    </div>
  );
}
