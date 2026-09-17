"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveRobloxId, type SaveRobloxIdState } from "./actions";

const initialState: SaveRobloxIdState = {};

export function RobloxLinkForm({
  currentRobloxUserId,
}: {
  currentRobloxUserId: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    saveRobloxId,
    initialState
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="roblox_user_id">Roblox User ID</Label>
        <Input
          id="roblox_user_id"
          name="roblox_user_id"
          inputMode="numeric"
          placeholder="contoh: 156872067"
          defaultValue={currentRobloxUserId ?? ""}
          required
        />
        <p className="text-xs text-muted-foreground">
          Bukan username -- ini ID angka. Bisa dicek lewat situs seperti
          rolimons.com atau di URL profil Roblox-mu.
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-500">Roblox ID tersimpan.</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
