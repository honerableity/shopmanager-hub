import { supabase } from "@/lib/supabase/client";

export type ProductType = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
};

export type DeliveryType = "filelink" | "form" | "adminprocessed";

export type FormField = {
  label: string;
  required: boolean;
};

export type Product = {
  id: string;
  product_type_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price_idr: number;
  image_url: string | null;
  stock: number | null; // null = unlimited
  sort_order: number;
  download_url: string | null;
  grants_whitelist: boolean;
  delivery_type: DeliveryType;
  form_schema: FormField[];
};

export type ProductTypeWithProducts = ProductType & {
  products: Product[];
};

/**
 * Ambil semua kategori (product_types) beserta produk aktif di
 * dalamnya, terurut sesuai sort_order. Dipakai di shop page untuk
 * render per-kategori (Roblox, Other, ...).
 *
 * Pakai anon client (read-only) -- aman dipanggil dari Server Component
 * karena cuma baca data yang memang publicly readable lewat RLS.
 */
export async function getShopCatalog(): Promise<ProductTypeWithProducts[]> {
  const { data: types, error: typesError } = await supabase
    .from("product_types")
    .select("id, slug, name, sort_order")
    .order("sort_order", { ascending: true });

  if (typesError) {
    throw new Error(`Gagal memuat kategori produk: ${typesError.message}`);
  }

  // Sengaja TIDAK select download_url di sini -- ini query publik
  // (anon client) yang dipakai untuk render shop page ke semua orang,
  // termasuk yang belum beli. Link download hanya boleh terlihat
  // lewat tabel `orders` setelah status paid (lihat src/lib/orders.ts),
  // jadi field-nya diisi `null` supaya tipe Product tetap konsisten
  // tanpa membuka linknya secara publik.
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, product_type_id, name, slug, description, price_idr, image_url, stock, sort_order, grants_whitelist, delivery_type, form_schema"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (productsError) {
    throw new Error(`Gagal memuat produk: ${productsError.message}`);
  }

  return (types ?? []).map((type) => ({
    ...type,
    products: (products ?? []).map((p) => ({ ...p, download_url: null })).filter(
      (p) => p.product_type_id === type.id
    ),
  }));
}

/**
 * Ambil daftar kategori saja (id, slug, name), tanpa produk. Dipakai di
 * form create/edit product untuk isi pilihan dropdown kategori.
 */
export async function getProductTypes(): Promise<ProductType[]> {
  const { data, error } = await supabase
    .from("product_types")
    .select("id, slug, name, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat kategori produk: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Ambil SEMUA produk (termasuk yang is_active = false) per kategori,
 * dipakai di halaman admin (list produk) -- beda dari getShopCatalog
 * yang cuma ambil produk aktif untuk ditampilkan ke pembeli.
 *
 * Pakai supabaseAdmin (service role) karena produk nonaktif tidak
 * lolos RLS policy anon. Panggil ini HANYA dari halaman/action yang
 * sudah dicek isAdmin() di server.
 */
export async function getAdminProductList(): Promise<
  (ProductType & { products: (Product & { is_active: boolean })[] })[]
> {
  // Import di sini (bukan di top-level) supaya file ini tetap aman
  // dipakai dari client component lewat getShopCatalog/getProductTypes --
  // admin client di-load lazily cuma saat fungsi admin ini dipanggil.
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data: types, error: typesError } = await supabaseAdmin
    .from("product_types")
    .select("id, slug, name, sort_order")
    .order("sort_order", { ascending: true });

  if (typesError) {
    throw new Error(`Gagal memuat kategori produk: ${typesError.message}`);
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select(
      "id, product_type_id, name, slug, description, price_idr, image_url, stock, sort_order, is_active, download_url, grants_whitelist, delivery_type, form_schema"
    )
    .order("sort_order", { ascending: true });

  if (productsError) {
    throw new Error(`Gagal memuat produk: ${productsError.message}`);
  }

  return (types ?? []).map((type) => ({
    ...type,
    products: (products ?? []).filter((p) => p.product_type_id === type.id),
  }));
}

/**
 * Ambil delivery_type satu produk saja, dipakai halaman order untuk
 * pilih pesan status yang tepat begitu lunas -- tidak butuh field lain
 * jadi cukup query kecil ini alih-alih getAdminProductById yang lebih
 * berat. Pakai supabaseAdmin (bukan anon client) karena harus tetap
 * bisa dibaca meski produk sudah is_active=false atau sudah dihapus
 * (return null kalau produk sudah tidak ada sama sekali).
 */
export async function getDeliveryTypeForProduct(
  productId: string
): Promise<DeliveryType | null> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("delivery_type")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat jenis produk: ${error.message}`);
  }

  return (data?.delivery_type as DeliveryType) ?? null;
}

/**
 * Ambil satu produk (termasuk field admin-only seperti download_url,
 * is_active) untuk halaman edit. HANYA dipanggil dari halaman/action
 * yang sudah dicek isAdmin() di server, sama seperti
 * getAdminProductList.
 */
export async function getAdminProductById(
  productId: string
): Promise<(Product & { is_active: boolean }) | null> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      "id, product_type_id, name, slug, description, price_idr, image_url, stock, sort_order, is_active, download_url, grants_whitelist, delivery_type, form_schema"
    )
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat produk: ${error.message}`);
  }

  return data;
}