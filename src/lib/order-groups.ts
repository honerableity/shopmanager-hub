import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createDeposit, getDepositStatus } from "@/lib/ramashop";
import { logPurchaseToDiscord } from "@/lib/purchase-log";
import {
  calculateDiscount,
  findVoucherByCode,
  pickBestVoucher,
  recordVoucherRedemption,
  validateVoucher,
  type PricedCartItem,
} from "@/lib/vouchers";
import type { Order } from "@/lib/orders";

// Sama threshold dengan lib/orders.ts -- disalin (bukan di-import)
// supaya kedua file tidak saling bergantung melingkar; kalau
// nilainya perlu diubah, ubah di dua tempat sekaligus.
const FREE_PRICE_THRESHOLD_IDR = 100;

export type OrderGroup = {
  id: string;
  buyer_discord_id: string;
  subtotal_idr: number;
  discount_idr: number;
  total_idr: number;
  voucher_id: string | null;
  voucher_code: string | null;
  deposit_id: string | null;
  total_amount: number | null;
  qr_image: string | null;
  qr_string: string | null;
  expired_at: string | null;
  status: "pending" | "paid" | "expired" | "failed";
  created_at: string;
  paid_at: string | null;
};

export type CheckoutItemInput = {
  productId: string;
  quantity: number;
  formResponses?: Record<string, string>;
};

/**
 * Satu baris produk yang sudah divalidasi & diambil ulang dari DB
 * (harga, delivery_type, dst) -- dipakai internal di createOrderGroup,
 * tidak pernah percaya angka yang dikirim dari client.
 */
type ResolvedItem = {
  productId: string;
  productTypeId: string;
  name: string;
  priceIdr: number;
  quantity: number;
  stock: number | null;
  isActive: boolean;
  deliveryType: "filelink" | "form" | "adminprocessed";
  formSchema: { label: string; required: boolean }[];
  downloadUrl: string | null;
  grantsWhitelist: boolean;
  formResponses?: Record<string, string>;
};

/**
 * Checkout: terima daftar item (dari keranjang ATAU dari tombol "Beli"
 * langsung dengan 1 item), kode voucher opsional, lalu:
 *  1. Ambil ulang semua data produk dari DB (harga, stok, delivery_type).
 *  2. Validasi tiap item (produk aktif, stok cukup, form wajib terisi).
 *  3. Kalau ada voucherCode, validasi & hitung diskon per item.
 *  4. Buat SATU order_group dengan SATU deposit QRIS untuk totalnya
 *     (atau langsung 'paid' kalau totalnya di bawah threshold gratis).
 *  5. Insert satu baris `orders` per item, semua menunjuk ke
 *     order_group yang sama.
 *
 * Aturan pembelian ulang produk unlimited (stock null, sudah pernah
 * dibeli lunas) TIDAK dicek di sini -- itu tanggung jawab pemanggil
 * (cart actions) untuk menyaring sebelum checkout, karena keranjang
 * bisa saja berisi campuran produk yang sudah/belum pernah dibeli.
 */
