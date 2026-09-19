import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { auth } from "@/auth";
import { AdminMenu } from "@/components/admin-menu";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { isAdmin } from "@/lib/admin";
import { getShopCatalog } from "@/lib/products";
import { getPaidOrderMapForBuyer } from "@/lib/orders-catalog";
import { LogoutDialog } from "@/components/logout-dialog";

import { logout } from "./logout-action";

export default async function ShopPage() {
  const session = await auth();
  const catalog = await getShopCatalog();
  const userIsAdmin = isAdmin(session?.user?.discordId);
  const paidOrderMap = session?.user?.discordId
    ? await getPaidOrderMapForBuyer(session.user.discordId)
    : {};

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/logo-full.png"
              alt="ShopManager"
              width={32}
              height={32}
              unoptimized
              className="rounded-md"
            />
            <span className="font-semibold">ShopManager</span>
          </div>
          <div className="flex items-center gap-3">
            {userIsAdmin && <AdminMenu />}
            <Button asChild variant="outline" size="sm">
              <Link href="/cart">
                <ShoppingCart />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">Profil Saya</Link>
            </Button>
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "avatar"}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <LogoutDialog logoutAction={logout} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue={catalog[0]?.slug}>
          <TabsList>
            {catalog.map((category) => (
              <TabsTrigger key={category.id} value={category.slug}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {catalog.map((category) => (
            <TabsContent key={category.id} value={category.slug} className="pt-4">
              {category.products.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada produk di kategori ini.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {category.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      ownedOrderId={paidOrderMap[product.id]}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}