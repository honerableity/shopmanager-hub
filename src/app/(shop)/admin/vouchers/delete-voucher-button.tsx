"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { deleteVoucher } from "./actions";

export function DeleteVoucherButton({ voucherId }: { voucherId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Hapus voucher ini? Tindakan ini tidak bisa dibatalkan.")) {
            return;
          }
          setError(null);
          startTransition(async () => {
            try {
              await deleteVoucher(voucherId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Gagal menghapus.");
            }
          });
        }}
      >
        {isPending ? "Menghapus..." : "Hapus"}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
