import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isDiscordIdBanned } from "@/lib/moderation";

/**
 * Layout ini membungkus SEMUA halaman toko (shop, cart, product,
 * orders, profile, admin/*) tapi TIDAK /login dan /banned (keduanya
 * sengaja ditaruh di luar route group `(shop)` ini, lihat struktur
 * folder src/app/).
 *
 * Ini tempat pengecekan ban yang SESUNGGUHNYA (query ke Supabase),
 * berbeda dari proxy.ts yang cuma melakukan optimistic check dari
 * cookie/token session -- lihat komentar di proxy.ts kenapa query DB
 * tidak dilakukan di sana. Layout Next.js jalan sekali per navigasi
 * HALAMAN (render), bukan per request aset/prefetch seperti proxy,
 * jadi query DB di sini jauh lebih jarang & aman secara performa.
 *
 * Server Actions (checkout, tambah ke keranjang, dst) tetap punya
 * pengecekan ban sendiri lewat requireNotBanned() -- layout ini TIDAK
 * melindungi pemanggilan Server Action secara langsung.
 */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const discordId = session?.user?.discordId;

  if (discordId) {
    const banned = await isDiscordIdBanned(discordId);
    if (banned) {
      redirect("/banned");
    }
  }

  return children;
}
