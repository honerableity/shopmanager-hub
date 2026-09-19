"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DiscountType, VoucherScope } from "@/lib/vouchers";

export type VoucherFormState = { error?: string };

const SCOPES: VoucherScope[] = ["all", "catalog", "product"];
const DISCOUNT_TYPES: DiscountType[] = ["percent", "fixed"];

function parseVoucherForm(formData: FormData):
  | { error: string }
  | {
      values: {
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
      };
    } {
  const code = formData.get("code");
  const scopeRaw = formData.get("scope");
  const scopeId = formData.get("scope_id");
  const discountTypeRaw = formData.get("discount_type");
  const discountValueRaw = formData.get("discount_value");
  const minPurchaseRaw = formData.get("min_purchase_idr");
  const startsAtRaw = formData.get("starts_at");
  const endsAtRaw = formData.get("ends_at");
  const maxRedemptionsRaw = formData.get("max_redemptions");
  const singleUsePerUser = formData.get("single_use_per_user") === "on";
  const isActive = formData.get("is_active") === "on";

  if (typeof code !== "string" || !code.trim()) {
    return { error: "Kode voucher wajib diisi." };
  }
  if (typeof scopeRaw !== "string" || !SCOPES.includes(scopeRaw as VoucherScope)) {
    return { error: "Scope voucher tidak valid." };
  }
  const scope = scopeRaw as VoucherScope;

  if (scope !== "all" && (typeof scopeId !== "string" || !scopeId)) {
    return {
      error:
        scope === "catalog"
          ? "Pilih katalog untuk voucher scope katalog."
          : "Pilih produk untuk voucher scope produk.",
    };
  }

  if (
    typeof discountTypeRaw !== "string" ||
    !DISCOUNT_TYPES.includes(discountTypeRaw as DiscountType)
  ) {
    return { error: "Jenis diskon tidak valid." };
  }
  const discountType = discountTypeRaw as DiscountType;

  const discountValue = Number(discountValueRaw);
  if (!discountValue || discountValue <= 0) {
    return { error: "Nilai diskon harus lebih dari 0." };
  }
  if (discountType === "percent" && discountValue > 100) {
    return { error: "Diskon persen maksimal 100." };
  }

  const minPurchase =
    typeof minPurchaseRaw === "string" && minPurchaseRaw.trim()
      ? Number(minPurchaseRaw)
      : null;
  const maxRedemptions =
    typeof maxRedemptionsRaw === "string" && maxRedemptionsRaw.trim()
      ? Number(maxRedemptionsRaw)
      : null;

  const startsAt =
    typeof startsAtRaw === "string" && startsAtRaw
      ? new Date(startsAtRaw).toISOString()
      : null;
  const endsAt =
    typeof endsAtRaw === "string" && endsAtRaw
      ? new Date(endsAtRaw).toISOString()
      : null;

  return {
    values: {
      code: code.trim(),
      scope,
      scope_id: scope === "all" ? null : (scopeId as string),
      discount_type: discountType,
      discount_value: discountValue,
      min_purchase_idr: minPurchase,
      starts_at: startsAt,
      ends_at: endsAt,
      max_redemptions: maxRedemptions,
      single_use_per_user: singleUsePerUser,
      is_active: isActive,
    },
  };
}

export async function createVoucher(
  _prevState: VoucherFormState,
  formData: FormData
): Promise<VoucherFormState> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    return { error: "Bukan admin." };
  }

  const parsed = parseVoucherForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { error } = await supabaseAdmin.from("vouchers").insert(parsed.values);
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "Kode voucher ini sudah dipakai."
        : `Gagal membuat voucher: ${error.message}`,
    };
  }

  redirect("/admin/vouchers");
}

export async function updateVoucher(
  voucherId: string,
  _prevState: VoucherFormState,
  formData: FormData
): Promise<VoucherFormState> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    return { error: "Bukan admin." };
  }

  const parsed = parseVoucherForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { error } = await supabaseAdmin
    .from("vouchers")
    .update(parsed.values)
    .eq("id", voucherId);

  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "Kode voucher ini sudah dipakai."
        : `Gagal memperbarui voucher: ${error.message}`,
    };
  }

  redirect("/admin/vouchers");
}

export async function deleteVoucher(voucherId: string): Promise<void> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    throw new Error("Bukan admin.");
  }

  // voucher_redemptions.voucher_id tidak ON DELETE CASCADE (lihat
  // 005_cart_and_vouchers.sql) supaya riwayat pemakaian tetap ada
  // walau kodenya dihapus -- jadi hapus voucher akan gagal kalau
  // pernah dipakai. Untuk kasus itu, matikan (is_active=false) lewat
  // form edit alih-alih menghapus.
  const { error } = await supabaseAdmin.from("vouchers").delete().eq("id", voucherId);
  if (error) {
    throw new Error(
      "Gagal menghapus voucher (mungkin sudah pernah dipakai) -- matikan saja lewat Edit."
    );
  }
  revalidatePath("/admin/vouchers");
}
