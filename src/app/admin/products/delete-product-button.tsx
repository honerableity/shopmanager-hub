"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  deleteProduct,
  type DeleteProductState,
} from "@/app/admin/products/actions";

const initialState: DeleteProductState = {};

export function DeleteProductButton({ productId }: { productId: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteProduct,
    initialState
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Hapus produk ini? Tindakan ini tidak bisa dibatalkan.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="product_id" value={productId} />
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={isPending}
      >
        {isPending ? "Menghapus..." : "Hapus"}
      </Button>
      {state.error && (
        <p className="text-xs text-destructive mt-1">{state.error}</p>
      )}
    </form>
  );
}
