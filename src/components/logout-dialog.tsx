"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * Tombol "Logout" di header shop page. Beda dari sebelumnya (langsung
 * submit form ke logout action) -- sekarang klik pertama cuma buka
 * <dialog> konfirmasi dulu, submit ke action logout beneran cuma
 * terjadi setelah user klik "Logout" lagi di dalam dialog.
 *
 * <dialog> native dipakai, sama pola dengan FormAnswerDialog, supaya
 * tidak perlu tambah dependency shadcn Dialog baru.
 */
export function LogoutDialog({
  logoutAction,
}: {
  logoutAction: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => dialogRef.current?.showModal()}
      >
        Logout
      </Button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-sm rounded-lg border bg-background p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Keluar dari akun?</h3>
            <p className="text-xs text-muted-foreground">
              Kamu harus login lagi lewat Discord untuk lanjut belanja.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => dialogRef.current?.close()}
            >
              Batal
            </Button>
            <form action={logoutAction} className="flex-1">
              <Button type="submit" variant="destructive" className="w-full">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
