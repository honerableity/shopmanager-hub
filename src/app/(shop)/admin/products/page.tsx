import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isAdmin } from "@/lib/admin";
import { getAdminProductList } from "@/lib/products";

import { DeleteProductButton } from "./delete-product-button";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function deliveryTypeLabel(deliveryType: string) {
  switch (deliveryType) {
    case "form":
      return "Form";
    case "adminprocessed":
      return "Manual";
    default:
      return "Link file";
  }
}

export default async function AdminProductsPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    redirect("/");
  }

  const catalog = await getAdminProductList();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <BackButton fallbackHref="/" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Kelola Produk</h1>
          <p className="text-sm text-muted-foreground">
            Cuma admin yang bisa melihat dan mengubah halaman ini.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">Tambah Produk</Link>
        </Button>
      </div>

      {catalog.map((category) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle>{category.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {category.products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada produk di kategori ini.
              </p>
            ) : (
              category.products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {product.name}{" "}
                      {!product.is_active && (
                        <Badge variant="secondary" className="ml-1">
                          Nonaktif
                        </Badge>
                      )}
                      {product.grants_whitelist && (
                        <Badge variant="outline" className="ml-1">
                          Whitelist
                        </Badge>
                      )}
                      <Badge variant="outline" className="ml-1">
                        {deliveryTypeLabel(product.delivery_type)}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRupiah(product.price_idr)} &middot; stok{" "}
                      {product.stock === null ? "unlimited" : product.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/products/${product.id}/edit`}>
                        Edit
                      </Link>
                    </Button>
                    <DeleteProductButton productId={product.id} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}