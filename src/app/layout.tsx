import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopManager",
  description: "Toko digital ShopManager -- login dengan Discord",
  icons: {
    icon: "/brand/logo-full.png",
  },
};

// Dark theme selalu aktif -- ini preferensi tetap, bukan default yang
// nanti diganti mengikuti sistem. Kalau suatu saat mau nambah toggle
// light/dark, tinggal ganti "dark" ini jadi class dinamis dari state/cookie;
// jangan hapus tema light dari globals.css karena strukturnya masih dipakai
// sebagai fallback.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
