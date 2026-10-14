import * as XLSX from 'xlsx';
import { api } from '@/lib/session';

export const GET = api(async () => {
  const y = new Date().getFullYear();
  const rows = [
    ['Date', 'Description', 'Debit', 'Credit', 'Category'],
    [`02/01/${y}`, 'Payment from customer INV-001', null, 8500, null],
    [`05/01/${y}`, 'TNB electricity bill', 412.6, null, null],
    [`06/01/${y}`, 'Shell petrol Johor Bahru', 150, null, null],
    [`10/01/${y}`, 'Unifi broadband', 139, null, null],
    [`15/01/${y}`, 'Staff salary January', 4200, null, null],
    [`15/01/${y}`, 'KWSP employer contribution', 546, null, null],
    [`20/01/${y}`, 'Raw material supplier', 2300, null, null],
    [`28/01/${y}`, 'Facebook ads', 600, null, null],
    [`03/02/${y}`, 'Payment from customer INV-002', null, 12000, null],
    [`05/02/${y}`, 'Office rent Feb', 1800, null, null],
    [`12/02/${y}`, 'Bank service charge', 8, null, null],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Bank Statement');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="EVyap_sample_bank_statement.xlsx"',
    },
  });
});
