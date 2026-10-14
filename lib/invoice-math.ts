// Client-safe invoice math/types (no server imports).
export interface InvoiceView {
  id: string;
  type: 'INVOICE' | 'RECEIPT';
  refNo: string;
  date: string;
  attention: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  salesType: string;
  salesPerson: string;
  discount: number;
  tax: number;
  total: number;
  recorded: boolean;
  lines: { description: string; price: number; qty: number }[];
}

export const lineTotal = (price: number, qty: number) => Math.round(price * qty);

export function invoiceTotals(lines: { price: number; qty: number }[], discount: number, tax: number) {
  const subtotal = lines.reduce((a, l) => a + lineTotal(l.price, l.qty), 0);
  return { subtotal, total: subtotal - discount + tax };
}
