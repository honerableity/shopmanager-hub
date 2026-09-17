"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * Tombol "Kembali" generik -- dipasang di semua halaman selain
 * halaman utama (shop page). Pakai router.back() (bukan Link statis
 * ke rute tertentu) supaya benar-benar kembali ke halaman sebelumnya
 * di riwayat browser, apapun itu (mis. dari /admin/products/[id]/edit
 * balik ke /admin/products, bukan selalu ke "/").
 *
 * fallbackHref dipakai kalau halaman ini dibuka langsung (mis. lewat
 * link luar / reload) sehingga tidak ada riwayat back di tab ini --
 * router.back() akan no-op, jadi kita sediakan tujuan cadangan.
 */
export function BackButton({
  fallbackHref = "/",
  className,
}: {
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
    >
      <ArrowLeft />
      Kembali
    </Button>
  );
}
