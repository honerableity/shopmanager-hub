import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type VoucherScope = "all" | "catalog" | "product";
export type DiscountType = "percent" | "fixed";

export type Voucher = {
  id: string;
  code: string;
  scope: VoucherScope;
  scope_id: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase_idr: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  single_use_per_user: boolean;
  is_active: boolean;
  created_at: string;
};

/**
 * Item keranjang minimal yang dibutuhkan untuk hitung diskon. Dipakai
 * baik dari cart (banyak item) maupun dari beli-langsung (satu item)
 * supaya logic diskonnya sama persis di kedua alur.
 */
export type PricedCartItem = {
  productId: string;
  productTypeId: string;
  priceIdr: number;
  quantity: number;
};

/**
 * Cari voucher aktif berdasar kode (case-insensitive -- pembeli bisa
 * saja ketik huruf kecil semua walau admin buat kodenya UPPERCASE).
 * Mengembalikan null kalau kode tidak ada ATAU is_active = false --
 * sengaja tidak dibedakan pesannya dengan "tidak ditemukan" supaya
 * tidak membocorkan daftar kode yang pernah ada tapi sudah dimatikan.
 */
export async function findVoucherByCode(code: string): Promise<Voucher | null> {
  const { data, error } = await supabaseAdmin
    .from("vouchers")
    .select("*")
    .ilike("code", code.trim())
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat voucher: ${error.message}`);
  }
  if (!data || !data.is_active) {
    return null;
  }
  return data as Voucher;
}

/**
 * Hitung berapa kali voucher ini sudah berhasil diredeem (total, lintas
 * semua user) dan oleh buyer tertentu. Dipakai untuk menegakkan
 * max_redemptions dan single_use_per_user.
 *
 * Sengaja hitung dari voucher_redemptions (bukan simpan counter di
 * kolom vouchers) supaya tetap akurat walau ada race condition dua
 * checkout nyaris bersamaan -- lihat pengecekan ulang di
 * redeemVoucherForOrderGroup yang jadi titik penegakan sebenarnya.
 */
async function getRedemptionCounts(
  voucherId: string,
  buyerDiscordId: string
): Promise<{ total: number; byBuyer: number }> {
  const { count: total, error: totalError } = await supabaseAdmin
    .from("voucher_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("voucher_id", voucherId);

  if (totalError) {
    throw new Error(`Gagal memuat riwayat voucher: ${totalError.message}`);
  }

  const { count: byBuyer, error: buyerError } = await supabaseAdmin
    .from("voucher_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("voucher_id", voucherId)
    .eq("buyer_discord_id", buyerDiscordId);

  if (buyerError) {
    throw new Error(`Gagal memuat riwayat voucher: ${buyerError.message}`);
  }

  return { total: total ?? 0, byBuyer: byBuyer ?? 0 };
}

/**
 * Total harga item yang KENA scope voucher ini (dipakai untuk syarat
 * min_purchase_idr -- syaratnya dihitung dari nilai belanja yang
 * relevan dengan voucher, bukan total keranjang seluruhnya, supaya
 * kode khusus produk/katalog tetap masuk akal dipakai bareng item lain
 * di luar scope-nya).
 */
function scopedSubtotal(voucher: Voucher, items: PricedCartItem[]): number {
  return items
    .filter((item) => itemMatchesScope(voucher, item))
    .reduce((sum, item) => sum + item.priceIdr * item.quantity, 0);
}

function itemMatchesScope(voucher: Voucher, item: PricedCartItem): boolean {
  if (voucher.scope === "all") return true;
  if (voucher.scope === "catalog") return item.productTypeId === voucher.scope_id;
  return item.productId === voucher.scope_id; // scope === "product"
}

export type VoucherValidationResult =
  | { ok: true; voucher: Voucher }
  | { ok: false; error: string };

/**
 * Validasi kode voucher terhadap isi keranjang SAAT INI (belum
 * menandai kode terpakai -- itu baru terjadi di
 * redeemVoucherForOrderGroup saat order_group jadi paid). Dipakai di
 * halaman checkout untuk preview diskon sebelum bayar.
 */
export async function validateVoucher(
  code: string,
  buyerDiscordId: string,
  items: PricedCartItem[]
): Promise<VoucherValidationResult> {
  const voucher = await findVoucherByCode(code);
  if (!voucher) {
    return { ok: false, error: "Kode voucher tidak ditemukan." };
  }

  const now = Date.now();
  if (voucher.starts_at && now < Date.parse(voucher.starts_at)) {
    return { ok: false, error: "Voucher ini belum aktif." };
  }
  if (voucher.ends_at && now > Date.parse(voucher.ends_at)) {
    return { ok: false, error: "Voucher ini sudah kedaluwarsa." };
  }

  const matching = items.filter((item) => itemMatchesScope(voucher, item));
  if (matching.length === 0) {
    return {
      ok: false,
      error: "Voucher ini tidak berlaku untuk produk di keranjangmu.",
    };
  }

  const relevantSubtotal = scopedSubtotal(voucher, items);
  if (voucher.min_purchase_idr && relevantSubtotal < voucher.min_purchase_idr) {
    return {
      ok: false,
      error: `Minimal belanja untuk voucher ini adalah ${new Intl.NumberFormat(
        "id-ID",
        { style: "currency", currency: "IDR", maximumFractionDigits: 0 }
      ).format(voucher.min_purchase_idr)}.`,
    };
  }

  const counts = await getRedemptionCounts(voucher.id, buyerDiscordId);
  if (voucher.max_redemptions !== null && counts.total >= voucher.max_redemptions) {
    return { ok: false, error: "Kuota pemakaian voucher ini sudah habis." };
  }
  if (voucher.single_use_per_user && counts.byBuyer >= 1) {
    return { ok: false, error: "Kamu sudah pernah memakai voucher ini." };
  }

  return { ok: true, voucher };
}

export type DiscountBreakdown = {
  totalDiscountIdr: number;
  perProductDiscountIdr: Record<string, number>; // productId -> total potongan (semua qty produk itu)
};

/**
 * Hitung potongan harga per produk untuk voucher yang SUDAH divalidasi
 * (panggil validateVoucher dulu). Dipisah dari validateVoucher supaya
 * pemanggil bisa validasi banyak kode dulu (kalau user input beberapa
 * kode) lalu baru hitung breakdown untuk kode yang benar-benar dipilih.
 *
 * Pembulatan: diskon per unit dibulatkan ke bawah (Math.floor) supaya
 * total diskon tidak pernah melebihi apa yang seharusnya, dan tidak
 * pernah membuat harga jadi negatif.
 */
export function calculateDiscount(
  voucher: Voucher,
  items: PricedCartItem[]
): DiscountBreakdown {
  const perProductDiscountIdr: Record<string, number> = {};
  let totalDiscountIdr = 0;

  for (const item of items) {
    if (!itemMatchesScope(voucher, item)) continue;

    const lineTotal = item.priceIdr * item.quantity;
    let lineDiscount: number;
    if (voucher.discount_type === "percent") {
      lineDiscount = Math.floor((lineTotal * voucher.discount_value) / 100);
    } else {
      // fixed: nilai voucher dipotong PER UNIT, bukan langsung dari
      // line total -- supaya "diskon Rp10.000" konsisten artinya per
      // barang walau quantity-nya beda-beda.
      const perUnit = Math.min(voucher.discount_value, item.priceIdr);
      lineDiscount = perUnit * item.quantity;
    }

    lineDiscount = Math.min(lineDiscount, lineTotal); // jaga-jaga, tidak pernah negatif
    perProductDiscountIdr[item.productId] =
      (perProductDiscountIdr[item.productId] ?? 0) + lineDiscount;
    totalDiscountIdr += lineDiscount;
  }

  return { totalDiscountIdr, perProductDiscountIdr };
}

/**
 * Dari beberapa kode yang lolos validasi, pilih SATU yang paling
 * menguntungkan pembeli (total diskon terbesar). Pemanggil sudah
 * memfilter hanya kode yang ok:true dari validateVoucher.
 */
export function pickBestVoucher(
  candidates: { voucher: Voucher; discount: DiscountBreakdown }[]
): { voucher: Voucher; discount: DiscountBreakdown } | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) =>
    current.discount.totalDiscountIdr > best.discount.totalDiscountIdr
      ? current
      : best
  );
}

/**
 * Catat pemakaian voucher untuk satu order_group yang baru jadi paid.
 * HARUS dipanggil tepat setelah order_group berhasil ditandai paid
 * (sama titik dengan markOrderGroupPaid di lib/orders.ts) -- bukan
 * lebih awal -- supaya order yang gagal/expired tidak ikut memakan
 * kuota max_redemptions atau single_use_per_user.
 *
 * Idempoten lewat unique(order_group_id): panggilan kedua untuk
 * order_group yang sama akan gagal insert karena constraint, diabaikan
 * dengan upsert onConflict (no-op, tidak dobel-catat).
 */
export async function recordVoucherRedemption(
  voucherId: string,
  orderGroupId: string,
  buyerDiscordId: string
): Promise<void> {
  await supabaseAdmin.from("voucher_redemptions").upsert(
    {
      voucher_id: voucherId,
      order_group_id: orderGroupId,
      buyer_discord_id: buyerDiscordId,
    },
    { onConflict: "order_group_id" }
  );
}

export async function getAdminVoucherById(voucherId: string): Promise<Voucher | null> {
  const { data, error } = await supabaseAdmin
    .from("vouchers")
    .select("*")
    .eq("id", voucherId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat voucher: ${error.message}`);
  }
  return data as Voucher | null;
}

/**
 * Ambil semua voucher untuk halaman admin (termasuk yang tidak aktif),
 * beserta jumlah pemakaian sejauh ini -- dipakai buat tampilkan
 * "42 / 50 terpakai" di daftar admin.
 */
export async function getAdminVoucherList(): Promise<
  (Voucher & { redemption_count: number })[]
> {
  const { data: vouchers, error } = await supabaseAdmin
    .from("vouchers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat voucher: ${error.message}`);
  }

  const result: (Voucher & { redemption_count: number })[] = [];
  for (const voucher of vouchers ?? []) {
    const { count } = await supabaseAdmin
      .from("voucher_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", voucher.id);
    result.push({ ...(voucher as Voucher), redemption_count: count ?? 0 });
  }
  return result;
}
