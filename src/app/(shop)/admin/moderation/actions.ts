"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import {
  banDiscordUser,
  revokeOrder,
  searchOrdersForModeration,
  unbanDiscordUser,
  unrevokeOrder,
  type ModerationOrder,
} from "@/lib/moderation";

export type BanUserState = { error?: string; success?: boolean };

/**
 * Ban satu akun Discord lewat ID-nya (bukan lewat pencarian username --
 * ShopManager tidak punya tabel `users` terpusat, jadi admin masukkan
 * Discord ID secara manual; ID ini bisa dilihat lewat log pembelian di
 * webhook Discord atau di daftar order).
 */
export async function banUser(
  _prevState: BanUserState,
  formData: FormData
): Promise<BanUserState> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    return { error: "Kamu tidak punya akses untuk mem-ban akun." };
  }

  const discordId = formData.get("discord_id");
  const reasonRaw = formData.get("reason");

  if (typeof discordId !== "string" || !discordId.trim()) {
    return { error: "Discord ID wajib diisi." };
  }
  if (!/^\d{15,25}$/.test(discordId.trim())) {
    return { error: "Discord ID tidak valid (harus berupa angka)." };
  }
  if (discordId.trim() === session!.user!.discordId) {
    return { error: "Kamu tidak bisa mem-ban akunmu sendiri." };
  }

  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim()
      ? reasonRaw.trim()
      : null;

  const { error } = await banDiscordUser(
    discordId.trim(),
    reason,
    session!.user!.discordId!
  );

  if (error) {
    return { error };
  }

  revalidatePath("/admin/moderation");
  return { success: true };
}

export async function unbanUser(discordId: string) {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    throw new Error("Kamu tidak punya akses untuk membatalkan ban.");
  }

  const { error } = await unbanDiscordUser(discordId);
  if (error) {
    throw new Error(error);
  }

  revalidatePath("/admin/moderation");
}

export type RevokeOrderState = { error?: string; success?: boolean };

/**
 * Cabut (revoke) akses pembeli ke satu order yang sudah lunas --
 * dipanggil dari tombol "Cabut Produk" di halaman detail order admin.
 */
export async function revokeOrderAction(
  _prevState: RevokeOrderState,
  formData: FormData
): Promise<RevokeOrderState> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    return { error: "Kamu tidak punya akses untuk mencabut order." };
  }

  const orderId = formData.get("order_id");
  const reasonRaw = formData.get("reason");

  if (typeof orderId !== "string" || !orderId) {
    return { error: "Order tidak valid." };
  }

  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim()
      ? reasonRaw.trim()
      : null;

  const { error } = await revokeOrder(
    orderId,
    reason,
    session!.user!.discordId!
  );

  if (error) {
    return { error };
  }

  revalidatePath("/admin/moderation");
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}

export async function unrevokeOrderAction(orderId: string) {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    throw new Error("Kamu tidak punya akses untuk membatalkan pencabutan.");
  }

  const { error } = await unrevokeOrder(orderId);
  if (error) {
    throw new Error(error);
  }

  revalidatePath("/admin/moderation");
  revalidatePath(`/orders/${orderId}`);
}

/**
 * Dipanggil dari kotak pencarian order di halaman moderasi. Server
 * action biasa (bukan form action) supaya bisa dipanggil dari
 * useTransition di client component sambil tetap menegakkan isAdmin()
 * di server.
 */
export async function searchOrders(query: string): Promise<ModerationOrder[]> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    throw new Error("Kamu tidak punya akses untuk mencari order.");
  }

  return searchOrdersForModeration(query);
}
