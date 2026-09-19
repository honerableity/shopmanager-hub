"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/lib/products";

/**
 * Builder pertanyaan form untuk produk delivery_type='form' -- mirip
 * /setform di bot Discord referensi (tiap field punya label + wajib
 * atau tidak). State-nya cuma disimpan sebagai JSON di satu hidden
 * input ("form_schema") supaya bisa ikut ke-submit lewat FormData
 * biasa tanpa perlu parsing field-by-field di server action.
 */
export function FormSchemaBuilder({
  defaultValue,
}: {
  defaultValue: FormField[];
}) {
  const [fields, setFields] = useState<FormField[]>(
    defaultValue.length > 0 ? defaultValue : [{ label: "", required: true }]
  );

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  function addField() {
    setFields((prev) => [...prev, { label: "", required: true }]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="form_schema"
        value={JSON.stringify(fields.filter((f) => f.label.trim() !== ""))}
      />

      <Label>Pertanyaan form</Label>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder={`Pertanyaan ${index + 1}, mis. "Email akun"`}
              value={field.label}
              onChange={(e) => updateField(index, { label: e.target.value })}
              className="flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) =>
                  updateField(index, { required: e.target.checked })
                }
                className="h-4 w-4 rounded border-input"
              />
              Wajib
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeField(index)}
              disabled={fields.length === 1}
            >
              Hapus
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addField}>
        + Tambah pertanyaan
      </Button>
      <p className="text-xs text-muted-foreground">
        Pembeli wajib mengisi ini sebelum QRIS dibuat. Baris kosong tidak
        ikut disimpan.
      </p>
    </div>
  );
}
