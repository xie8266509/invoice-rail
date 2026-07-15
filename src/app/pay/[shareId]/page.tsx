import { notFound } from "next/navigation";
import { SharePaymentApp } from "@/components/share-payment-app";
import { getInvoiceByShareId } from "@/lib/server/invoice-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SharePaymentPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  if (!/^[a-f0-9]{32}$/.test(shareId)) notFound();
  const invoice = await getInvoiceByShareId(shareId);
  if (!invoice) notFound();
  return <SharePaymentApp invoice={invoice} />;
}
