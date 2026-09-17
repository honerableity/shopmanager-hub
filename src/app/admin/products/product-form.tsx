"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryType, Product, ProductType } from "@/lib/products";

import {
  createProduct,
  updateProduct,
  type CreateProductState,
  type UpdateProductState,
} from "./actions";
import { FormSchemaBuilder } from "./form-schema-builder";

const initialState: CreateProductState | UpdateProductState = {};

const DELIVERY_TYPE_OPTIONS: { value: DeliveryType; label: string; hint: string }[] = [
  {
    value: "filelink",
    label: "Link file",
    hint: "Begitu lunas, pembeli langsung lihat tombol buka link/file yang kamu isi di bawah.",
  },
  {
    value: "form",
    label: "Isi form",
    hint: "Pembeli wajib isi pertanyaan yang kamu tentukan sebelum QRIS dibuat. Kamu proses manual berdasar jawabannya.",
  },
  {
    value: "adminprocessed",
    label: "Diproses manual",
    hint: "Tidak ada form maupun link otomatis -- begitu lunas, kamu kirim produknya manual ke pembeli.",
  },
];

/**
 * Dipakai untuk form Tambah Produk (mode="create") dan Edit Produk
 * (mode="edit", butuh `product` existing). Field & validasi disatukan
 * di sini supaya kedua mode tidak drift beda field lagi -- perubahan
 * validasi cukup di actions.ts::parseProductForm.
 */
export function ProductForm({
  productTypes,
  product,
}: {
  productTypes: ProductType[];
  product?: Product & { is_active: boolean };
}) {
  const isEdit = Boolean(product);
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateProduct : createProduct,
    initialState
  );
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    product?.delivery_type ?? "filelink"
  );

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Produk" : "Tambah Produk"}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {isEdit && (
            <input type="hidden" name="product_id" value={product!.id} />
          )}

          <div className="space-y-2">
            <Label htmlFor="product_type_id">Kategori</Label>
            <select
              id="product_type_id"
              name="product_type_id"
              required
              defaultValue={product?.product_type_id}
              className="border-input dark:bg-input/30 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              {productTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nama produk</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={200}
              defaultValue={product?.name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug (opsional, wajib kalau produk ini kasih whitelist)
            </Label>
            <Input
              id="slug"
              name="slug"
              placeholder="contoh: vip-pass"
              pattern="[a-z0-9-]+"
              defaultValue={product?.slug ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Huruf kecil, angka, dan tanda strip saja. Dipakai sebagai
              identifier di API /api/roblox-check.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={product?.description ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price_idr">Harga (Rp)</Label>
            <Input
              id="price_idr"
              name="price_idr"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={product?.price_idr}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock">Stok (kosongkan = unlimited)</Label>
            <Input
              id="stock"
              name="stock"
              type="number"
              min={0}
              step={1}
              defaultValue={product?.stock ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">URL gambar</Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              placeholder="https://..."
              defaultValue={product?.image_url ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label>Jenis produk</Label>
            <input type="hidden" name="delivery_type" value={deliveryType} />
            <div className="space-y-2">
              {DELIVERY_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-2.5 rounded-md border p-3 cursor-pointer has-[:checked]:border-primary"
                >
                  <input
                    type="radio"
                    name="delivery_type_radio"
                    value={option.value}
                    checked={deliveryType === option.value}
                    onChange={() => setDeliveryType(option.value)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {deliveryType === "filelink" && (
            <div className="space-y-2">
              <Label htmlFor="download_url">Link download file</Label>
              <Input
                id="download_url"
                name="download_url"
                type="url"
                placeholder="https://drive.google.com/... atau https://mediafire.com/..."
                defaultValue={product?.download_url ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Link ini baru ditampilkan ke pembeli setelah pembayaran
                lunas.
              </p>
            </div>
          )}

          {deliveryType === "form" && (
            <FormSchemaBuilder defaultValue={product?.form_schema ?? []} />
          )}

          <div className="flex items-center gap-2">
            <input
              id="grants_whitelist"
              name="grants_whitelist"
              type="checkbox"
              defaultChecked={product?.grants_whitelist ?? false}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="grants_whitelist" className="font-normal">
              Beli produk ini memberi whitelist Roblox
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={product?.is_active ?? true}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="is_active" className="font-normal">
              Aktif (tampil di toko)
            </Label>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : "Simpan Produk"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
