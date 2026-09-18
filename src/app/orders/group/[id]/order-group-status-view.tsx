"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Order } from "@/lib/orders";
import type { OrderGroup } from "@/lib/order-groups";

import { pollOrderGroupStatus } from "../../actions";

const POLL_INTERVAL_MS = 10_000;

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OrderGroupStatusView({
  group: initialGroup,
  orders: initialOrders,
}: {
  group: OrderGroup;
  orders: Order[];
}) {
  const [group, setGroup] = useState(initialGroup);
  const [orders, setOrders] = useState(initialOrders);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (group.status !== "pending") return;

    timerRef.current = setInterval(async () => {
      setIsChecking(true);
      try {
        const updated = await pollOrderGroupStatus(group.id);
        setGroup(updated.group);
        setOrders(updated.orders);
      } catch {
        // Diamkan -- coba lagi di siklus polling berikutnya.
      } finally {
        setIsChecking(false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [group.status, group.id]);

  return (
    <Card className="max-w-sm w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Pembayaran</span>
          <StatusBadge status={group.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {group.status === "pending" && group.qr_image && (
          <>
            <div className="relative aspect-square w-full bg-white rounded-md overflow-hidden">
              <Image
                src={group.qr_image}
                alt="QRIS"
                fill
                unoptimized
                className="object-contain p-2"
              />
            </div>
            <div className="space-y-1 text-sm">
              {group.discount_idr > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatRupiah(group.subtotal_idr)}</span>
                </div>
              )}
              {group.discount_idr > 0 && (
                <div className="flex justify-between text-green-500">
                  <span>Diskon {group.voucher_code ? `(${group.voucher_code})` : ""}</span>
                  <span>-{formatRupiah(group.discount_idr)}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan QRIS ini dan bayar tepat{" "}
              <span className="font-semibold text-foreground">
                {formatRupiah(group.total_amount ?? 0)}
              </span>{" "}
              (termasuk kode unik). Halaman ini otomatis update begitu
              pembayaran masuk.
            </p>
            {isChecking && (
              <p className="text-xs text-muted-foreground text-center">
                Mengecek status...
              </p>
            )}
          </>
        )}

        {group.status !== "pending" && (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderItemRow key={order.id} order={order} />
            ))}
          </div>
        )}

        {group.status === "expired" && (
          <p className="text-sm text-muted-foreground text-center">
            QRIS sudah kedaluwarsa sebelum pembayaran masuk. Silakan
            kembali ke toko dan checkout lagi untuk mendapat QRIS baru.
          </p>
        )}

        {group.status === "failed" && (
          <p className="text-sm text-muted-foreground text-center">
            Terjadi masalah dengan order ini. Hubungi admin kalau kamu
            sudah terlanjur membayar.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <BackButton fallbackHref="/" className="w-full" />
      </CardFooter>
    </Card>
  );
}

function OrderItemRow({ order }: { order: Order }) {
  return (
    <div className="rounded-md border p-3 space-y-1.5 text-sm">
      {order.status === "paid" && order.download_url ? (
        <Button asChild size="sm" className="w-full">
          <a href={order.download_url} target="_blank" rel="noopener noreferrer">
            Buka File
          </a>
        </Button>
      ) : order.status === "paid" ? (
        <p className="text-xs text-muted-foreground">
          Sedang diproses admin.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Menunggu pembayaran.</p>
      )}
      {order.form_responses && Object.keys(order.form_responses).length > 0 && (
        <div className="space-y-1 border-t pt-1.5">
          {Object.entries(order.form_responses).map(([label, answer]) => (
            <p key={label} className="text-xs">
              <span className="text-muted-foreground">{label}:</span> {answer}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderGroup["status"] }) {
  switch (status) {
    case "paid":
      return <Badge>Lunas</Badge>;
    case "pending":
      return <Badge variant="secondary">Menunggu pembayaran</Badge>;
    case "expired":
      return <Badge variant="destructive">Kedaluwarsa</Badge>;
    case "failed":
      return <Badge variant="destructive">Gagal</Badge>;
  }
}
