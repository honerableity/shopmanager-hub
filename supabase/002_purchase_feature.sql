-- Fitur pembelian: link download per produk + tabel orders untuk
-- melacak status pembayaran QRIS via Rama Shop.
--
-- Jalankan lewat Supabase SQL Editor. Skema awal products/product_types
-- ada di 001_init_products.sql (referensi di DESIGN.md, tidak disertakan
-- di repo ini).

-- 1. Link download per produk, diisi manual oleh admin saat create
--    produk (Google Drive/Mediafire/dll), sama seperti bot lama.
alter table products
  add column if not exists download_url text;

-- 2. Tabel orders: satu baris per percobaan pembelian (bukan per
--    produk-per-user). Status pending dibuat saat user klik "Beli",
--    lalu diupdate jadi paid/expired/failed lewat polling status
--    Rama Shop (tidak ada webhook dari Rama Shop, murni polling).
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  buyer_discord_id text not null,

  -- Harga produk saat order dibuat (bukan diambil ulang nanti -- kalau
  -- admin ubah harga sesudahnya, order lama tetap konsisten dengan apa
  -- yang sudah dibayar/ditagih).
  price_idr integer not null,

  -- Detail dari Rama Shop POST /deposit/create.
  deposit_id text not null unique,
  total_amount integer not null, -- price_idr + kode unik
  qr_image text,
  qr_string text,
  expired_at timestamptz not null,

  -- pending -> paid | expired | failed
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'failed')),

  -- Disalin dari products.download_url tepat saat status berubah jadi
  -- paid, supaya order lama tidak ikut berubah/hilang kalau admin nanti
  -- mengedit atau menghapus produknya.
  download_url text,

  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_buyer_discord_id_idx
  on orders (buyer_discord_id);

create index if not exists orders_product_id_idx
  on orders (product_id);

-- RLS: orders TIDAK publicly readable/writable lewat anon key sama
-- sekali. Semua akses ke tabel ini (create order, cek status, baca
-- riwayat pembelian) HARUS lewat server action / route handler yang
-- pakai supabaseAdmin (service role) dan memverifikasi
-- buyer_discord_id == session.user.discordId di kode server -- bukan
-- lewat RLS policy, karena tidak ada Supabase Auth session di sini
-- (login pakai NextAuth/Discord, terpisah dari auth Supabase).
alter table orders enable row level security;
-- Sengaja tidak ada policy apa pun ditambahkan di sini, jadi default-nya
-- semua akses via anon key ditolak. Ini konsisten dengan pola
-- supabaseAdmin yang sudah dipakai untuk operasi admin produk.
