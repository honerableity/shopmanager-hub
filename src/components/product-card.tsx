import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Product } from "@/lib/products";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * `ownedOrderId`: kalau produk ini unlimited (stock null) dan buyer
 * yang login sudah pernah membelinya lunas, ini berisi id order lama
 * itu -- tombol jadi "Buka File" mengarah ke `/orders/[id]` alih-alih
 * ke halaman detail. Untuk produk stok terbatas, selalu undefined
 * (boleh beli berkali-kali) walau riwayat pembeliannya ada.
 *
 * Card ini sengaja TIDAK punya jalan pintas "+ Keranjang" -- satu-
 * satunya cara menambahkan produk ke keranjang adalah lewat halaman
 * detail (`/product/[id]`), yang juga menampilkan deskripsi lengkap
 * dan review sebelum pembeli memutuskan. Seluruh card ini jadi satu
 * link besar ke halaman detail (kecuali tombol "Buka File" untuk
 * produk yang sudah dimiliki, yang memang bukan bagian dari alur
 * tambah-ke-keranjang).
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
        <CardContent className="flex-1 space-y-1">
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          <span className="font-semibold">
            {formatRupiah(product.price_idr)}
          </span>

          {alreadyOwned ? (
            <Button asChild size="sm" variant="secondary">
              {/* Link bersarang ke tujuan berbeda dari Link pembungkus
                  card -- stopPropagation supaya klik tombol ini tidak
                  ikut men-trigger navigasi ke halaman detail. */}
              <Link
                href={`/orders/${ownedOrderId}`}
                onClick={(e) => e.stopPropagation()}
              >
                Buka File
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {isOutOfStock ? "Stok habis" : "Lihat detail"}
            </span>
          )}
        </CardFooter>
      </Link>
    </Card>
  );
}
