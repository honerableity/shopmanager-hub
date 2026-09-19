# DESIGN.md — Acuan Tampilan ShopManager

Baca file ini sebelum menambah halaman/komponen baru, supaya tidak
perlu menebak ulang identitas produk tiap kali.

## Identitas

- Nama produk yang ditampilkan ke user: **ShopManager**. Nama file/zip
  project ("midas-web", "MIDAS I") cuma nama internal lama -- jangan
  dipakai di UI.
- Logo: `public/brand/logo-full.png` (logo + teks, 1024x1024, sudah
  punya background ungu solid bawaan di gambarnya sendiri). Dipakai di
  `login/page.tsx` dan sebagai favicon (`layout.tsx`). Kalau butuh versi
  ikon-saja (tanpa teks) atau SVG, minta dibuatkan -- belum ada saat ini.
- Semua pemakaian `next/image` untuk gambar statis di `public/` pakai
  prop `unoptimized` (lihat `login/page.tsx`). Ini untuk menghindari
  Next.js Image Optimization server-side, yang sempat gagal ("isn't a
  valid image ... received null") di sebagian environment Windows
  karena masalah `sharp`. Ikuti pola yang sama untuk gambar statis baru
  -- jangan hapus `unoptimized` kecuali sudah dites jalan tanpa error
  di semua environment target.

## Warna & komponen

Tema warna **shadcn/ui default (neutral)**, tidak dikustomisasi ke
warna logo -- ini keputusan sadar, bukan belum sempat dikerjakan.
Jangan tambahkan token warna brand (ungu/biru/oranye dari logo) ke
`globals.css` kecuali diminta ulang secara eksplisit.

Komponen dari shadcn/ui (`src/components/ui/`), style "new york", base
color neutral. Komponen yang sudah ada: `button.tsx`, `card.tsx`.
Kalau butuh komponen shadcn lain (dialog, input, badge, dll), tambahkan
dengan pola yang sama: file manual di `src/components/ui/`, BUKAN lewat
`npx shadcn add` -- CLI-nya terbukti timeout di lingkungan build ini.

## Mode warna: dark theme permanen

**Dark theme adalah satu-satunya tema aktif, by design** (preferensi
pemilik produk, bukan default sementara). `<html>` di
`src/app/layout.tsx` selalu punya class `dark` yang di-hardcode --
tidak mengikuti preferensi sistem/browser, dan tidak ada toggle
light/dark.

Kalau nanti mau nambah toggle light/dark, tinggal ganti
`className="dark"` di `layout.tsx` jadi class dinamis dari state/cookie
-- blok `:root` (light) di `globals.css` tetap disimpan sebagai
fallback/struktur, hanya belum dipakai.

## Font

Font sistem default (`font-sans` Tailwind), BUKAN next/font/google
(Geist) -- sandbox/beberapa environment deploy tidak selalu bisa akses
`fonts.googleapis.com` saat build, jadi ini sengaja dihindari supaya
build tidak gagal. Kalau nanti mau font custom, pakai `next/font/local`
dengan file font yang di-self-host di `public/fonts/`.

## Layout umum

- Halaman publik (login, landing): `min-h-svh flex items-center
  justify-center`, konten dalam `Card` max-w-sm, senada dengan
  `src/app/login/page.tsx`.
- Ikon Discord dipakai sebagai inline SVG (lihat `login/page.tsx`),
  bukan library ikon, karena lucide-react tidak punya logo brand pihak
  ketiga.

## Kategori produk (product_types) -- hardcoded, edit lewat Supabase

Kategori ("Roblox", "Other") BUKAN dikelola lewat UI web -- tidak ada
form untuk create/edit/delete kategori. Kalau perlu ubah nama, urutan,
atau tambah kategori baru, edit langsung lewat **Supabase Table Editor**
(dashboard project > Table Editor > tabel `product_types`), atau lewat
SQL Editor. Referensi skema awal: `supabase/001_init_products.sql`.

Shop page (`src/app/page.tsx`) menampilkan tiap kategori sebagai tab
terpisah (komponen `Tabs` shadcn), urutannya ikut kolom `sort_order`.
Kalau nambah kategori baru di Supabase, tab barunya otomatis muncul --
tidak perlu ubah kode.

## Admin -- satu orang, dicek lewat Discord ID

Admin ShopManager cuma satu, dicek lewat `isAdmin()` di
`src/lib/admin.ts` (bandingkan `session.user.discordId` ke ID yang
di-hardcode di situ). BUKAN role di database, BUKAN tabel `admins` --
sengaja simpel karena cuma 1 admin. Kalau nanti perlu lebih dari satu
admin, itu titik yang perlu diubah duluan.

Setiap halaman/action admin (`/admin/*`, `createProduct`, dst) HARUS
cek `isAdmin()` di server (Server Component atau Server Action) --
JANGAN cuma sembunyikan tombol di UI client, itu bisa dilewati dengan
akses URL langsung.

## Struktur folder: route group `(shop)`

Semua halaman toko (shop page, cart, product, orders, profile,
admin/*) ada di dalam `src/app/(shop)/` -- route group Next.js, TIDAK
mengubah URL sama sekali (`(shop)/cart/page.tsx` tetap diakses di
`/cart`). Cuma `/login` dan `/banned` yang di luar grup ini.

Alasannya: `src/app/(shop)/layout.tsx` adalah tempat pengecekan ban
akun Discord yang SESUNGGUHNYA (query ke Supabase) -- lihat bagian
"Moderasi" di bawah. Kalau nambah halaman toko baru, taruh di dalam
`(shop)/` supaya otomatis ikut terlindungi layout ini.

## Moderasi: ban akun & revoke produk

- **Ban akun Discord** (`banned_discord_users`, lihat
  `supabase/006_moderation.sql` & `src/lib/moderation.ts`): akun yang
  diban tidak bisa akses halaman toko manapun lagi (redirect ke
  `/banned`, satu-satunya aksi di sana adalah logout) dan otomatis
  dianggap logout dari sesi yang sedang aktif di navigasi berikutnya.
  - Pengecekannya ADA DI DUA TEMPAT dengan alasan berbeda:
    1. `src/app/(shop)/layout.tsx` -- query DB definitif, jalan sekali
       per navigasi halaman. Ini yang benar-benar mem-block akses ke
       semua halaman toko.
    2. `src/proxy.ts` SENGAJA TIDAK query DB -- proxy jalan di setiap
       request termasuk yang di-prefetch, dan dokumentasi Next.js
       eksplisit bilang proxy cuma untuk "optimistic check" dari
       cookie/token, bukan database, supaya tidak bikin masalah
       performa. Proxy di sini cuma menegakkan "harus login".
  - Server Actions (checkout, tambah ke keranjang, submit review) juga
    punya pengecekan sendiri lewat `requireNotBanned()` di
    `lib/moderation.ts` -- WAJIB, karena Server Action adalah endpoint
    POST tersendiri yang bisa dipanggil langsung tanpa lewat halaman
    (proxy/layout tidak otomatis melindunginya).
  - Admin ban/unban lewat Discord ID manual di halaman
    `/admin/moderation` (ShopManager tidak punya tabel `users`
    terpusat atau pencarian username).

- **Revoke produk**: order yang sudah `paid` bisa ditandai admin jadi
  status `revoked` (lihat `revokeOrder` di `lib/moderation.ts`). Order
  TIDAK dihapus (riwayat tetap ada), tapi:
  - Tidak lagi dianggap "paid" oleh query manapun (halaman profil,
    "Buka File" di shop) -- otomatis tersaring karena semua query itu
    filter `.eq("status", "paid")`.
  - `whitelist_entries` terkait ikut dihapus supaya akses Roblox (kalau
    ada) ikut tercabut.
  - Bisa dibatalkan (`unrevokeOrder`, balik jadi `paid`) dari halaman
    `/admin/moderation` juga.