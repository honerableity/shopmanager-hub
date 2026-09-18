"use client";

import { useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/products";

import { addProductToCart, type AddToCartState } from "@/app/cart/actions";

const initialState: AddToCartState = {};

/**
 * Untuk produk delivery_type != 'form': tombol "+ Keranjang" langsung
 * submit dengan quantity dari stepper di sampingnya.
 * Untuk delivery_type == 'form': tombol buka dialog isi form dulu
 * (form_response__<label>, sama pola dengan FormAnswerDialog di
 * product-card.tsx) -- quantity selalu 1 karena tiap entri form di
 * keranjang tidak bisa digabung (lihat addToCart di lib/cart.ts).
 */
export function AddToCartButton({
  productId,
  productName,
  formSchema,
  isForm,
  disabled,
}: {
  productId: string;
  productName: string;
  formSchema: FormField[];
  isForm: boolean;
  disabled: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [quantity, setQuantity] = useState(1);
  const [state, formAction, isPending] = useActionState(
    addProductToCart,
    initialState
  );

  if (isForm) {
    return (
      <>
        <Button
          type="button"
          disabled={disabled}
          onClick={() => dialogRef.current?.showModal()}
        >
          {disabled ? "Habis" : "Tambah ke Keranjang"}
        </Button>

        <dialog
          ref={dialogRef}
          className="m-auto w-full max-w-sm rounded-lg border bg-background p-0 text-foreground backdrop:bg-black/60"
        >
          <form action={formAction} className="p-5 space-y-4">
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="quantity" value={1} />
            <div>
              <h3 className="font-semibold text-sm">{productName}</h3>
              <p className="text-xs text-muted-foreground">
                Isi dulu data berikut sebelum masuk keranjang.
              </p>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {formSchema.map((field, index) => (
                <div key={index} className="space-y-1.5">
                  <Label htmlFor={`detail-form-field-${index}`}>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    id={`detail-form-field-${index}`}
                    name={`form_response__${field.label}`}
                    required={field.required}
                  />
                </div>
              ))}
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state.success && (
              <p className="text-sm text-green-500">Ditambahkan ke keranjang.</p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => dialogRef.current?.close()}
              >
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Menambahkan..." : "Tambah ke Keranjang"}
              </Button>
            </div>
          </form>
        </dialog>
      </>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || quantity <= 1}
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        >
          -
        </Button>
        <span className="w-6 text-center text-sm">{quantity}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => setQuantity((q) => q + 1)}
        >
          +
        </Button>
      </div>
      <Button type="submit" disabled={disabled || isPending}>
        {disabled ? "Habis" : isPending ? "Menambahkan..." : "Tambah ke Keranjang"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-500">Ditambahkan!</p>
      )}
    </form>
  );
}
