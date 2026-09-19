"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

import { banUser, type BanUserState } from "./actions";

const initialState: BanUserState = {};

export function BanUserForm() {
  const [state, formAction, isPending] = useActionState(
    banUser,
    initialState
  );

  return (
    <Card>
      <CardContent className="pt-4">
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="discord_id">Discord ID</Label>
            <Input
              id="discord_id"
              name="discord_id"
              placeholder="contoh: 1509022726487146707"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Alasan (opsional)</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Kenapa akun ini diban? Ditampilkan ke user yang bersangkutan."
              rows={2}
            />
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-green-500">Akun berhasil diban.</p>
          )}

          <Button type="submit" variant="destructive" disabled={isPending}>
            {isPending ? "Memproses..." : "Ban Akun"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
