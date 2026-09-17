import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase pakai SERVICE ROLE KEY -- bypass RLS sepenuhnya.
 * HANYA dipakai di server (server actions, route handlers) untuk operasi
 * admin: create/edit/delete produk, cek blacklist saat checkout, dll.
 *
 * Import "server-only" di baris pertama sengaja dipasang supaya build
 * GAGAL kalau file ini ke-import dari client component -- mencegah
 * service role key bocor ke bundle browser.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);