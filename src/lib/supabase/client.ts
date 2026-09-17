import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase pakai anon key -- hanya bisa baca data yang policy-nya
 * publicly readable (lihat supabase/001_init_products.sql). Pakai ini di
 * halaman/komponen yang menampilkan data ke user (shop page, dll).
 *
 * JANGAN pakai client ini untuk insert/update/delete -- RLS akan menolak.
 * Untuk operasi admin (create/edit produk), pakai
 * src/lib/supabase/admin.ts (service role key, server-only).
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);