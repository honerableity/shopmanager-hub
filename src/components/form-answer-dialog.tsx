"use client";

import { useActionState, useRef } from "react";

import { startCheckout, type StartCheckoutState } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/products";

const initialState: StartCheckoutState = {};

/**
 * Tombol "Beli" khusus produk delivery_type='form'. Beda dari alur
 * biasa (langsung submit ke startCheckout) -- di sini klik "Beli"
 * cuma buka <dialog> berisi pertanyaan dari form_schema produk dulu;
 * submit form_response__<label> baru terjadi setelah pembeli isi
 * form dan klik "Lanjut ke Pembayaran" di dalam dialog.
 *
 * <dialog> native dipakai (bukan bikin komponen shadcn Dialog baru)
 * supaya tidak perlu tambah dependency -- cukup showModal()/close()
 * lewat ref.
 */
export function FormAnswerDialog({
  productId,
  productName,
  formSchema,
  disabled,
}: {
  productId: string;
  productName: string;
  formSchema: FormField[];
  disabled: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(
    startCheckout,
    initialState
  );

  return (
    <>
      <Button
        size="sm"
        type="button"
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
      >
        {disabled ? "Habis" : "Beli"}
      </Button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-sm rounded-lg border bg-background p-0 text-foreground backdrop:bg-black/60"
      >
        <form action={formAction} className="p-5 space-y-4">
          <input type="hidden" name="product_id" value={productId} />
          <div>
            <h3 className="font-semibold text-sm">{productName}</h3>
            <p className="text-xs text-muted-foreground">
              Isi dulu data berikut sebelum lanjut ke pembayaran.
            </p>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {formSchema.map((field, index) => (
              <div key={index} className="space-y-1.5">
                <Label htmlFor={`form-field-${index}`}>
                  {field.label}
                  {field.required && (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                <Input
                  id={`form-field-${index}`}
                  name={`form_response__${field.label}`}
                  required={field.required}
                />
              </div>
            ))}
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
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
              {isPending ? "Memproses..." : "Lanjut ke Pembayaran"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
