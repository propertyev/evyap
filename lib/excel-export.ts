// Styled Excel export — one sheet per page, CmPro colours.
import ExcelJS from 'exceljs';
import type { YearResult } from './engine';
import {
  balanceSheet, cashFlow, cashSummary, fyeLine, notes, performance, plMonthlyGrid, plSummary, plYearly,
  type CatInfo, type Grid, type Statement,
} from './statements';
import type { TaxResult } from './tax';
import { MONTHS } from './money';

const NAVY = 'FF11254B';
const GREEN = 'FFE2EFDA';
const GREY = 'FFE7E6E6';
const YELLOW = 'FFFBFD9B';
const NUM = '#,##0.00;(#,##0.00)';
const rm = (sen: number) => sen / 100;

export interface ExportInput {
  companyName: string;
  ssmNo: string;
  year: number;
  result: YearResult;
  cats: CatInfo[];
  transactions: { date: string; category: string; details: string; direction: 'IN' | 'OUT'; amount: number; partyName: string | null }[];
  debtorCreditors: { date: string; type: string; partyName: string; details: string; amount: number }[];
  invoices: { date: string; type: string; refNo: string; company: string; total: number }[];
  tax: TaxResult;
  figures: Record<string, number>;
}

type WS = ExcelJS.Worksheet;
const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
};

function header(ws: WS, row: number, values: (string | number)[]) {
  const r = ws.getRow(row);
  values.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = v;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thin;
  });
}

function titleBlock(ws: WS, title: string, input: ExportInput, span: number, line = fyeLine(input.year)) {
  [title, input.companyName, line].forEach((t, i) => {
    ws.mergeCells(i + 1, 1, i + 1, span);
    const c = ws.getCell(i + 1, 1);
    c.value = t;
    c.font = { bold: true, size: i === 0 ? 13 : 11 };
    c.alignment = { horizontal: 'center' };
  });
  return 5;
}

function addGrid(ws: WS, g: Grid, input: ExportInput) {
  const span = g.header.length;
  let r = titleBlock(ws, g.title, input, span);
  header(ws, r++, g.header);
  for (const row of g.rows) {
    const x = ws.getRow(r++);
    if (row.style === 'sec') {
      ws.mergeCells(r - 1, 1, r - 1, span);
      const c = x.getCell(1);
      c.value = row.label;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      c.alignment = { horizontal: 'center' };
      continue;
    }
    x.getCell(1).value = row.label;
    row.values.forEach((v, i) => (x.getCell(i + 2).value = rm(v)));
    if (row.total !== undefined && span === row.values.length + 2) x.getCell(row.values.length + 2).value = rm(row.total);
    for (let c = 1; c <= span; c++) {
      const cell = x.getCell(c);
      cell.border = thin;
      if (c > 1) cell.numFmt = NUM;
      if (row.style === 'tot') {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
      }
    }
  }
  ws.getColumn(1).width = 42;
  for (let c = 2; c <= span; c++) ws.getColumn(c).width = 14;
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];
}

function addStatement(ws: WS, s: Statement, input: ExportInput, showNotes = true) {
  let r = titleBlock(ws, s.title, input, 3);
  header(ws, r++, ['', showNotes ? 'Notes' : '', s.columnLabel]);
  for (const l of s.lines) {
    const x = ws.getRow(r++);
    if (l.style === 'sp') continue;
    x.getCell(1).value = l.label;
    if (showNotes && l.note) x.getCell(2).value = l.note;
    x.getCell(2).alignment = { horizontal: 'center' };
    if (l.value !== null && l.value !== undefined) {
      const c = x.getCell(3);
      c.value = rm(l.value);
      c.numFmt = NUM;
      if (l.style === 'st') c.border = { top: { style: 'thin' } };
      if (l.style === 'gt') c.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
    }
    if (l.style === 'h' || l.style === 'gt' || l.style === 'st') x.getCell(1).font = { bold: true };
    if (l.style === 'i') x.getCell(1).font = { italic: true };
    if (l.style === 'gt') x.getCell(3).font = { bold: true };
  }
  ws.getColumn(1).width = 58;
  ws.getColumn(2).width = 9;
  ws.getColumn(3).width = 18;
}

