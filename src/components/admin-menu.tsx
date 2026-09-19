"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const MENU_ITEMS = [
  { href: "/admin/products", label: "Kelola Produk" },
  { href: "/admin/vouchers", label: "Kelola Voucher" },
  { href: "/admin/moderation", label: "Moderasi" },
];

/**
 * Menu admin di header shop page -- menggabungkan tiga link admin
 * (Kelola Produk, Kelola Voucher, Moderasi) yang sebelumnya jadi tiga
 * tombol terpisah, supaya header tidak makin penuh setiap ada halaman
 * admin baru ditambahkan.
 *
 * Dropdown sederhana pakai state, bukan komponen shadcn DropdownMenu
 * (belum ada di project ini, lihat DESIGN.md -- komponen shadcn baru
 * ditambahkan manual, bukan lewat CLI). Ditutup otomatis kalau klik di
 * luar menu.
 */
export function AdminMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings />
        Kelola
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-md border bg-popover p-1 shadow-md z-20">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
