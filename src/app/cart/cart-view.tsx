"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CartItemWithProduct } from "@/lib/cart";

import {
  checkoutCart,
  previewCartVoucher,
  removeFromCart,
  updateCartQuantity,
  type CheckoutFormState,
  type VoucherPreviewState,
} from "./actions";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const initialCheckoutState: CheckoutFormState = {};
const initialVoucherState: VoucherPreviewState = {};

export function CartView({ items }: { items: CartItemWithProduct[] }) {
  const [isPending, startTransition] = useTransition();
  const [checkoutState, checkoutAction, isCheckingOut] = useActionState(
    checkoutCart,
    initialCheckoutState
  );
  const [voucherState, voucherAction, isPreviewingVoucher] = useActionState(
    previewCartVoucher,
    initialVoucherState
  );
  const [voucherCode, setVoucherCode] = useState("");

  const validItems = items.filter((item) => item.isActive);
  const subtotal = validItems.reduce(
    (sum, item) => sum + item.priceIdr * item.quantity,
    0
  );
  const previewedDiscount =
    voucherState.success && voucherState.discountIdr !== undefined
      ? voucherState.discountIdr
      : 0;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Keranjangmu masih kosong.{" "}
          <Link href="/" className="underline">
            Yuk belanja
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.index} className={!item.isActive ? "opacity-60" : ""}>
            <CardContent className="flex items-center gap-3 py-3">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {!item.isActive ? (
                  <p className="text-xs text-destructive">
                    Produk ini sudah tidak dijual
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {formatRupiah(item.priceIdr)}
                  </p>
                )}
                {item.formResponses && (
                  <p className="text-xs text-muted-foreground">
                    Form sudah diisi
                  </p>
                )}
              </div>

              {item.isActive && !item.formResponses ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(() =>
                        updateCartQuantity(item.index, item.quantity - 1)
                      )
                    }
                  >
                    -
                  </Button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      isPending || (item.stock !== null && item.quantity >= item.stock)
                    }
                    onClick={() =>
                      startTransition(() =>
                        updateCartQuantity(item.index, item.quantity + 1)
                      )
                    }
                  >
                    +
                  </Button>
                </div>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => removeFromCart(item.index))
                }
              >
                Hapus
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Kode Voucher</p>
            <div className="flex gap-2">
              <Input
                name="voucher_code_input"
                placeholder="Masukkan kode"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                className="flex-1"
              />
              <form action={voucherAction}>
                <input type="hidden" name="voucher_code" value={voucherCode} />
                <Button type="submit" variant="outline" disabled={isPreviewingVoucher}>
                  {isPreviewingVoucher ? "Mengecek..." : "Cek"}
                </Button>
              </form>
            </div>
            {voucherState.error && (
              <p className="mt-1.5 text-sm text-destructive">{voucherState.error}</p>
            )}
            {voucherState.success && (
              <p className="mt-1.5 text-sm text-green-500">
                Kode {voucherState.code} berlaku -- potongan{" "}
                {formatRupiah(voucherState.discountIdr ?? 0)}.
              </p>
            )}
          </div>

          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            {previewedDiscount > 0 && (
              <div className="flex justify-between text-green-500">
                <span>Diskon</span>
                <span>-{formatRupiah(previewedDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total (estimasi)</span>
              <span>{formatRupiah(Math.max(0, subtotal - previewedDiscount))}</span>
            </div>
          </div>

          <form action={checkoutAction}>
            <input
              type="hidden"
              name="voucher_code"
              value={voucherState.success ? voucherState.code ?? "" : voucherCode}
            />
            {checkoutState.error && (
              <p className="mb-2 text-sm text-destructive">{checkoutState.error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isCheckingOut || validItems.length === 0}
            >
              {isCheckingOut ? "Memproses..." : "Checkout"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
