"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { upsertRobloxLink } from "@/lib/roblox-links";

export type SaveRobloxIdState = {
  error?: string;
  success?: boolean;
};

/**
 * Roblox User ID di-input manual sendiri oleh user -- tidak ada
 * verifikasi kepemilikan akun Roblox (lihat komentar di
 * src/lib/roblox-links.ts). Validasi di sini cuma memastikan formatnya
 * numerik, karena Roblox User ID selalu berupa angka.
 */
export async function saveRobloxId(
  _prevState: SaveRobloxIdState,
  formData: FormData
): Promise<SaveRobloxIdState> {
  const session = await auth();
  if (!session?.user?.discordId) {
    return { error: "Kamu harus login dulu." };
  }

  const robloxUserId = formData.get("roblox_user_id");
  if (typeof robloxUserId !== "string" || !robloxUserId.trim()) {
    return { error: "Roblox User ID wajib diisi." };
  }

  const trimmed = robloxUserId.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Roblox User ID harus berupa angka (cek di profil Roblox-mu)." };
  }

  const { error } = await upsertRobloxLink(session.user.discordId, trimmed);
  if (error) {
    return { error };
  }

  revalidatePath("/profile");
  return { success: true };
}
