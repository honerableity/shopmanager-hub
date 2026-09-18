"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addProductToCart, type AddToCartState } from "@/app/cart/actions";
import { AddToCartButton } from "@/app/product/[id]/add-to-cart-button";
import type { Product } from "@/lib/products";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const initialState: AddToCartState = {};

/**
 * `ownedOrderId`: kalau produk ini unlimited (stock null) dan buyer
 * yang login sudah pernah membelinya lunas, ini berisi id order lama
 * itu -- tombol jadi "Buka File" mengarah ke `/orders/[id]` alih-alih
 * memicu order baru. Untuk produk stok terbatas, selalu undefined
 * (boleh beli berkali-kali) walau riwayat pembeliannya ada.
 *
 * Klik gambar/nama produk membuka halaman detail (`/product/[id]`,
 * yang juga menampilkan review) -- tombol di card ini sendiri cuma
 * jalan pintas "+ Keranjang" tanpa pindah halaman (lihat konfirmasi
 * di lib/order-groups.ts terkait alur marketplace).
 */
export function ProductCard({
  product,
  ownedOrderId,
}: {
  product: Product;
  ownedOrderId?: string;
}) {
  const isOutOfStock = product.stock !== null && product.stock <= 0;
  const alreadyOwned = product.stock === null && Boolean(ownedOrderId);

  const [state, formAction, isPending] = useActionState(
    addProductToCart,
    initialState
  );

  return (
    <Card className="overflow-hidden pt-0 gap-3">
      <Link href={`/product/${product.id}`} className="contents">
        <div className="relative aspect-square w-full bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
              Tidak ada gambar
            </div>
          )}
          {isOutOfStock && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              Stok habis
            </Badge>
          )}
          {!isOutOfStock && product.stock !== null && product.stock <= 5 && (
            <Badge variant="secondary" className="absolute top-2 right-2">
              Sisa {product.stock}
            </Badge>
          )}
        </div>
        <CardHeader>
          <CardTitle className="text-base leading-snug">
            {product.name}
          </CardTitle>
        </CardHeader>
      </Link>
      <CardContent className="flex-1 space-y-1">
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state.success && (
          <p className="text-sm text-green-500">Ditambahkan ke keranjang.</p>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <span className="font-semibold">{formatRupiah(product.price_idr)}</span>

        {alreadyOwned ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/orders/${ownedOrderId}`}>Buka File</Link>
          </Button>
        ) : product.delivery_type === "form" ? (
          <AddToCartButton
            productId={product.id}
            productName={product.name}
            formSchema={product.form_schema}
            isForm
            disabled={isOutOfStock}
          />
        ) : (
          <form action={formAction}>
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="quantity" value={1} />
            <Button size="sm" type="submit" disabled={isOutOfStock || isPending}>
              {isOutOfStock ? "Habis" : isPending ? "Menambahkan..." : "+ Keranjang"}
            </Button>
          </form>
        )}
      </CardFooter>
    </Card>
  );
}
