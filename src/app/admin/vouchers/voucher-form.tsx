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
import type { ProductType } from "@/lib/products";
import type { DiscountType, Voucher, VoucherScope } from "@/lib/vouchers";

import {
  createVoucher,
  updateVoucher,
  type VoucherFormState,
} from "./actions";

const initialState: VoucherFormState = {};

const selectClass =
  "border-input dark:bg-input/30 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** Format ISO -> value yang dimengerti <input type="datetime-local"> */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function VoucherForm({
  voucher,
  productTypes,
  products,
}: {
  voucher?: Voucher;
  productTypes: ProductType[];
  products: { id: string; name: string }[];
}) {
  const isEdit = Boolean(voucher);
  const action = isEdit
    ? updateVoucher.bind(null, voucher!.id)
    : createVoucher;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [scope, setScope] = useState<VoucherScope>(voucher?.scope ?? "all");
  const [discountType, setDiscountType] = useState<DiscountType>(
    voucher?.discount_type ?? "percent"
  );

  return (
    <Card className="max-w-lg w-full">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Voucher" : "Tambah Voucher"}</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Kode</Label>
            <Input
              id="code"
              name="code"
              required
              defaultValue={voucher?.code}
              placeholder="misal: DISKON10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scope">Berlaku untuk</Label>
            <select
              id="scope"
              name="scope"
              className={selectClass}
              value={scope}
              onChange={(e) => setScope(e.target.value as VoucherScope)}
            >
              <option value="all">Semua produk</option>
              <option value="catalog">Satu katalog</option>
              <option value="product">Satu produk</option>
            </select>
          </div>

          {scope === "catalog" && (
            <div className="space-y-2">
              <Label htmlFor="scope_id">Katalog</Label>
              <select
                id="scope_id"
                name="scope_id"
                required
                className={selectClass}
                defaultValue={voucher?.scope === "catalog" ? voucher.scope_id ?? undefined : undefined}
              >
                {productTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "product" && (
            <div className="space-y-2">
              <Label htmlFor="scope_id_product">Produk</Label>
              <select
                id="scope_id_product"
                name="scope_id"
                required
                className={selectClass}
                defaultValue={voucher?.scope === "product" ? voucher.scope_id ?? undefined : undefined}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="discount_type">Jenis diskon</Label>
              <select
                id="discount_type"
                name="discount_type"
                className={selectClass}
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
              >
                <option value="percent">Persen (%)</option>
                <option value="fixed">Nominal (Rp)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_value">
                Nilai {discountType === "percent" ? "(%)" : "(Rp)"}
              </Label>
              <Input
                id="discount_value"
                name="discount_value"
                type="number"
                min={1}
                max={discountType === "percent" ? 100 : undefined}
                required
                defaultValue={voucher?.discount_value}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_purchase_idr">
              Minimal belanja (Rp, opsional)
            </Label>
            <Input
              id="min_purchase_idr"
              name="min_purchase_idr"
              type="number"
              min={0}
              defaultValue={voucher?.min_purchase_idr ?? undefined}
              placeholder="Kosongkan jika tidak ada syarat"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="starts_at">Mulai berlaku (opsional)</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalInputValue(voucher?.starts_at ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends_at">Berakhir (opsional)</Label>
              <Input
                id="ends_at"
                name="ends_at"
                type="datetime-local"
                defaultValue={toLocalInputValue(voucher?.ends_at ?? null)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_redemptions">
              Kuota total pemakaian (opsional, untuk giveaway)
            </Label>
            <Input
              id="max_redemptions"
              name="max_redemptions"
              type="number"
              min={1}
              defaultValue={voucher?.max_redemptions ?? undefined}
              placeholder="Kosongkan jika tanpa batas"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="single_use_per_user"
              name="single_use_per_user"
              type="checkbox"
              defaultChecked={voucher?.single_use_per_user ?? false}
              className="h-4 w-4"
            />
            <Label htmlFor="single_use_per_user" className="!mt-0">
              Hanya 1x pemakaian per pembeli
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={voucher?.is_active ?? true}
              className="h-4 w-4"
            />
            <Label htmlFor="is_active" className="!mt-0">
              Aktif
            </Label>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Voucher"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
