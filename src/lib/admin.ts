/**
 * Admin ShopManager cuma satu orang, dicek lewat Discord ID -- bukan
 * lewat role/tabel di database. Kalau nanti perlu lebih dari satu admin,
 * ganti ini jadi array atau pindahkan ke tabel `admins` di Supabase; untuk
 * sekarang sengaja simpel karena cuma 1 admin.
 *
 * ID ini BUKAN rahasia (Discord user ID itu publik, bukan token/secret),
 * jadi aman ditaruh di kode, tidak perlu di .env.
 */
const ADMIN_DISCORD_ID = "1509022726487146707";

export function isAdmin(discordId: string | undefined | null): boolean {
  return discordId === ADMIN_DISCORD_ID;
}