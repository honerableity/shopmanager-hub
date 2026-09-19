"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "@/lib/cart";
import { createOrderGroup, previewVoucher } from "@/lib/order-groups";
import { requireNotBanned } from "@/lib/moderation";

export type AddToCartState = { error?: string; success?: boolean };

/**
 * Tambah satu produk ke keranjang. Untuk produk delivery_type='form',
 * formData membawa jawaban `form_response__<label>` -- validasi
 * kelengkapan field wajib TIDAK diulang di sini (itu baru ditegakkan
 * di createOrderGroup saat checkout sungguhan) supaya tetap sederhana;
 * halaman detail produk sudah menandai field required di client.
 */
export async function addProductToCart(
  _prevState: AddToCartState,
  formData: FormData
): Promise<AddToCartState> {
  const session = await auth();
  if (!session?.user?.discordId) {
    return { error: "Kamu harus login dulu." };
  }
  const banError = await requireNotBanned(session.user.discordId);
  if (banError) {
    return { error: banError };
  }

  const productId = formData.get("product_id");
  const quantityRaw = formData.get("quantity");
  if (typeof productId !== "string" || !productId) {
    return { error: "Produk tidak valid." };
  }
  const quantity = Math.max(1, Number(quantityRaw) || 1);

  const formResponses: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("form_response__") && typeof value === "string") {
      formResponses[key.slice("form_response__".length)] = value;
    }
  }

  await addToCart(
    productId,
    quantity,
    Object.keys(formResponses).length > 0 ? formResponses : undefined
  );

  revalidatePath("/cart");
  return { success: true };
}

export async function updateCartQuantity(index: number, quantity: number) {
  await updateCartItemQuantity(index, quantity);
  revalidatePath("/cart");
}

export async function removeFromCart(index: number) {
  await removeCartItem(index);
  revalidatePath("/cart");
}

export type CheckoutFormState = { error?: string };

/**
 * Checkout seluruh isi keranjang: ambil kode voucher (opsional) dari
 * form, buat SATU order_group untuk semua item, lalu kosongkan
 * keranjang dan redirect ke halaman status pembayaran group.
 */
export async function checkoutCart(
  _prevState: CheckoutFormState,
  formData: FormData
): Promise<CheckoutFormState> {
  const session = await auth();
  if (!session?.user?.discordId) {
    return { error: "Kamu harus login dulu." };
  }
  const banError = await requireNotBanned(session.user.discordId);
  if (banError) {
    return { error: banError };
  }

  const items = await getCart();
  if (items.length === 0) {
    return { error: "Keranjang kosong." };
  }

  const voucherCodeRaw = formData.get("voucher_code");
  const voucherCode =
    typeof voucherCodeRaw === "string" && voucherCodeRaw.trim()
      ? voucherCodeRaw.trim()
      : undefined;

  const { orderGroup, error } = await createOrderGroup(
    items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      formResponses: item.formResponses,
    })),
    session.user.discordId,
    session.user.name ?? "Unknown",
    voucherCode
  );

  if (error || !orderGroup) {
    return { error: error ?? "Gagal membuat order." };
  }

  await clearCart();
  redirect(`/orders/group/${orderGroup.id}`);
}

export type VoucherPreviewState = {
  error?: string;
  success?: boolean;
  code?: string;
  discountIdr?: number;
};

/**
 * Dipanggil dari tombol "Cek" di halaman keranjang sebelum benar-benar
 * checkout -- hanya preview, TIDAK mencatat pemakaian voucher (itu
 * baru terjadi saat order_group dibuat/lunas). Kalau user checkout
 * dengan kode yang berbeda dari yang di-preview, kode yang benar-benar
 * dipakai adalah yang dikirim saat checkoutCart, bukan yang di-preview.
 */
export async function previewCartVoucher(
  _prevState: VoucherPreviewState,
  formData: FormData
): Promise<VoucherPreviewState> {
  const session = await auth();
  if (!session?.user?.discordId) {
    return { error: "Kamu harus login dulu." };
  }

  const codeRaw = formData.get("voucher_code");
  if (typeof codeRaw !== "string" || !codeRaw.trim()) {
    return { error: "Masukkan kode voucher dulu." };
  }

  const items = await getCart();
  if (items.length === 0) {
    return { error: "Keranjang kosong." };
  }

  const result = await previewVoucher(
    codeRaw.trim(),
    session.user.discordId,
    items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
  );

  if (!result.ok) {
    return { error: result.error };
  }

  return {
    success: true,
    code: result.voucher.code,
    discountIdr: result.discount.totalDiscountIdr,
  };
}
