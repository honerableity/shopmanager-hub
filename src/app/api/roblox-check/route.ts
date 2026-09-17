import { NextResponse } from "next/server";

import { isValidApiKey } from "@/lib/api-auth";
import { isRobloxUserWhitelisted } from "@/lib/whitelist";

/**
 * GET /api/roblox-check?robloxUserId=123&product=nama-produk
 *
 * Dipanggil dari server Roblox (game) untuk cek apakah suatu Roblox
 * User ID berhak atas whitelist produk tertentu. BUKAN untuk dipanggil
 * dari client Roblox (LocalScript) -- API key harus tetap rahasia,
 * simpan di ServerScriptService saja.
 *
 * Auth: header `X-API-Key` harus cocok dengan WHITELIST_API_KEY (lihat
 * src/lib/api-auth.ts). Endpoint ini sengaja hanya menjawab
 * ya/tidak (tidak membocorkan detail order/pembeli) -- cukup untuk
 * kebutuhan whitelist gate di game.
 *
 * Query params:
 * - robloxUserId (wajib): Roblox User ID numerik sebagai string.
 * - product (wajib): slug produk (lihat kolom products.slug), BUKAN
 *   UUID -- supaya gampang dibaca/di-hardcode di skrip Roblox.
 *
 * Response 200: { "owned": true } atau { "owned": false }
 * Response 400/401/404: { "owned": false, "error": "..." }
 */
export async function GET(request: Request) {
  if (!isValidApiKey(request)) {
    return NextResponse.json(
      { owned: false, error: "API key tidak valid." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const robloxUserId = searchParams.get("robloxUserId");
  const product = searchParams.get("product");

  if (!robloxUserId || !product) {
    return NextResponse.json(
      { owned: false, error: "Parameter robloxUserId dan product wajib diisi." },
      { status: 400 }
    );
  }

  const result = await isRobloxUserWhitelisted(robloxUserId, product);

  if (result.error) {
    const status = result.error === "Produk tidak ditemukan." ? 404 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ owned: result.owned });
}
