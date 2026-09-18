-- Fitur baru:
--   1. Link akun Discord <-> Roblox User ID (diisi manual oleh user di
--      halaman profil, bukan verifikasi OAuth Roblox).
--   2. Flag di products untuk menandai produk mana yang memberi akses
--      whitelist Roblox saat dibeli.
--   3. Tabel whitelist_entries: dicatat begitu order status jadi paid
--      untuk produk yang grants_whitelist = true.
--   4. RLS: semua tabel baru sengaja tanpa policy publik, sama pola
--      dengan orders -- semua akses lewat supabaseAdmin di server.

-- 1. Link Roblox per akun Discord. Satu Discord ID = satu Roblox User ID
--    (kalau user ganti Roblox ID, cukup update baris ini, tidak bikin
--    baris baru -- riwayat whitelist lama tetap mengacu ke
--    roblox_user_id yang tersimpan di whitelist_entries saat itu,
--    lihat komentar di bawah).
create table if not exists user_roblox_links (
  discord_id text primary key,
  roblox_user_id text not null,
  updated_at timestamptz not null default now()
);

alter table user_roblox_links enable row level security;

-- 2. Tandai produk mana yang memberi whitelist Roblox saat dibeli, dan
--    tambahkan slug per-produk supaya endpoint /api/roblox-check (dan
--    endpoint whitelist-check lain belakangan) bisa dipanggil dengan
--    identifier yang stabil & rapi, bukan UUID mentah. Beda dari
--    product_types.slug yang sudah ada (itu slug KATEGORI, bukan
--    produk individual).
--
--    Tidak perlu field universe/place ID di sini -- satu ShopManager
--    ini diasumsikan untuk satu game/dunia Roblox saja untuk sekarang.
--    Kalau nanti perlu multi-game, tambahkan kolom roblox_universe_id
--    di sini dan di whitelist_entries.
alter table products
  add column if not exists grants_whitelist boolean not null default false;

alter table products
  add column if not exists slug text;

create unique index if not exists products_slug_idx
  on products (slug) where slug is not null;

-- 3. Baris whitelist, satu per (produk, buyer) yang lunas. roblox_user_id
--    DISALIN dari user_roblox_links tepat saat order jadi paid (bukan
--    di-join saat query) -- supaya kalau user ganti Roblox ID
--    setelahnya, whitelist yang sudah diberikan untuk pembelian lama
--    tidak ikut berubah/hilang. Selaras dengan pola download_url yang
--    disalin ke orders.download_url di 002_purchase_feature.sql.
create table if not exists whitelist_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  product_id uuid not null references products(id),
  buyer_discord_id text not null,
  roblox_user_id text not null,
  created_at timestamptz not null default now(),

  unique (order_id)
);

create index if not exists whitelist_entries_roblox_user_id_idx
  on whitelist_entries (roblox_user_id);

create index if not exists whitelist_entries_product_id_idx
  on whitelist_entries (product_id);

alter table whitelist_entries enable row level security;
-- Sengaja tidak ada policy publik apa pun -- akses lewat supabaseAdmin
-- di server saja (server action untuk simpan link Roblox, dan route
-- handler /api/roblox-check untuk baca).
