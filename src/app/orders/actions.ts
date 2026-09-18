"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOwnedOrder, syncOrderStatus } from "@/lib/orders";
import { createOrderGroup, getOrdersForGroup, getOwnedOrderGroup, syncOrderGroupStatus } from "@/lib/order-groups";

export type StartCheckoutState = {
  error?: string;
};

/**
 * Dipanggil saat user klik "Beli" di product card (beli-langsung, di
 * luar keranjang). Dilewatkan lewat createOrderGroup dengan SATU item
 * -- bukan lagi createOrder lama -- supaya beli-langsung juga bisa
 * pakai kode voucher (field `voucher_code`, opsional) dan tetap
 * konsisten dengan alur checkout keranjang. Baris `orders` yang
 * dihasilkan tetap satu baris biasa (dengan order_group_id terisi),
 * jadi redirect ke /orders/[id] di bawah tidak berubah.
 *
 * Untuk produk delivery_type='form', formData juga membawa jawaban
 * form dengan nama field `form_response__<label>` (lihat
 * ProductCard/FormAnswerDialog) -- dikumpulkan di sini jadi satu objek
 * sebelum diteruskan untuk divalidasi ulang di server.
 */
export async function startCheckout(
  _prevState: StartCheckoutState,
  formData: FormData
): Promise<StartCheckoutState> {
  const session = await auth();
  if (!session?.user?.discordId) {
    return { error: "Kamu harus login dulu untuk membeli." };
  }

  const productId = formData.get("product_id");
  if (typeof productId !== "string" || !productId) {
    return { error: "Produk tidak valid." };
  }

  const formResponses: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("form_response__") && typeof value === "string") {
      formResponses[key.slice("form_response__".length)] = value;
    }
  }

  const voucherCodeRaw = formData.get("voucher_code");
  const voucherCode =
    typeof voucherCodeRaw === "string" && voucherCodeRaw.trim()
      ? voucherCodeRaw.trim()
      : undefined;

  const { orders, error } = await createOrderGroup(
    [
      {
        productId,
        quantity: 1,
        formResponses:
          Object.keys(formResponses).length > 0 ? formResponses : undefined,
      },
    ],
    session.user.discordId,
    session.user.name ?? "Unknown",
    voucherCode
  );

  if (error || !orders || orders.length === 0) {
    return { error: error ?? "Gagal membuat order." };
  }

  redirect(`/orders/${orders[0].id}`);
}

/**
 * Dipoll dari halaman order (client component) untuk mengecek status
 * pembayaran terbaru ke Rama Shop. Verifikasi kepemilikan order lewat
 * session di server -- jangan pernah percaya orderId saja.
 */
export async function pollOrderStatus(orderId: string) {
  const session = await auth();
  if (!session?.user?.discordId) {
    throw new Error("Kamu harus login.");
  }

  const order = await getOwnedOrder(orderId, session.user.discordId);
  if (!order) {
    throw new Error("Order tidak ditemukan.");
  }

  return syncOrderStatus(order);
}

/**
 * Sama seperti pollOrderStatus tapi untuk order_group (checkout
 * keranjang/multi-item) -- dipoll dari halaman /orders/group/[id].
 */
export async function pollOrderGroupStatus(orderGroupId: string) {
  const session = await auth();
  if (!session?.user?.discordId) {
    throw new Error("Kamu harus login.");
  }

  const group = await getOwnedOrderGroup(orderGroupId, session.user.discordId);
  if (!group) {
    throw new Error("Order tidak ditemukan.");
  }

  const fresh = await syncOrderGroupStatus(group);
  const orders = await getOrdersForGroup(orderGroupId);
  return { group: fresh, orders };
}
