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
import type { DeliveryType } from "@/lib/products";

import { pollOrderStatus } from "../actions";

// Rama Shop punya cache/rate-limit ~10 detik per pengecekan status di
// sisi mereka -- jangan poll lebih cepat dari itu.
const POLL_INTERVAL_MS = 10_000;

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OrderStatusView({
  order: initialOrder,
  deliveryType,
}: {
  order: Order;
  deliveryType: DeliveryType;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (order.status !== "pending") return;

    timerRef.current = setInterval(async () => {
      setIsChecking(true);
      try {
        const updated = await pollOrderStatus(order.id);
        setOrder(updated);
      } catch {
        // Diamkan -- coba lagi di siklus polling berikutnya.
      } finally {
        setIsChecking(false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [order.status, order.id]);

  return (
    <Card className="max-w-sm w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Pembayaran</span>
          <StatusBadge status={order.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.status === "pending" && order.qr_image && (
          <>
            <div className="relative aspect-square w-full bg-white rounded-md overflow-hidden">
              <Image
                src={order.qr_image}
                alt="QRIS"
                fill
                unoptimized
                className="object-contain p-2"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan QRIS ini dan bayar tepat{" "}
              <span className="font-semibold text-foreground">
                {formatRupiah(order.total_amount)}
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

        {order.status === "paid" && order.download_url && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Pembayaran berhasil. File kamu siap diunduh, link ini bisa
              dibuka kapan saja lewat halaman ini.
            </p>
            <Button asChild className="w-full">
              <a
                href={order.download_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka File
              </a>
            </Button>
          </div>
        )}

        {order.status === "paid" && !order.download_url && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {deliveryType === "form"
                ? "Pembayaran berhasil. Jawaban form kamu sudah diterima admin dan sedang diproses."
                : "Pembayaran berhasil. Admin akan segera memproses dan mengirimkan produkmu."}
            </p>
            {order.form_responses &&
              Object.keys(order.form_responses).length > 0 && (
                <div className="rounded-md border p-3 text-left space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Jawaban yang kamu kirim:
                  </p>
                  {Object.entries(order.form_responses).map(
                    ([label, answer]) => (
                      <p key={label} className="text-xs">
                        <span className="text-muted-foreground">
                          {label}:
                        </span>{" "}
                        {answer}
                      </p>
                    )
                  )}
                </div>
              )}
          </div>
        )}

        {order.status === "expired" && (
          <p className="text-sm text-muted-foreground text-center">
            QRIS sudah kedaluwarsa sebelum pembayaran masuk. Silakan
            kembali ke toko dan beli lagi untuk mendapat QRIS baru.
          </p>
        )}

        {order.status === "failed" && (
          <p className="text-sm text-muted-foreground text-center">
            Terjadi masalah dengan order ini. Hubungi admin kalau kamu
            sudah terlanjur membayar.
          </p>
        )}

        {order.status === "revoked" && (
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              Akses ke produk ini sudah dicabut oleh admin.
            </p>
            {order.revoked_reason && (
              <p className="text-xs text-muted-foreground">
                Alasan: {order.revoked_reason}
              </p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <BackButton fallbackHref="/" className="w-full" />
      </CardFooter>
    </Card>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  switch (status) {
    case "paid":
      return <Badge>Lunas</Badge>;
    case "pending":
      return <Badge variant="secondary">Menunggu pembayaran</Badge>;
    case "expired":
      return <Badge variant="destructive">Kedaluwarsa</Badge>;
    case "failed":
      return <Badge variant="destructive">Gagal</Badge>;
    case "revoked":
      return <Badge variant="destructive">Dicabut</Badge>;
  }
}
