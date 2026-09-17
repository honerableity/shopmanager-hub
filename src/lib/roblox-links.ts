import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Link Roblox User ID yang di-input manual sendiri oleh user (bukan
 * verifikasi OAuth Roblox) -- sengaja simpel, sama semangatnya dengan
 * isAdmin() yang cuma cek ID langsung. Kalau nanti perlu verifikasi
 * kepemilikan akun Roblox (misal lewat kode di bio profil), titik ini
 * yang perlu diubah duluan.
 */
export async function getRobloxLink(
  discordId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("user_roblox_links")
    .select("roblox_user_id")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat link Roblox: ${error.message}`);
  }

  return data?.roblox_user_id ?? null;
}

export async function upsertRobloxLink(
  discordId: string,
  robloxUserId: string
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.from("user_roblox_links").upsert(
    {
      discord_id: discordId,
      roblox_user_id: robloxUserId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "discord_id" }
  );

  if (error) {
    return { error: `Gagal menyimpan Roblox ID: ${error.message}` };
  }
  return {};
}
