import "server-only";

/**
 * Endpoint whitelist-check (/api/roblox-check, dan /api/discord-check
 * belakangan) dipanggil dari server Roblox / bot Discord -- BUKAN dari
 * browser dengan session NextAuth. Otentikasinya pakai API key statis
 * lewat header, sama pola dengan RAMASHOP_API_KEY (server-only, tidak
 * pernah masuk bundle browser).
 *
 * Satu key dipakai bersama untuk semua endpoint whitelist-check --
 * cukup untuk sekarang karena pemanggilnya cuma layanan milik sendiri
 * (game Roblox sendiri), bukan pihak ketiga. Kalau nanti perlu key
 * berbeda per integrasi (biar bisa dicabut satu-satu), pindahkan ke
 * tabel Supabase.
 */
export function isValidApiKey(request: Request): boolean {
  const expected = process.env.WHITELIST_API_KEY;
  if (!expected) {
    // Sengaja fail-closed: kalau key belum diset di environment,
    // anggap semua request tidak sah alih-alih diam-diam publik.
    return false;
  }

  const provided = request.headers.get("x-api-key");
  return provided === expected;
}