export async function createOrderGroup(
  items: CheckoutItemInput[],
  buyerDiscordId: string,
  buyerUsername: string,
  voucherCode?: string
): Promise<{ orderGroup?: OrderGroup; orders?: Order[]; error?: string }> {
  if (items.length === 0) {
    return { error: "Keranjang kosong." };
  }

  const productIds = items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select(
      "id, product_type_id, name, price_idr, stock, is_active, delivery_type, form_schema, download_url, grants_whitelist"
    )
    .in("id", productIds);

  if (productsError) {
    return { error: `Gagal memuat produk: ${productsError.message}` };
  }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  const resolved: ResolvedItem[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product || !product.is_active) {
      return { error: `Salah satu produk di keranjangmu sudah tidak dijual.` };
    }
    if (product.stock !== null && product.stock < item.quantity) {
      return { error: `Stok "${product.name}" tidak mencukupi.` };
    }

    let formResponsesToStore: Record<string, string> | undefined;
    if (product.delivery_type === "form") {
      const schema = (product.form_schema ?? []) as {
        label: string;
        required: boolean;
      }[];
      for (const field of schema) {
        const answer = item.formResponses?.[field.label]?.trim();
        if (field.required && !answer) {
          return {
            error: `Pertanyaan "${field.label}" untuk "${product.name}" wajib diisi.`,
          };
        }
      }
      formResponsesToStore = {};
      for (const field of schema) {
        const answer = item.formResponses?.[field.label]?.trim();
        if (answer) formResponsesToStore[field.label] = answer;
      }
    }

    resolved.push({
      productId: product.id,
      productTypeId: product.product_type_id,
      name: product.name,
      priceIdr: product.price_idr,
      quantity: item.quantity,
      stock: product.stock,
      isActive: product.is_active,
      deliveryType: product.delivery_type,
      formSchema: product.form_schema ?? [],
      downloadUrl: product.download_url,
      grantsWhitelist: product.grants_whitelist,
      formResponses: formResponsesToStore,
    });
  }

  const pricedItems: PricedCartItem[] = resolved.map((r) => ({
    productId: r.productId,
    productTypeId: r.productTypeId,
    priceIdr: r.priceIdr,
    quantity: r.quantity,
  }));

  const subtotalIdr = pricedItems.reduce(
    (sum, item) => sum + item.priceIdr * item.quantity,
    0
  );

  let voucherId: string | null = null;
  let voucherCodeToStore: string | null = null;
  let perProductDiscount: Record<string, number> = {};
  let discountIdr = 0;

  if (voucherCode && voucherCode.trim()) {
    const validation = await validateVoucher(voucherCode, buyerDiscordId, pricedItems);
    if (!validation.ok) {
      return { error: validation.error };
    }
    const discount = calculateDiscount(validation.voucher, pricedItems);
    voucherId = validation.voucher.id;
    voucherCodeToStore = validation.voucher.code;
    perProductDiscount = discount.perProductDiscountIdr;
    discountIdr = discount.totalDiscountIdr;
  }

  const totalIdr = Math.max(0, subtotalIdr - discountIdr);
  const isFree = totalIdr < FREE_PRICE_THRESHOLD_IDR;

  let orderGroup: OrderGroup;

  if (isFree) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("order_groups")
      .insert({
        buyer_discord_id: buyerDiscordId,
        subtotal_idr: subtotalIdr,
        discount_idr: discountIdr,
        total_idr: totalIdr,
        voucher_id: voucherId,
        voucher_code: voucherCodeToStore,
        deposit_id: `free-${crypto.randomUUID()}`,
        total_amount: 0,
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return { error: `Gagal menyimpan order: ${insertError.message}` };
    }
    orderGroup = inserted as OrderGroup;
  } else {
    let deposit;
    try {
      deposit = await createDeposit(totalIdr);
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Gagal membuat pembayaran QRIS, coba lagi.",
      };
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("order_groups")
      .insert({
        buyer_discord_id: buyerDiscordId,
        subtotal_idr: subtotalIdr,
        discount_idr: discountIdr,
        total_idr: totalIdr,
        voucher_id: voucherId,
        voucher_code: voucherCodeToStore,
        deposit_id: deposit.depositId,
        total_amount: deposit.totalAmount,
        qr_image: deposit.qrImage,
        qr_string: deposit.qrString,
        expired_at: deposit.expiredAt,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      return { error: `Gagal menyimpan order: ${insertError.message}` };
    }
    orderGroup = inserted as OrderGroup;
  }

  // Insert satu baris `orders` per item, semua menunjuk order_group
  // yang sama. Untuk order gratis, langsung 'paid' + efek samping
  // (stok, whitelist) diterapkan sekarang -- sama pola dengan
  // createOrder single-item lama. Untuk order berbayar, semua item
  // dibuat 'pending' dan efek sampingnya baru terjadi saat
  // syncOrderGroupStatus menandai lunas.
  const insertedOrders: Order[] = [];
  for (const item of resolved) {
    const itemDiscount = perProductDiscount[item.productId] ?? 0;

    const { data: orderRow, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        product_id: item.productId,
        buyer_discord_id: buyerDiscordId,
        price_idr: item.priceIdr * item.quantity,
        discount_idr: itemDiscount,
        order_group_id: orderGroup.id,
        deposit_id: `group-${orderGroup.id}-${item.productId}-${crypto.randomUUID()}`,
        total_amount: item.priceIdr * item.quantity - itemDiscount,
        qr_image: null,
        qr_string: null,
        expired_at: orderGroup.expired_at ?? new Date().toISOString(),
        status: isFree ? "paid" : "pending",
        paid_at: isFree ? new Date().toISOString() : null,
        download_url: isFree ? item.downloadUrl : null,
        form_responses: item.formResponses ?? null,
      })
      .select()
      .single();

    if (orderError) {
      return { error: `Gagal menyimpan item order: ${orderError.message}` };
    }
    insertedOrders.push(orderRow as Order);

    if (isFree) {
      if (item.stock !== null) {
        await supabaseAdmin
          .from("products")
          .update({ stock: Math.max(0, item.stock - item.quantity) })
          .eq("id", item.productId);
      }
      if (item.grantsWhitelist) {
        await grantWhitelistIfEligibleForOrder(orderRow as Order);
      }
    }

    await logPurchaseToDiscord({
      buyerUsername,
      buyerDiscordId,
      productName: item.name,
      deliveryType: item.deliveryType,
      formResponses: item.formResponses ?? null,
    });
  }

  if (isFree && voucherId) {
    await recordVoucherRedemption(voucherId, orderGroup.id, buyerDiscordId);
  }

  return { orderGroup, orders: insertedOrders };
}

