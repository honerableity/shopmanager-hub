-- Fitur baru: keranjang (cart) + checkout multi-item + voucher/kode
-- diskon.
--
-- Keranjang sendiri TIDAK disimpan di sini -- itu cuma cookie di
-- browser (lihat src/lib/cart.ts), jadi tidak butuh tabel. Yang butuh
-- tabel baru cuma dua hal:
--   1. order_groups: satu baris per "sesi checkout" yang menghasilkan
--      SATU deposit QRIS untuk TOTAL harga gabungan banyak produk.
--      orders.order_group_id menunjuk ke sini -- satu order_group bisa
--      punya banyak baris orders (satu per produk yang dibeli dalam
--      checkout itu).
--   2. vouchers + voucher_redemptions: kode diskon dan pencatatan
--      pemakaiannya (untuk menegakkan single-use per user & kuota
--      total).
--
-- Pola RLS: sama seperti orders/whitelist_entries -- tidak ada policy
-- publik sama sekali, semua akses lewat supabaseAdmin di server.

-- 1. vouchers: definisi kode diskon oleh admin. Dibuat lebih dulu
--    (sebelum order_groups) karena order_groups.voucher_id menunjuk
--    ke sini.
create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null,

  -- 'all'    -> berlaku ke semua produk (kode A)
  -- 'catalog'-> berlaku ke semua produk di satu product_types (kode B),
  --             scope_id wajib diisi product_type_id
  -- 'product'-> berlaku ke satu produk tertentu (kode C),
  --             scope_id wajib diisi product id
  scope text not null check (scope in ('all', 'catalog', 'product')),
  scope_id uuid,

  discount_type text not null check (discount_type in ('percent', 'fixed')),
  -- percent: 1-100. fixed: nominal rupiah, dipotong dari harga item
  -- yang kena scope (tidak pernah bikin harga jadi negatif -- lihat
  -- pembulatan di src/lib/vouchers.ts).
  discount_value integer not null check (discount_value > 0),

  min_purchase_idr integer, -- null = tanpa syarat minimal belanja

  -- Periode aktif, keduanya opsional & independen dari max_redemptions
  -- di bawah (kode "diskon global" biasanya isi ini, kosongkan
  -- max_redemptions; kode "giveaway" biasanya sebaliknya -- tapi boleh
  -- diisi keduanya sekaligus, mana yang tercapai duluan yang berlaku).
  starts_at timestamptz,
  ends_at timestamptz,

  -- Kuota TOTAL pemakaian oleh siapapun. null = tanpa batas kuota.
  max_redemptions integer,

  -- Batas pemakaian PER USER. false (default) = user yang sama boleh
  -- pakai kode ini berkali-kali (selama syarat lain terpenuhi). true =
  -- tiap discord_id maksimal 1x redeem sukses untuk kode ini.
  single_use_per_user boolean not null default false,

  is_active boolean not null default true, -- matikan manual tanpa hapus (riwayat redemption tetap ada)

  created_at timestamptz not null default now()
);

-- Kode dicek case-insensitive (lihat findActiveVoucherByCode) tapi
-- unique index tetap di kolom asli -- pembuatan kode baru divalidasi
-- di server (bukan constraint DB) supaya pesan errornya bisa lebih
-- ramah ("kode sudah dipakai") daripada raw constraint violation.
create unique index if not exists vouchers_code_idx
  on vouchers (code);

alter table vouchers enable row level security;

-- 2. order_groups: menampung info deposit QRIS gabungan.
--    Strukturnya sengaja mirror kolom-kolom pembayaran yang sudah ada
--    di `orders` (deposit_id, qr_image, dst) karena secara konsep ini
--    "naik satu level" dari yang sebelumnya nempel di tiap order --
--    checkout satu produk pun sekarang selalu bikin satu order_group
--    (dengan satu baris orders di dalamnya), supaya tidak perlu dua
--    jalur kode berbeda untuk single-item vs bulk buy.
create table if not exists order_groups (
  id uuid primary key default gen_random_uuid(),
  buyer_discord_id text not null,

  subtotal_idr integer not null, -- jumlah price_idr semua item, sebelum diskon
  discount_idr integer not null default 0,
  total_idr integer not null, -- subtotal - discount, sebelum kode unik Rama Shop

  voucher_id uuid references vouchers(id),
  voucher_code text, -- disalin (bukan cuma id) supaya riwayat tetap jelas walau voucher diedit/dihapus nanti

  -- Sama seperti orders lama: kalau total_idr < threshold gratis,
  -- kolom2 di bawah ini semua null dan status langsung 'paid'.
  deposit_id text unique,
  total_amount integer, -- total_idr + kode unik dari Rama Shop
  qr_image text,
  qr_string text,
  expired_at timestamptz,

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'failed')),

  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists order_groups_buyer_discord_id_idx
  on order_groups (buyer_discord_id);

alter table order_groups enable row level security;

-- 3. orders: tambah pointer ke order_groups, dan simpan potongan
--    harga per-item (proporsional dari discount_idr total group) biar
--    tiap baris order tetap punya angka yang konsisten dengan yang
--    sungguh dibayar, tanpa harus balik query order_groups tiap kali
--    mau tampilkan riwayat pembelian.
alter table orders
  add column if not exists order_group_id uuid references order_groups(id);

alter table orders
  add column if not exists discount_idr integer not null default 0;

create index if not exists orders_order_group_id_idx
  on orders (order_group_id);

-- 4. voucher_redemptions: satu baris per checkout yang BERHASIL pakai
--    voucher (dibuat bersamaan dengan order_group yang sudah 'paid',
--    atau -- untuk produk gratis -- yang langsung dibuat 'paid').
--    Dipakai untuk hitung ulang max_redemptions terpakai & cek
--    single_use_per_user, jadi HARUS insert di titik yang sama dengan
--    yang menandai order_group jadi paid (lihat markOrderGroupPaid),
--    bukan saat checkout dimulai -- supaya order yang gagal/expired
--    tidak ikut memakan kuota.
create table if not exists voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references vouchers(id),
  order_group_id uuid not null references order_groups(id),
  buyer_discord_id text not null,
  created_at timestamptz not null default now(),

  unique (order_group_id) -- satu order_group max 1 voucher terpakai
);

create index if not exists voucher_redemptions_voucher_id_idx
  on voucher_redemptions (voucher_id);

create index if not exists voucher_redemptions_buyer_voucher_idx
  on voucher_redemptions (voucher_id, buyer_discord_id);

alter table voucher_redemptions enable row level security;

-- 5. product_reviews: rating + komentar dari pembeli. Hanya buyer yang
--    punya minimal satu order 'paid' untuk produk ini yang boleh
--    menulis (ditegakkan di server -- lihat lib/reviews.ts -- bukan di
--    constraint DB, karena butuh join ke orders untuk mengecek itu).
create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  buyer_discord_id text not null,
  buyer_username text not null, -- disalin saat submit supaya tetap tampil walau nama Discord berubah belakangan
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),

  -- Satu pembeli cuma boleh satu review per produk -- submit ulang
  -- akan meng-update (upsert), bukan bikin baris baru.
  unique (product_id, buyer_discord_id)
);

create index if not exists product_reviews_product_id_idx
  on product_reviews (product_id);

alter table product_reviews enable row level security;
