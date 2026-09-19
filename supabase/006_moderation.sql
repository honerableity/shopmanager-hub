-- Fitur moderasi:
--   1. Ban akun Discord: dicek di proxy/middleware pada SETIAP request
--      (bukan cuma saat login) supaya user yang sedang login lalu
--      di-ban langsung tidak bisa akses halaman apa pun lagi, dan
--      sesinya langsung dipaksa logout (lihat src/proxy.ts + halaman
--      /banned).
--   2. Revoke produk: menandai satu order (pembelian) sebagai dicabut
--      -- pembeli kehilangan akses ke file/whitelist tanpa perlu
--      menghapus baris order-nya (riwayat tetap ada untuk audit).
--
-- Pola RLS sama seperti tabel lain: tanpa policy publik, semua akses
-- lewat supabaseAdmin di server.

-- 1. banned_discord_users: satu baris = satu akun Discord yang diban.
--    discord_id sebagai primary key -- ban/unban cukup insert/delete
--    baris ini, tidak perlu flag boolean terpisah.
create table if not exists banned_discord_users (
  discord_id text primary key,
  reason text,
  banned_by text not null, -- discord_id admin yang melakukan ban, untuk audit
  banned_at timestamptz not null default now()
);

alter table banned_discord_users enable row level security;
-- Sengaja tanpa policy publik -- dicek lewat supabaseAdmin, baik dari
-- proxy.ts (Edge Runtime, tetap pakai service role key) maupun dari
-- server actions/action admin.

-- 2. Revoke produk: order yang statusnya sudah 'paid' bisa ditandai
--    'revoked' oleh admin -- pembeli kehilangan akses (halaman order &
--    whitelist_entries terkait ikut dianggap tidak berlaku, lihat
--    src/lib/moderation.ts::revokeOrder). Order yang di-revoke TIDAK
--    dihapus -- riwayat pembelian & alasan revoke tetap tersimpan.
alter table orders
  drop constraint if exists orders_status_check;

alter table orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'expired', 'failed', 'revoked'));

alter table orders
  add column if not exists revoked_at timestamptz;

alter table orders
  add column if not exists revoked_reason text;

alter table orders
  add column if not exists revoked_by text; -- discord_id admin yang melakukan revoke
