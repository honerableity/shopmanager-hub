import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ensureWhitelistForOwnedOrder, getOwnedOrder, syncOrderStatus } from "@/lib/orders";
import { getDeliveryTypeForProduct } from "@/lib/products";

import { OrderStatusView } from "./order-status-view";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const order = await getOwnedOrder(id, session.user.discordId);
  if (!order) {
    notFound();
  }

  // Sync sekali di server saat halaman dibuka (misal user reload
  // setelah bayar) supaya tidak perlu nunggu 1 siklus polling client
  // untuk lihat status terbaru.
  const fresh = await syncOrderStatus(order);

  // Jaga-jaga: kalau produk ini memberi whitelist Roblox tapi buyer
  // baru isi Roblox ID SETELAH order jadi paid, entry whitelist belum
  // sempat dibuat otomatis saat itu -- coba buat lagi di sini setiap
  // kali halaman order dibuka (no-op kalau sudah ada / belum eligible).
  await ensureWhitelistForOwnedOrder(fresh);

  // Dipakai OrderStatusView untuk pilih pesan yang tepat begitu lunas
  // (link file vs "sedang diproses admin"). Produk bisa saja sudah
  // dihapus sejak order ini dibuat -- fallback ke "filelink" (perilaku
  // lama) supaya order lama tetap tampil seperti sebelumnya.
  const deliveryType = (await getDeliveryTypeForProduct(fresh.product_id)) ?? "filelink";

  return (
    <div className="min-h-svh flex items-center justify-center p-4">
      <OrderStatusView order={fresh} deliveryType={deliveryType} />
    </div>
  );
}
