import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  // Pengecekan status ban TIDAK dilakukan di sini secara sengaja --
  // proxy jalan di SETIAP request termasuk route yang di-prefetch, dan
  // dokumentasi Next.js eksplisit menyarankan proxy hanya melakukan
  // "optimistic check" dari cookie/token, bukan query database, untuk
  // menghindari masalah performa
  // (lihat "Optimistic checks with Proxy" di guide authentication).
  //
  // Pengecekan ban yang sesungguhnya (query ke Supabase) dilakukan di
  // dua tempat lain:
  // 1. src/app/layout.tsx (root layout) -- jalan sekali per navigasi
  //    HALAMAN (render), bukan per aset/prefetch, jadi query DB di
  //    sini jauh lebih jarang & aman secara performa.
  // 2. lib/moderation.ts::requireNotBanned -- dipanggil di setiap
  //    Server Action yang membuat/mengubah order (checkout, tambah ke
  //    keranjang, dst), karena Server Action adalah endpoint POST
  //    tersendiri yang bisa dipanggil langsung tanpa lewat proxy.
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|brand|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
