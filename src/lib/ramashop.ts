import "server-only";

/**
 * Client untuk Rama Shop Payment Gateway API (QRIS auto-deposit).
 * Dokumentasi: https://ramashop.my.id/api/public
 *
 * "server-only" dipasang supaya build gagal kalau file ini ke-import
 * dari client component -- RAMASHOP_API_KEY tidak boleh bocor ke
 * bundle browser (sama pola dengan supabase/admin.ts).
 *
 * Rama Shop TIDAK mengirim webhook -- status pembayaran hanya bisa
 * diketahui lewat polling ke deposit/status/{depositId}. Mereka
 * menyebut ada cache/rate-limit ~10 detik di sisi mereka, jadi jangan
 * poll lebih cepat dari itu dari sisi kita juga.
 */

const BASE_URL = "https://ramashop.my.id/api/public";

function apiKey(): string {
  const key = process.env.RAMASHOP_API_KEY;
  if (!key) {
    throw new Error("RAMASHOP_API_KEY belum diset di environment.");
  }
  return key;
}

export type CreateDepositResult = {
  depositId: string;
  amount: number;
  uniqueCode: number;
  totalAmount: number;
  fee: number;
  qrImage: string;
  qrString: string;
  status: string;
  expiredAt: string;
};

export type DepositStatus = "pending" | "success" | "already" | "expired";

export type DepositStatusResult = {
  status: DepositStatus;
  depositId: string;
  amount: number;
  totalAmount: number;
  createdAt: string;
  paidAt?: string;
};

/**
 * Buat deposit QRIS baru untuk satu order. `amount` adalah harga
 * produk (belum termasuk kode unik -- Rama Shop yang menambahkannya
 * dan mengembalikan totalAmount).
 */
export async function createDeposit(
  amount: number
): Promise<CreateDepositResult> {
  const res = await fetch(`${BASE_URL}/deposit/create`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, method: "qris" }),
    // Selalu request baru ke gateway pembayaran, jangan pernah di-cache.
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(
      json?.message ?? `Gagal membuat deposit QRIS (HTTP ${res.status}).`
    );
  }

  return json.data as CreateDepositResult;
}

/**
 * Cek status deposit yang sudah dibuat. Dipanggil dari route
 * handler/server action yang di-poll oleh halaman order -- JANGAN
 * dipanggil langsung dari client component (API key harus tetap di
 * server).
 */
export async function getDepositStatus(
  depositId: string
): Promise<DepositStatusResult> {
  const res = await fetch(
    `${BASE_URL}/deposit/status/${encodeURIComponent(depositId)}`,
    {
      headers: { "X-API-Key": apiKey() },
      cache: "no-store",
    }
  );

  const json = await res.json();

  if (!res.ok || !json.status) {
    throw new Error(
      json?.message ?? `Gagal mengecek status deposit (HTTP ${res.status}).`
    );
  }

  return json.data as DepositStatusResult;
}
