import { Suspense } from "react";
import { InvoiceApp } from "@/components/invoice-app";

export default function Home() {
  return (
    <Suspense fallback={<div className="page-loading" aria-label="Loading application" />}>
      <InvoiceApp />
    </Suspense>
  );
}
