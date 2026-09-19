import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Halaman tujuan proxy.ts saat akun Discord yang login ternyata ada di
 * banned_discord_users. Sengaja TIDAK memakai layout shop biasa (tidak
 * ada link ke "/", cart, dsb) -- satu-satunya aksi yang tersedia di
 * sini adalah logout, supaya akun yang diban benar-benar tidak bisa
 * "muter balik" ke halaman lain lewat tombol back atau link manual
 * (proxy.ts tetap akan menendang balik ke sini di request berikutnya
 * selama masih login & masih diban, tapi halaman ini juga tidak
 * menyediakan jalan pintas apa pun ke luar).
 *
 * Kalau ternyata sesi ini bukan akun yang diban (mis. sudah di-unban
 * tapi buka tab lama), redirect balik ke "/" -- halaman ini tidak
 * boleh nyasar diakses oleh akun yang bersih.
 */
export default async function BannedPage() {
  const session = await auth();
  if (!session?.user?.discordId) {
    redirect("/login");
  }

  const { data: ban } = await supabaseAdmin
    .from("banned_discord_users")
    .select("reason, banned_at")
    .eq("discord_id", session.user.discordId)
    .maybeSingle();

  if (!ban) {
    redirect("/");
  }

  async function forceLogout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-destructive">Akun diban</CardTitle>
          <CardDescription>
            Akun Discord kamu sudah diban dari ShopManager dan tidak
            bisa mengakses toko ini lagi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ban.reason && (
            <div className="rounded-md border p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Alasan:
              </p>
              <p>{ban.reason}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Kalau menurut kamu ini keliru, hubungi admin toko lewat
            Discord.
          </p>
          <form action={forceLogout}>
            <Button type="submit" variant="destructive" className="w-full">
              Logout
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
