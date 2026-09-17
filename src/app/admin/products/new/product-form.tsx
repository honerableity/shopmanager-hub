"use client";

import { useActionState } from "react";

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
import type { ProductType } from "@/lib/products";

import { createProduct, type CreateProductState } from "../actions";

const initialState: CreateProductState = {};

export function ProductForm({ productTypes }: { productTypes: ProductType[] }) {
  const [state, formAction, isPending] = useActionState(
    createProduct,
    initialState
  );

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle>Tambah Produk</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product_type_id">Kategori</Label>
            <select
              id="product_type_id"
              name="product_type_id"
              required
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
            <Input id="name" name="name" required maxLength={200} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" name="description" rows={3} />
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock">Stok (kosongkan = unlimited)</Label>
            <Input id="stock" name="stock" type="number" min={0} step={1} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">URL gambar</Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="download_url">Link download file</Label>
            <Input
              id="download_url"
              name="download_url"
              type="url"
              placeholder="https://drive.google.com/... atau https://mediafire.com/..."
            />
            <p className="text-xs text-muted-foreground">
              Link ini baru ditampilkan ke pembeli setelah pembayaran
              lunas.
            </p>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Menyimpan..." : "Simpan Produk"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}