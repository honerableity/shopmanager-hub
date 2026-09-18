import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isAdmin } from "@/lib/admin";
import { getAdminVoucherList } from "@/lib/vouchers";

import { DeleteVoucherButton } from "./delete-voucher-button";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function scopeLabel(scope: string) {
  switch (scope) {
    case "all":
      return "Semua produk";
    case "catalog":
      return "Satu katalog";
    default:
      return "Satu produk";
  }
}

export default async function AdminVouchersPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    redirect("/");
  }

  const vouchers = await getAdminVoucherList();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <BackButton fallbackHref="/" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Kelola Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Cuma admin yang bisa melihat dan mengubah halaman ini.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/vouchers/new">Tambah Voucher</Link>
        </Button>
      </div>

      {vouchers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada voucher.</p>
      ) : (
        <div className="space-y-2">
          {vouchers.map((voucher) => (
            <Card key={voucher.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-sm">
                    {voucher.code}{" "}
                    {!voucher.is_active && (
                      <Badge variant="secondary" className="ml-1">
                        Nonaktif
                      </Badge>
                    )}
                    <Badge variant="outline" className="ml-1">
                      {scopeLabel(voucher.scope)}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {voucher.discount_type === "percent"
                      ? `${voucher.discount_value}%`
                      : formatRupiah(voucher.discount_value)}{" "}
                    &middot;{" "}
                    {voucher.max_redemptions !== null
                      ? `${voucher.redemption_count}/${voucher.max_redemptions} terpakai`
                      : `${voucher.redemption_count}x terpakai`}
                    {voucher.single_use_per_user && " · 1x per user"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/vouchers/${voucher.id}/edit`}>Edit</Link>
                  </Button>
                  <DeleteVoucherButton voucherId={voucher.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
