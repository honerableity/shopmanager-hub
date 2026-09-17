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
import { startCheckout, type StartCheckoutState } from "@/app/orders/actions";
import { FormAnswerDialog } from "@/components/form-answer-dialog";
import type { Product } from "@/lib/products";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const initialState: StartCheckoutState = {};

/**
 * `ownedOrderId`: kalau produk ini unlimited (stock null) dan buyer
 * yang login sudah pernah membelinya lunas, ini berisi id order lama
 * itu -- tombol jadi "Buka File" mengarah ke `/orders/[id]` alih-alih
 * memicu order baru. Untuk produk stok terbatas, selalu undefined
 * (boleh beli berkali-kali) walau riwayat pembeliannya ada.
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
    startCheckout,
    initialState
  );

  return (
    <Card className="overflow-hidden pt-0 gap-3">
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
      <CardContent className="flex-1 space-y-1">
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <span className="font-semibold">{formatRupiah(product.price_idr)}</span>

        {alreadyOwned ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/orders/${ownedOrderId}`}>Buka File</Link>
          </Button>
        ) : product.delivery_type === "form" ? (
          <FormAnswerDialog
            productId={product.id}
            productName={product.name}
            formSchema={product.form_schema}
            disabled={isOutOfStock}
          />
        ) : (
          <form action={formAction}>
            <input type="hidden" name="product_id" value={product.id} />
            <Button size="sm" type="submit" disabled={isOutOfStock || isPending}>
              {isOutOfStock ? "Habis" : isPending ? "Memproses..." : "Beli"}
            </Button>
          </form>
        )}
      </CardFooter>
    </Card>
  );
}
