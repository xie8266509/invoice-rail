import { INVOICE_STORAGE_KEY } from "@/lib/constants";
import type { Invoice } from "@/lib/invoice";
import type { Address } from "viem";

function parseInvoices(raw: string | null): Invoice[] {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Invoice[];
  return Array.isArray(parsed) ? parsed : [];
}

function merchantStorageKey(address: Address): string {
  return `${INVOICE_STORAGE_KEY}:${address.toLowerCase()}`;
}

export function loadInvoices(address: Address): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const scoped = parseInvoices(window.localStorage.getItem(merchantStorageKey(address)));
    if (scoped.length > 0) return scoped;
    return parseInvoices(window.localStorage.getItem(INVOICE_STORAGE_KEY)).filter(
      (invoice) =>
        !invoice.merchantAddress ||
        invoice.merchantAddress.toLowerCase() === address.toLowerCase(),
    );
  } catch {
    return [];
  }
}

export function saveInvoices(invoices: Invoice[], address: Address): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(merchantStorageKey(address), JSON.stringify(invoices));
  try {
    const remainingLegacy = parseInvoices(window.localStorage.getItem(INVOICE_STORAGE_KEY)).filter(
      (invoice) =>
        invoice.merchantAddress &&
        invoice.merchantAddress.toLowerCase() !== address.toLowerCase(),
    );
    if (remainingLegacy.length > 0) {
      window.localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(remainingLegacy));
    } else {
      window.localStorage.removeItem(INVOICE_STORAGE_KEY);
    }
  } catch {
    // The server remains authoritative if legacy cache cleanup fails.
  }
}
