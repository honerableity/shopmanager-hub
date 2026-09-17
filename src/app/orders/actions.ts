"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createOrder, getOwnedOrder, syncOrderStatus } from "@/lib/orders";

export type StartCheckoutState = {
  error?: string;
};

/**
 * Dipanggil saat user klik "Beli" di product card. Buat order +
 * deposit QRIS, lalu redirect ke halaman order untuk menampilkan QR
 * dan mulai polling status.
 *
 * Untuk produk delivery_type='form', formData juga membawa jawaban
 * form dengan nama field `form_response__<label>` (lihat
 * ProductCard/FormAnswerDialog) -- dikumpulkan di sini jadi satu objek
 * sebelum diteruskan ke createOrder untuk divalidasi ulang di server.
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

  const { order, error } = await createOrder(
    productId,
    session.user.discordId,
    formResponses
  );

  if (error || !order) {
    return { error: error ?? "Gagal membuat order." };
  }

  redirect(`/orders/${order.id}`);
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
