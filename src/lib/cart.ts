import "server-only";

import { cookies } from "next/headers";

/**
 * Keranjang belanja disimpan sebagai satu cookie JSON di browser
 * pembeli -- BUKAN di database. Alasan: keranjang itu draft yang boleh
 * hilang kapan saja (beda dari `orders`/`order_groups` yang harus
 * tahan lama), dan tidak perlu diakses lintas device. Ini juga
 * menghindari perlu tabel `carts` + housekeeping baris yang tidak
 * pernah di-checkout.
 *
 * Isi cookie HANYA productId + quantity + (untuk produk delivery_type
 * 'form') jawaban form yang sudah diisi saat add-to-cart -- harga,
 * nama produk, dst SELALU diambil ulang dari DB saat checkout (jangan
 * pernah percaya harga yang "nempel" di cart lama, sama prinsipnya
 * dengan createOrder yang sudah ada).
 */

const CART_COOKIE = "midas_cart";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 hari

export type CartItem = {
  productId: string;
  quantity: number;
  formResponses?: Record<string, string>;
};

export async function getCart(): Promise<CartItem[]> {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item?.productId === "string" &&
        typeof item?.quantity === "number" &&
        item.quantity > 0
    );
  } catch {
    // Cookie korup/format lama -- anggap keranjang kosong daripada
    // melempar error ke seluruh halaman.
    return [];
  }
}

async function saveCart(items: CartItem[]): Promise<void> {
  const store = await cookies();
  if (items.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, JSON.stringify(items), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

/**
 * Tambah produk ke keranjang. Kalau produk (tanpa form_responses,
 * yaitu delivery_type != 'form') sudah ada di keranjang, quantity-nya
 * digabung -- bukan bikin baris baru. Produk delivery_type='form'
 * SELALU jadi entri baru (tidak digabung) karena tiap entri punya
 * jawaban form sendiri yang bisa beda-beda; quantity-nya selalu 1.
 */
export async function addToCart(
  productId: string,
  quantity: number,
  formResponses?: Record<string, string>
): Promise<void> {
  const items = await getCart();

  if (formResponses) {
    items.push({ productId, quantity: 1, formResponses });
  } else {
    const existing = items.find(
      (item) => item.productId === productId && !item.formResponses
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ productId, quantity });
    }
  }

  await saveCart(items);
}

export async function updateCartItemQuantity(
  index: number,
  quantity: number
): Promise<void> {
  const items = await getCart();
  if (index < 0 || index >= items.length) return;

  if (quantity <= 0) {
    items.splice(index, 1);
  } else {
    items[index].quantity = quantity;
  }

  await saveCart(items);
}

export async function removeCartItem(index: number): Promise<void> {
  const items = await getCart();
  items.splice(index, 1);
  await saveCart(items);
}

export async function clearCart(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}

export type CartItemWithProduct = CartItem & {
  index: number;
  name: string;
  priceIdr: number;
  imageUrl: string | null;
  stock: number | null;
  isActive: boolean;
};

/**
 * Gabungkan isi cookie keranjang dengan data produk TERKINI dari DB
 * (harga, nama, stok) -- dipakai di halaman /cart untuk render.
 * Item yang produknya sudah dihapus/nonaktif tetap disertakan (supaya
 * pembeli bisa lihat & hapus sendiri dari keranjang) tapi ditandai
 * isActive=false sehingga UI bisa nonaktifkan checkout untuk item itu.
 */
export async function getCartWithProductDetails(): Promise<CartItemWithProduct[]> {
  const items = await getCart();
  if (items.length === 0) return [];

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, price_idr, image_url, stock, is_active")
    .in(
      "id",
      items.map((i) => i.productId)
    );

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  return items.map((item, index) => {
    const product = productMap.get(item.productId);
    return {
      ...item,
      index,
      name: product?.name ?? "Produk tidak ditemukan",
      priceIdr: product?.price_idr ?? 0,
      imageUrl: product?.image_url ?? null,
      stock: product?.stock ?? null,
      isActive: product?.is_active ?? false,
    };
  });
}
