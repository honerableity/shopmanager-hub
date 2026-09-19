"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ModerationOrder } from "@/lib/moderation";

import { revokeOrderAction, searchOrders, unrevokeOrderAction } from "./actions";

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusLabel(status: ModerationOrder["status"]) {
  switch (status) {
    case "paid":
      return <Badge>Lunas</Badge>;
    case "revoked":
      return <Badge variant="destructive">Dicabut</Badge>;
    case "pending":
      return <Badge variant="secondary">Menunggu</Badge>;
    case "expired":
      return <Badge variant="destructive">Kedaluwarsa</Badge>;
    case "failed":
      return <Badge variant="destructive">Gagal</Badge>;
  }
}

export function OrderModerationSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModerationOrder[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  function runSearch() {
    if (!query.trim()) return;
    setSearchError(null);
    startSearch(async () => {
      try {
        const orders = await searchOrders(query.trim());
        setResults(orders);
      } catch (err) {
        setSearchError(
          err instanceof Error ? err.message : "Gagal mencari order."
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Discord ID pembeli atau ID order"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
        />
        <Button type="button" onClick={runSearch} disabled={isSearching}>
          {isSearching ? "Mencari..." : "Cari"}
        </Button>
      </div>

      {searchError && (
        <p className="text-sm text-destructive">{searchError}</p>
      )}

      {results !== null && results.length === 0 && !searchError && (
        <p className="text-sm text-muted-foreground">
          Tidak ada order ditemukan.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((order) => (
            <OrderModerationRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderModerationRow({ order }: { order: ModerationOrder }) {
  const [showRevokeForm, setShowRevokeForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {order.product_name ?? "(produk sudah dihapus)"}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {order.buyer_discord_id}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRupiah(order.price_idr)} &middot; order {order.id}
            </p>
            {order.status === "revoked" && order.revoked_reason && (
              <p className="text-xs text-muted-foreground">
                Alasan cabut: {order.revoked_reason}
              </p>
            )}
          </div>
          {statusLabel(order.status)}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          {order.status === "paid" && !showRevokeForm && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setShowRevokeForm(true)}
            >
              Cabut Produk
            </Button>
          )}

          {order.status === "revoked" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await unrevokeOrderAction(order.id);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Gagal membatalkan pencabutan."
                    );
                  }
                });
              }}
            >
              {isPending ? "Memproses..." : "Batalkan Cabut"}
            </Button>
          )}
        </div>

        {showRevokeForm && (
          <form
            action={(formData) => {
              startTransition(async () => {
                setError(null);
                const result = await revokeOrderAction(
                  { error: undefined },
                  formData
                );
                if (result.error) {
                  setError(result.error);
                } else {
                  setShowRevokeForm(false);
                }
              });
            }}
            className="space-y-2 pt-1"
          >
            <input type="hidden" name="order_id" value={order.id} />
            <Textarea
              name="reason"
              placeholder="Alasan pencabutan (opsional, ditampilkan ke pembeli)"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowRevokeForm(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={isPending}
              >
                {isPending ? "Memproses..." : "Konfirmasi Cabut"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
