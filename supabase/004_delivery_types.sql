-- Fitur baru: jenis produk (delivery type), independen dari katalog
-- (product_types: Roblox/Other). Terinspirasi dari konsep delivery_type
-- di bot Discord referensi, disederhanakan jadi 3 tipe:
--
--   - filelink: seperti sekarang -- begitu lunas, download_url produk
--     disalin ke orders.download_url dan pembeli lihat tombol buka
--     file. Ini DEFAULT untuk semua produk existing (tidak mengubah
--     perilaku produk yang sudah ada).
--   - form: pembeli WAJIB isi form custom (field ditentukan admin per
--     produk lewat form_schema) SEBELUM order/QRIS dibuat. Jawabannya
--     disimpan di orders.form_responses. Order tetap 'processing'
--     setelah lunas -- admin proses manual berdasar jawaban form.
--   - adminprocessed: sama seperti form tapi tanpa form sama sekali --
--     order lunas, admin proses & kirim manual ke pembeli.
--
-- (messageid dari bot referensi sengaja TIDAK dibuat tipe terpisah --
-- digabung ke filelink, karena secara alur sama saja: satu kolom teks
-- bebas ("link" boleh diisi link ATAU isi file/teks lain), tanpa perlu
-- integrasi Discord message fetch yang bikin lebih rumit.)

alter table products
  add column if not exists delivery_type text not null default 'filelink';

alter table products
  add constraint products_delivery_type_check
  check (delivery_type in ('filelink', 'form', 'adminprocessed'));

-- Array of { label: string, required: boolean }, hanya dipakai kalau
-- delivery_type = 'form'. Disimpan sebagai jsonb (bukan tabel
-- terpisah) karena strukturnya sederhana dan selalu dibaca/ditulis
-- utuh sebagai satu kesatuan per produk -- sama pola dengan
-- `specifications`/`api_config` di bot referensi.
alter table products
  add column if not exists form_schema jsonb not null default '[]'::jsonb;

-- Jawaban pembeli untuk form_schema produk terkait, disalin ke order
-- saat checkout (BUKAN saat lunas) karena form harus diisi sebelum
-- QRIS dibuat -- lihat komentar di src/lib/orders.ts::createOrder.
-- Bentuk: { "<label>": "<jawaban>" }.
alter table orders
  add column if not exists form_responses jsonb;