async function grantWhitelistIfEligibleForOrder(order: Order): Promise<void> {
  const { data: link } = await supabaseAdmin
    .from("user_roblox_links")
    .select("roblox_user_id")
    .eq("discord_id", order.buyer_discord_id)
    .maybeSingle();

  if (!link) return;

  await supabaseAdmin.from("whitelist_entries").upsert(
    {
      order_id: order.id,
      product_id: order.product_id,
      buyer_discord_id: order.buyer_discord_id,
      roblox_user_id: link.roblox_user_id,
    },
    { onConflict: "order_id" }
  );
}

export async function getOwnedOrderGroup(
  orderGroupId: string,
  buyerDiscordId: string
): Promise<OrderGroup | null> {
  const { data, error } = await supabaseAdmin
    .from("order_groups")
    .select("*")
    .eq("id", orderGroupId)
    .eq("buyer_discord_id", buyerDiscordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat order: ${error.message}`);
  }
  return data as OrderGroup | null;
}

export async function getOrdersForGroup(orderGroupId: string): Promise<Order[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("order_group_id", orderGroupId);

  if (error) {
    throw new Error(`Gagal memuat item order: ${error.message}`);
  }
  return (data ?? []) as Order[];
}

/**
 * Sinkronkan status order_group dengan Rama Shop (sama pola dengan
 * syncOrderStatus di lib/orders.ts, tapi beroperasi di level group).
 * Begitu lunas, semua baris `orders` di dalam group ini ikut
 * ditandai paid + efek sampingnya (download_url, stok, whitelist)
 * diterapkan per item, dan voucher (kalau ada) dicatat terpakai.
 */
export async function syncOrderGroupStatus(group: OrderGroup): Promise<OrderGroup> {
  if (group.status !== "pending") {
    return group;
  }
  if (!group.deposit_id) {
    return group; // seharusnya tidak terjadi (grup gratis selalu langsung 'paid')
  }

  const depositStatus = await getDepositStatus(group.deposit_id);

  if (depositStatus.status === "pending") {
    return group;
  }

  if (depositStatus.status === "expired") {
    const { data, error } = await supabaseAdmin
      .from("order_groups")
      .update({ status: "expired" })
      .eq("id", group.id)
      .eq("status", "pending")
      .select()
      .single();

    if (error) throw new Error(`Gagal update order: ${error.message}`);

    // Ikut tandai semua order item di dalamnya expired juga, supaya
    // halaman riwayat/order tidak menampilkan item yang "menggantung"
    // pending padahal group-nya sudah expired.
    await supabaseAdmin
      .from("orders")
      .update({ status: "expired" })
      .eq("order_group_id", group.id)
      .eq("status", "pending");

    return (data as OrderGroup) ?? group;
  }

  return markOrderGroupPaid(group);
}

async function markOrderGroupPaid(group: OrderGroup): Promise<OrderGroup> {
  const { data, error } = await supabaseAdmin
    .from("order_groups")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", group.id)
    .eq("status", "pending") // guard race polling ganda, sama pola dengan markOrderPaid
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal update order: ${error.message}`);
  }

  if (!data) {
    // Sudah diproses request polling lain barusan -- baca ulang.
    const { data: refetched, error: refetchError } = await supabaseAdmin
      .from("order_groups")
      .select("*")
      .eq("id", group.id)
      .single();
    if (refetchError) {
      throw new Error(`Gagal memuat ulang order: ${refetchError.message}`);
    }
    return refetched as OrderGroup;
  }

  const orders = await getOrdersForGroup(group.id);

  for (const order of orders) {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("download_url, stock, grants_whitelist")
      .eq("id", order.product_id)
      .maybeSingle();

    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        download_url: product?.download_url ?? null,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pending");

    if (product?.stock !== null && product?.stock !== undefined) {
      await supabaseAdmin
        .from("products")
        .update({ stock: Math.max(0, product.stock - 1) })
        .eq("id", order.product_id);
    }

    if (product?.grants_whitelist) {
      await grantWhitelistIfEligibleForOrder({
        ...order,
        status: "paid",
      });
    }
  }

  if (data.voucher_id) {
    await recordVoucherRedemption(data.voucher_id, data.id, data.buyer_discord_id);
  }

  return data as OrderGroup;
}

