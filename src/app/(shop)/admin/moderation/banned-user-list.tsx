"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BannedUser } from "@/lib/moderation";

import { unbanUser } from "./actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BannedUserList({
  bannedUsers,
}: {
  bannedUsers: BannedUser[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (bannedUsers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada akun yang diban.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {bannedUsers.map((user) => (
        <Card key={user.discord_id}>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-mono text-sm">{user.discord_id}</p>
              {user.reason && (
                <p className="text-xs text-muted-foreground">
                  {user.reason}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Diban {formatDate(user.banned_at)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await unbanUser(user.discord_id);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Gagal membatalkan ban."
                    );
                  }
                });
              }}
            >
              {isPending ? "Memproses..." : "Unban"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