function tallyRow(ws: WS, row: number, diff: number, span: number) {
  ws.mergeCells(row, 1, row, span);
  const c = ws.getCell(row, 1);
  const ok = diff === 0;
  c.value = ok ? 'Akaun Tepat' : `Akaun Tidak Tally - Beza ${Math.abs(rm(diff)).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
  c.font = { bold: true, color: { argb: ok ? 'FF006100' : 'FF9C0006' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ok ? 'FFC6EFCE' : 'FFFFC7CE' } };
  c.alignment = { horizontal: 'center' };
}

export async function buildWorkbook(input: ExportInput): Promise<Buffer> {
  const { result: r, cats } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EVyap Accounts';
  wb.created = new Date();

  // Dashboard
  {
    const ws = wb.addWorksheet('Dashboard');
    let row = titleBlock(ws, 'Dashboard', input, 4);
    header(ws, row++, ['Item', 'Amount (RM)']);
    const items: [string, number][] = [
      ['Sales', r.sales], ['Profit', r.netProfit], ['Expenses', r.cogs + r.operatingExpenses], ['Cash Balance', r.cash],
      ['Baki Mula', r.cashFlow.opening], ['Trade Debtor', r.tradeDebtors], ['Creditor', r.creditors],
    ];
    items.forEach(([k, v]) => {
      ws.getRow(row).getCell(1).value = k;
      const c = ws.getRow(row++).getCell(2);
      c.value = rm(v);
      c.numFmt = NUM;
    });
    ws.getRow(row).getCell(1).value = 'Transactions';
    ws.getRow(row).getCell(2).value = r.txCount;
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 18;
    header(ws, row + 2, ['Month', 'Sales', 'Net Profit / (Loss)']);
    MONTHS.forEach((m, i) => {
      const x = ws.getRow(row + 3 + i);
      x.getCell(1).value = `${m}-${String(input.year).slice(2)}`;
      x.getCell(2).value = rm(r.salesM[i]);
      x.getCell(3).value = rm(r.netProfitM[i]);
      x.getCell(2).numFmt = x.getCell(3).numFmt = NUM;
    });
    ws.getColumn(3).width = 20;
  }

  // Cash In & Cash Out (ledger)
  {
    const ws = wb.addWorksheet('Cash In & Cash Out');
    const ref = ws.getCell(1, 1);
    ws.mergeCells(1, 1, 1, 6);
    ref.value = 'Rujukan: Sila pilih bulan untuk lihat semula data yang telah diisi.';
    ref.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
    header(ws, 3, ['DATE', 'CATEGORY', 'DETAILS', 'PARTY', 'CASH IN', 'CASH OUT']);
    input.transactions.forEach((t, i) => {
      const x = ws.getRow(4 + i);
      x.getCell(1).value = t.date;
      x.getCell(2).value = t.category;
      x.getCell(3).value = t.details;
      x.getCell(4).value = t.partyName ?? '';
      if (t.direction === 'IN') x.getCell(5).value = rm(t.amount);
      else x.getCell(6).value = rm(t.amount);
      for (let c = 1; c <= 6; c++) {
        x.getCell(c).border = thin;
        if (c <= 3) x.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
        if (c >= 5) x.getCell(c).numFmt = NUM;
      }
    });
    const end = 4 + input.transactions.length;
    ws.getRow(end).getCell(3).value = 'Total';
    ws.getRow(end).getCell(5).value = { formula: `SUM(E4:E${end - 1})`, result: rm(r.cashInTotal) };
    ws.getRow(end).getCell(6).value = { formula: `SUM(F4:F${end - 1})`, result: rm(r.cashOutTotal) };
    for (let c = 1; c <= 6; c++) {
      const cell = ws.getRow(end).getCell(c);
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
      cell.numFmt = NUM;
    }
    [12, 32, 40, 24, 16, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.views = [{ state: 'frozen', ySplit: 3 }];
  }

  // Debtor & Creditor
  {
    const ws = wb.addWorksheet('Debtor & Creditor');
    header(ws, 1, ['DATE', 'DEBTOR / CREDITOR', 'NAME', 'DETAILS', 'AMOUNT (RM)']);
    input.debtorCreditors.forEach((d, i) => {
      const x = ws.getRow(2 + i);
      [d.date, d.type, d.partyName, d.details].forEach((v, c) => (x.getCell(c + 1).value = v));
      x.getCell(5).value = rm(d.amount);
      x.getCell(5).numFmt = NUM;
    });
    [12, 20, 30, 40, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  // Invoice | Receipt register
  {
    const ws = wb.addWorksheet('Invoice - Receipt');
    header(ws, 1, ['DATE', 'TYPE', 'REF NO', 'COMPANY', 'TOTAL (RM)']);
    input.invoices.forEach((v, i) => {
      const x = ws.getRow(2 + i);
      [v.date, v.type, v.refNo, v.company].forEach((val, c) => (x.getCell(c + 1).value = val));
      x.getCell(5).value = rm(v.total);
      x.getCell(5).numFmt = NUM;
    });
    [12, 12, 18, 34, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  addGrid(wb.addWorksheet('Performance'), performance(r), input);
  addGrid(wb.addWorksheet('Profit & Loss - Monthly'), plMonthlyGrid(r), input);
  addStatement(wb.addWorksheet('Profit & Loss - Yearly'), plYearly(r), input);
  addGrid(wb.addWorksheet('Profit & Loss - Summary'), plSummary(r, cats), input);
  addGrid(wb.addWorksheet('Cash In & Cash Out - Summary'), cashSummary(r, r.cashFlow.opening, cats), input);

  {
    const ws = wb.addWorksheet('Balance Sheet');
    addStatement(ws, balanceSheet(r), input);
    const last = ws.rowCount + 2;
    tallyRow(ws, last, r.tally, 3);
  }

  // Trial Balance
  {
    const ws = wb.addWorksheet('Trial Balance');
    let row = titleBlock(ws, 'Trial Balance', input, 4);
    header(ws, row++, ['Code', 'Grouping to the Financial Statements', 'Debit', 'Credit']);
    for (const s of r.trialBalance.sections) {
      const rows = s.rows.filter((x) => x.debit || x.credit);
      ws.mergeCells(row, 1, row, 4);
      const c = ws.getCell(row, 1);
      c.value = s.title;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      c.alignment = { horizontal: 'center' };
      row++;
      for (const x of rows.length ? rows : s.rows.slice(0, 1)) {
        const rr = ws.getRow(row++);
        rr.getCell(1).value = x.code;
        rr.getCell(2).value = x.name;
        rr.getCell(3).value = rm(x.debit);
        rr.getCell(4).value = rm(x.credit);
        rr.getCell(3).numFmt = rr.getCell(4).numFmt = NUM;
      }
    }
    const t = ws.getRow(row++);
    t.getCell(2).value = 'Total';
    t.getCell(3).value = rm(r.trialBalance.totalDebit);
    t.getCell(4).value = rm(r.trialBalance.totalCredit);
    for (let c = 1; c <= 4; c++) {
      t.getCell(c).font = { bold: true };
      t.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
      t.getCell(c).numFmt = NUM;
    }
    tallyRow(ws, row + 1, r.trialBalance.totalDebit - r.trialBalance.totalCredit, 4);
    [10, 52, 16, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  // Assets (green inputs)
  {
    const ws = wb.addWorksheet('Assets');
    let row = titleBlock(ws, 'Assets', input, 7);
    header(ws, row++, [
      `Year ended ${input.year}`, 'Opening net book value', 'Costs', 'Additions', 'Depreciation Rate (%)',
      'Depreciation charge', 'Closing net book value',
    ]);
    const start = row;
    r.assets.forEach((a) => {
      const x = ws.getRow(row++);
      x.getCell(1).value = a.category;
      x.getCell(2).value = rm(a.openingNBV);
      x.getCell(3).value = rm(a.cost);
      x.getCell(4).value = rm(a.additions);
      x.getCell(5).value = a.ratePct;
      x.getCell(6).value = rm(a.depreciation);
      x.getCell(7).value = rm(a.closingNBV);
      for (let c = 1; c <= 7; c++) {
        x.getCell(c).border = thin;
        if (c !== 1 && c !== 5) x.getCell(c).numFmt = NUM;
      }
      [2, 3, 5].forEach((c) => (x.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }));
    });
    const t = ws.getRow(row);
    t.getCell(1).value = 'Total';
    [2, 3, 4, 6, 7].forEach((c) => {
      const col = String.fromCharCode(64 + c);
      const sum = r.assets.reduce((a, x) => a + [0, 0, x.openingNBV, x.cost, x.additions, 0, x.depreciation, x.closingNBV][c], 0);
      t.getCell(c).value = { formula: `SUM(${col}${start}:${col}${row - 1})`, result: rm(sum) };
      t.getCell(c).numFmt = NUM;
    });
    for (let c = 1; c <= 7; c++) {
      t.getCell(c).font = { bold: true };
      t.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
    }
    ws.getColumn(1).width = 28;
    for (let c = 2; c <= 7; c++) ws.getColumn(c).width = 20;
  }

  addStatement(wb.addWorksheet('Cash Flow'), cashFlow(r), input, false);
  addStatement(wb.addWorksheet('Notes'), notes(r, cats), input, false);

  // Tax & Zakat
  {
    const ws = wb.addWorksheet('Tax & Zakat');
    let row = titleBlock(ws, 'Tax & Zakat Estimation', input, 4);
    const line = (label: string, value: number, bold = false) => {
      const x = ws.getRow(row++);
      x.getCell(1).value = label;
      x.getCell(4).value = rm(value);
      x.getCell(4).numFmt = NUM;
      if (bold) x.getCell(1).font = x.getCell(4).font = { bold: true };
    };
    line('Profit / (Loss) before zakat/tax', input.tax.pbt);
    line('Zakat yang wajib dibayar', input.tax.zakat);
    line('Profit / (Loss) after zakat', input.tax.afterZakat, true);
    row++;
    header(ws, row++, ['No', 'Pelepasan', 'Terhad (RM)', 'RM']);
    input.tax.reliefLines.forEach((l, i) => {
      const x = ws.getRow(row++);
      x.getCell(1).value = i + 1;
      x.getCell(2).value = l.label;
      x.getCell(3).value = rm(l.limit);
      x.getCell(4).value = rm(l.allowed);
      x.getCell(3).numFmt = x.getCell(4).numFmt = NUM;
      x.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    });
    line('Jumlah pelepasan cukai', input.tax.totalRelief, true);
    row++;
    line('Anggaran pendapatan bercukai SEBELUM tolak zakat', input.tax.chargeable, true);
    header(ws, row++, ['', 'Pendapatan Bercukai', 'Kadar (%)', 'Nilai (RM)']);
    input.tax.bandRows.forEach((b) => {
      const x = ws.getRow(row++);
      x.getCell(2).value = `RM${rm(b.from).toLocaleString('en-MY')} – RM${rm(b.to).toLocaleString('en-MY')}`;
      x.getCell(3).value = b.ratePct;
      x.getCell(4).value = rm(b.tax);
      x.getCell(4).numFmt = NUM;
    });
    line('Cukai yang dikenakan', input.tax.tax, true);
    line('(-) Zakat dan fitrah yang sudah dibayar', input.tax.zakatPaid);
    line('CUKAI YANG PERLU DIBAYAR', input.tax.taxPayable, true);
    ws.getRow(row + 1).getCell(1).value = 'Method pengiraan di atas hanyalah anggaran sahaja — sila rujuk LHDN / ejen cukai.';
    [6, 62, 16, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  // Cover Page
  {
    const ws = wb.addWorksheet('Cover Page');
    ws.mergeCells('A3:B3');
    ws.getCell('A3').value = input.companyName;
    ws.getCell('A3').font = { bold: true, size: 20, color: { argb: NAVY } };
    ws.getCell('A3').alignment = { horizontal: 'center' };
    ws.getCell('A4').value = input.ssmNo;
    ws.getCell('A5').value = `31 Dec ${input.year}`;
    ws.getCell('A7').value = '(MANAGEMENT ACCOUNTS)';
    ws.getCell('A7').font = { bold: true };
    header(ws, 9, ['INDEX', 'PAGE']);
    [['BALANCE SHEET', 1], ['PROFIT & LOSS STATEMENT', 2], ['CASH FLOW STATEMENT', 3], ['NOTES TO THE FINANCIAL STATEMENTS', 4]].forEach(
      ([n, p], i) => {
        ws.getRow(10 + i).getCell(1).value = n;
        ws.getRow(10 + i).getCell(2).value = p;
      },
    );
    ws.getColumn(1).width = 46;
    ws.getColumn(2).width = 10;
  }

  // Company Profile & Last Year
  {
    const ws = wb.addWorksheet('Company Profile & Last Year');
    header(ws, 1, ['Last Year Figure (Baki Awal)', 'RM']);
    const labels: [string, string][] = [
      ['closingStock', 'Stok Akhir / Closing Stock'], ['openStock', 'Stok Awal (Opening Stock)'],
      ['openCapital', 'Modal Awal (Opening Capital)'], ['openPL', 'Untung/Rugi Mula (Opening P&L)'],
      ['openCash', 'Baki Mula (Opening Cash & Bank)'], ['openLongTermLoan', 'Long Term Loan'],
      ['openOtherLTLiab', 'Other long-term liabilities'], ['openAdvances', 'Advances, Deposits & Prepayment'],
      ['openTradeDebtors', 'Trade Debtor'], ['openCreditors', 'Creditor, accruals & other liabilities'],
    ];
    labels.forEach(([k, l], i) => {
      const x = ws.getRow(2 + i);
      x.getCell(1).value = l;
      x.getCell(2).value = rm(input.figures[k] ?? 0);
      x.getCell(2).numFmt = NUM;
      x.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    });
    ws.getColumn(1).width = 42;
    ws.getColumn(2).width = 18;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