/**
 * Validasi kode voucher untuk preview di halaman checkout (tanpa
 * commit apapun). Mengembalikan breakdown diskon supaya UI bisa
 * tampilkan potongan harga sebelum pembeli klik bayar.
 */
export async function previewVoucher(
  code: string,
  buyerDiscordId: string,
  items: CheckoutItemInput[]
) {
  const products = await supabaseAdmin
    .from("products")
    .select("id, product_type_id, price_idr")
    .in(
      "id",
      items.map((i) => i.productId)
    );

  if (products.error) {
    return { ok: false as const, error: "Gagal memuat produk." };
  }

  const productMap = new Map((products.data ?? []).map((p) => [p.id, p]));
  const pricedItems: PricedCartItem[] = items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      return {
        productId: item.productId,
        productTypeId: product.product_type_id,
        priceIdr: product.price_idr,
        quantity: item.quantity,
      };
    })
    .filter((i): i is PricedCartItem => i !== null);

  const validation = await validateVoucher(code, buyerDiscordId, pricedItems);
  if (!validation.ok) {
    return { ok: false as const, error: validation.error };
  }

  const discount = calculateDiscount(validation.voucher, pricedItems);
  return { ok: true as const, voucher: validation.voucher, discount };
}

// Re-exported supaya pemanggil di UI tidak perlu import langsung dari
// lib/vouchers untuk kasus sederhana (pilih voucher terbaik dari
// beberapa kandidat kode yang diinput user).
export { findVoucherByCode, pickBestVoucher };
