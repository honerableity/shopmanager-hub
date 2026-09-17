import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPurchasedOrdersForBuyer } from "@/lib/orders-catalog";
import { getRobloxLink } from "@/lib/roblox-links";

import { RobloxLinkForm } from "./roblox-link-form";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const [robloxUserId, purchases] = await Promise.all([
    getRobloxLink(session.user.discordId),
    getPurchasedOrdersForBuyer(session.user.discordId),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Profil Saya</h1>
        <BackButton fallbackHref="/" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roblox User ID</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Isi Roblox User ID kamu supaya produk yang memberi akses
            whitelist di game bisa langsung aktif untuk akun Robloxmu.
          </p>
          <RobloxLinkForm currentRobloxUserId={robloxUserId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produk yang Sudah Dibeli</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada pembelian yang lunas.
            </p>
          ) : (
            purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="font-medium text-sm">
                    {purchase.product_name ?? "Produk sudah dihapus"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRupiah(purchase.price_idr)}
                    {purchase.paid_at &&
                      ` \u00b7 ${new Date(purchase.paid_at).toLocaleDateString("id-ID")}`}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/orders/${purchase.id}`}>Buka</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
