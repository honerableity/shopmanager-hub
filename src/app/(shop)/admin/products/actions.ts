"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import type { DeliveryType, FormField } from "@/lib/products";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DELIVERY_TYPES: DeliveryType[] = ["filelink", "form", "adminprocessed"];

export type CreateProductState = {
  error?: string;
};

/**
 * Ambil & validasi field yang sama dipakai create dan update, supaya
 * aturan validasinya tidak dobel-tulis dan gampang tetap konsisten.
 * Mengembalikan { error } kalau invalid, atau { values } siap dipakai
 * untuk insert/update ke Supabase.
 */
function parseProductForm(formData: FormData):
  | { error: string }
  | {
      values: {
        product_type_id: string;
        name: string;
        slug: string | null;
        description: string | null;
        price_idr: number;
        image_url: string | null;
        download_url: string | null;
        stock: number | null;
        grants_whitelist: boolean;
        is_active: boolean;
        delivery_type: DeliveryType;
        form_schema: FormField[];
      };
    } {
  const productTypeId = formData.get("product_type_id");
  const name = formData.get("name");
  const slugRaw = formData.get("slug");
  const description = formData.get("description");
  const priceRaw = formData.get("price_idr");
  const imageUrl = formData.get("image_url");
  const downloadUrl = formData.get("download_url");
  const stockRaw = formData.get("stock");
  const grantsWhitelist = formData.get("grants_whitelist") === "on";
  const isActive = formData.get("is_active") === "on";
  const deliveryTypeRaw = formData.get("delivery_type");
  const formSchemaRaw = formData.get("form_schema");

  if (
    typeof productTypeId !== "string" ||
    !productTypeId ||
    typeof name !== "string" ||
    !name.trim() ||
    typeof priceRaw !== "string" ||
    !priceRaw
  ) {
    return { error: "Kategori, nama, dan harga wajib diisi." };
  }

  const price_idr = Number(priceRaw);
  if (!Number.isFinite(price_idr) || price_idr < 0) {
    return { error: "Harga tidak valid." };
  }

  let stock: number | null = null;
  if (typeof stockRaw === "string" && stockRaw.trim() !== "") {
    const parsed = Number(stockRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "Stok tidak valid." };
    }
    stock = parsed;
  }

  let slug: string | null = null;
  if (typeof slugRaw === "string" && slugRaw.trim() !== "") {
    const normalized = slugRaw.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      return {
        error: "Slug hanya boleh huruf kecil, angka, dan tanda -.",
      };
    }
    slug = normalized;
  }

  if (grantsWhitelist && !slug) {
    return {
      error: "Produk yang memberi whitelist wajib punya slug (dipakai API roblox-check).",
    };
  }

  const delivery_type: DeliveryType =
    typeof deliveryTypeRaw === "string" &&
    (DELIVERY_TYPES as string[]).includes(deliveryTypeRaw)
      ? (deliveryTypeRaw as DeliveryType)
      : "filelink";

  let form_schema: FormField[] = [];
  if (delivery_type === "form") {
    if (typeof formSchemaRaw !== "string" || !formSchemaRaw) {
      return { error: "Produk jenis form wajib punya minimal 1 pertanyaan." };
    }
    try {
      const parsedSchema = JSON.parse(formSchemaRaw);
      if (!Array.isArray(parsedSchema) || parsedSchema.length === 0) {
        return { error: "Produk jenis form wajib punya minimal 1 pertanyaan." };
      }
      form_schema = parsedSchema.map((field) => {
        if (
          typeof field !== "object" ||
          field === null ||
          typeof field.label !== "string" ||
          !field.label.trim()
        ) {
          throw new Error("invalid field");
        }
        return {
          label: field.label.trim().slice(0, 200),
          required: Boolean(field.required),
        };
      });
    } catch {
      return { error: "Pertanyaan form tidak valid." };
    }
  }

  return {
    values: {
      product_type_id: productTypeId,
      name: name.trim(),
      slug,
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      price_idr,
      image_url:
        typeof imageUrl === "string" && imageUrl.trim()
          ? imageUrl.trim()
          : null,
      download_url:
        typeof downloadUrl === "string" && downloadUrl.trim()
          ? downloadUrl.trim()
          : null,
      stock,
      grants_whitelist: grantsWhitelist,
      is_active: isActive,
      delivery_type,
      form_schema,
    },
  };
}

export async function createProduct(
  _prevState: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
  // Jangan pernah percaya UI (tombol disembunyikan di client) sebagai
  // satu-satunya proteksi -- cek admin ulang di server, di titik yang
  // benar-benar melakukan perubahan data.
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    return { error: "Kamu tidak punya akses untuk menambah produk." };
  }

  const parsed = parseProductForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { error } = await supabaseAdmin.from("products").insert(parsed.values);

  if (error) {
    if (error.message.includes("products_slug_idx")) {
      return { error: "Slug sudah dipakai produk lain." };
    }
    return { error: `Gagal menyimpan produk: ${error.message}` };
  }

  redirect("/admin/products");
}

export type UpdateProductState = {
  error?: string;
};

export async function updateProduct(
  _prevState: UpdateProductState,
  formData: FormData
): Promise<UpdateProductState> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    return { error: "Kamu tidak punya akses untuk mengubah produk." };
  }

  const productId = formData.get("product_id");
  if (typeof productId !== "string" || !productId) {
    return { error: "Produk tidak valid." };
  }

  const parsed = parseProductForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { error } = await supabaseAdmin
    .from("products")
    .update(parsed.values)
    .eq("id", productId);

  if (error) {
    if (error.message.includes("products_slug_idx")) {
      return { error: "Slug sudah dipakai produk lain." };
    }
    return { error: `Gagal mengubah produk: ${error.message}` };
  }

  redirect("/admin/products");
}

export type DeleteProductState = {
  error?: string;
};

/**
 * Hapus produk. Order yang sudah ada untuk produk ini TIDAK ikut
 * terhapus/berubah -- orders.download_url sudah menyimpan salinannya
 * sendiri sejak status paid, jadi pembeli lama tetap bisa buka file
 * lewat halaman order mereka walau produknya sudah dihapus dari toko.
 */
export async function deleteProduct(
  _prevState: DeleteProductState,
  formData: FormData
): Promise<DeleteProductState> {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    return { error: "Kamu tidak punya akses untuk menghapus produk." };
  }

  const productId = formData.get("product_id");
  if (typeof productId !== "string" || !productId) {
    return { error: "Produk tidak valid." };
  }

  const { error } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    return { error: `Gagal menghapus produk: ${error.message}` };
  }

  redirect("/admin/products");
}