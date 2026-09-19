import "server-only";

import type { DeliveryType } from "@/lib/products";

/**
 * Log setiap pembelian (order baru dibuat) ke webhook Discord, supaya
 * admin bisa proses order `form` dan `adminprocessed` dari situ tanpa
 * buka dashboard.
 *
 * Dipanggil dari createOrder() SETIAP kali order berhasil dibuat --
 * baik yang langsung gratis (price_idr < 100) maupun yang masih
 * `pending` menunggu QRIS -- karena tujuan log ini adalah adminnya
 * tahu ada pembelian masuk, bukan cuma yang sudah lunas.
 *
 * Sengaja tidak melempar error kalau pengiriman webhook gagal --
 * kegagalan log tidak boleh menggagalkan pembuatan order itu sendiri.
 */

const WEBHOOK_URL =
  "https://discord.com/api/webhooks/1550127730782245006/sb5pAEr7KFaBI792BEsbDL3yWOx3a6ixaahiw7i3vntHZUyC-9gwUeDAyhwX0XixIC0R";

const DELIVERY_TYPE_LABEL: Record<DeliveryType, string> = {
  filelink: "File Link",
  form: "Form",
  adminprocessed: "Proses Admin",
};

export async function logPurchaseToDiscord(params: {
  orderId: string;
  buyerUsername: string;
  buyerDiscordId: string;
  productName: string;
  deliveryType: DeliveryType;
  formResponses?: Record<string, string> | null;
}): Promise<void> {
  const lines = [
    `Pembeli = ${params.buyerUsername}`,
    `Id = ${params.buyerDiscordId}`,
    `product = ${params.productName}`,
    `Jenis = ${DELIVERY_TYPE_LABEL[params.deliveryType]}`,
    // Order ID disertakan supaya admin bisa langsung cari & cabut
    // (revoke) order ini lewat halaman /admin/moderation kalau perlu,
    // tanpa perlu command atau tombol cabut di Discord itu sendiri.
    `Order ID = ${params.orderId}`,
  ];

  // Khusus form: tambahkan value untuk tiap pertanyaan di formnya.
  if (
    params.deliveryType === "form" &&
    params.formResponses &&
    Object.keys(params.formResponses).length > 0
  ) {
    for (const [label, answer] of Object.entries(params.formResponses)) {
      lines.push(`${label} = ${answer}`);
    }
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: lines.join("\n") }),
      cache: "no-store",
    });
  } catch {
    // Diamkan -- gagal kirim log tidak boleh menggagalkan order.
  }
}
