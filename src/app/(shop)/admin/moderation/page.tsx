import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackButton } from "@/components/back-button";
import { isAdmin } from "@/lib/admin";
import { listBannedUsers } from "@/lib/moderation";

import { BanUserForm } from "./ban-user-form";
import { BannedUserList } from "./banned-user-list";
import { OrderModerationSearch } from "./order-moderation-search";

export default async function AdminModerationPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.discordId)) {
    redirect("/");
  }

  const bannedUsers = await listBannedUsers();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <BackButton fallbackHref="/" />
      <div>
        <h1 className="text-xl font-semibold">Moderasi</h1>
        <p className="text-sm text-muted-foreground">
          Cuma admin yang bisa melihat dan mengubah halaman ini. Ban
          akun Discord atau cabut akses ke produk yang sudah dibeli.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Ban Akun Discord</h2>
        <p className="text-xs text-muted-foreground">
          Masukkan Discord ID (bukan username) -- bisa dilihat lewat
          log pembelian di webhook Discord atau dari hasil pencarian
          order di bawah. Akun yang diban langsung tidak bisa akses
          toko lagi dan otomatis logout dari sesi yang sedang aktif.
        </p>
        <BanUserForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Akun Diban ({bannedUsers.length})
        </h2>
        <BannedUserList bannedUsers={bannedUsers} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Cabut Produk (Revoke)</h2>
        <p className="text-xs text-muted-foreground">
          Cari lewat Discord ID pembeli atau ID order untuk melihat
          riwayat pembeliannya, lalu cabut order yang mau ditarik
          aksesnya.
        </p>
        <OrderModerationSearch />
      </section>
    </div>
  );
}
