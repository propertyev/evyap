// Management Accounts pack + Invoice/Receipt PDFs (@react-pdf/renderer, built-in Helvetica).
import React from 'react';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { fmt } from '../money';
import type { InvoiceView } from '../invoice-math';
import { invoiceTotals, lineTotal } from '../invoice-math';
import { balanceSheet, cashFlow, COVER_INDEX, fyeLine, notes, plYearly, type CatInfo, type Statement } from '../statements';
import type { YearResult } from '../engine';

const NAVY = '#11254B';
const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9.5, color: '#000' },
  coverWrap: { marginTop: 160, alignItems: 'center' },
  coverName: { fontFamily: 'Helvetica-Bold', fontSize: 24, color: NAVY },
  center: { textAlign: 'center' },
  bold: { fontFamily: 'Helvetica-Bold' },
  title: { textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  sub: { textAlign: 'center', fontFamily: 'Helvetica-Bold', marginBottom: 14 },
  row: { flexDirection: 'row', paddingVertical: 1.5 },
  label: { flexGrow: 1 },
  note: { width: 40, textAlign: 'center' },
  val: { width: 90, textAlign: 'right' },
  hdr: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#000', paddingBottom: 3, marginBottom: 4 },
  idxRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomStyle: 'dotted', paddingVertical: 6, width: 360 },
});

function Lines({ st, showNotes = true }: { st: Statement; showNotes?: boolean }) {
  return (
    <View>
      <View style={s.hdr}>
        <Text style={[s.label, s.bold]} />
        {showNotes && <Text style={[s.note, s.bold]}>Notes</Text>}
        <Text style={[s.val, s.bold]}>{st.columnLabel}</Text>
      </View>
      {st.lines.map((l, i) => {
        if (l.style === 'sp') return <View key={i} style={{ height: 8 }} />;
        const bold = l.style === 'h' || l.style === 'gt' || l.style === 'st';
        const text = l.value === null || l.value === undefined ? '' : fmt(l.value);
        // react-pdf has no "double" border: emulate the grand-total double underline with two rules
        const valueNode =
          l.style === 'gt' ? (
            <View style={[s.val, { borderTopWidth: 0.7 }]}>
              <Text style={[s.bold, { textAlign: 'right' }]}>{text}</Text>
              <View style={{ borderBottomWidth: 0.7, marginTop: 1.5 }} />
              <View style={{ borderBottomWidth: 0.7, marginTop: 1.5 }} />
            </View>
          ) : (
            <Text style={[s.val, bold && l.style !== 'h' ? s.bold : {}, l.style === 'st' ? { borderTopWidth: 0.7 } : {}]}>
              {text}
            </Text>
          );
        return (
          <View key={i} style={[s.row, l.style === 'h' ? { marginTop: 6 } : {}]} wrap={false}>
            <Text style={[s.label, bold ? s.bold : {}, l.style === 'i' ? { fontFamily: 'Helvetica-Oblique' } : {}]}>{l.label}</Text>
            {showNotes && <Text style={s.note}>{l.note ?? ''}</Text>}
            {valueNode}
          </View>
        );
      })}
    </View>
  );
}

function StatementPage({ st, company, year, showNotes }: { st: Statement; company: string; year: number; showNotes?: boolean }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.title}>{company}</Text>
      <Text style={s.title}>{st.title}</Text>
      <Text style={s.sub}>{fyeLine(year)}</Text>
      <Lines st={st} showNotes={showNotes} />
    </Page>
  );
}

export interface PackInput {
  companyName: string;
  ssmNo: string;
  year: number;
  result: YearResult;
  cats: CatInfo[];
}

export async function renderPack(p: PackInput): Promise<Buffer> {
  const doc = (
    <Document title={`${p.companyName} Management Accounts ${p.year}`} author="EVyap Accounts">
      <Page size="A4" style={s.page}>
        <View style={s.coverWrap}>
          <Text style={s.coverName}>{p.companyName}</Text>
          <Text style={{ marginTop: 6 }}>{p.ssmNo}</Text>
          <Text style={{ marginTop: 6 }}>31 Dec {p.year}</Text>
          <Text style={[s.bold, { marginTop: 28 }]}>(MANAGEMENT ACCOUNTS)</Text>
          <View style={{ marginTop: 40 }}>
            <View style={s.idxRow}>
              <Text style={s.bold}>INDEX</Text>
              <Text style={s.bold}>PAGE</Text>
            </View>
            {COVER_INDEX.map(([n, pg]) => (
              <View key={n} style={s.idxRow}>
                <Text>{n}</Text>
                <Text>{pg}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
      <StatementPage st={balanceSheet(p.result)} company={p.companyName} year={p.year} />
      <StatementPage st={plYearly(p.result)} company={p.companyName} year={p.year} />
      <StatementPage st={cashFlow(p.result)} company={p.companyName} year={p.year} showNotes={false} />
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{p.companyName}</Text>
        <Text style={s.title}>Notes to the Financial Statements</Text>
        <Text style={s.sub}>{fyeLine(p.year)}</Text>
        <Lines st={notes(p.result, p.cats)} showNotes={false} />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

export interface InvoicePdfInput {
  company: { name: string; ssmNo: string; address: string; phone: string; email: string };
  invoice: InvoiceView;
}

export async function renderInvoice({ company, invoice }: InvoicePdfInput): Promise<Buffer> {
  const t = invoiceTotals(invoice.lines, invoice.discount, invoice.tax);
  const kv = (k: string, v: string) => (
    <View style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text style={[s.bold, { width: 90 }]}>{k}:</Text>
      <Text>{v}</Text>
    </View>
  );
  const doc = (
    <Document title={`${invoice.type} ${invoice.refNo}`}>
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: NAVY }}>{company.name}</Text>
            {company.ssmNo ? <Text>({company.ssmNo})</Text> : null}
            <Text>{company.address}</Text>
            <Text>{[company.phone, company.email].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 24, color: NAVY }}>{invoice.type}</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 24, marginBottom: 18 }}>
          <View style={{ width: '55%' }}>
            {kv('Attention', invoice.attention)}
            {kv('Company', invoice.company)}
            {kv('Address', invoice.address)}
            {kv('Phone', invoice.phone)}
            {kv('Email', invoice.email)}
          </View>
          <View style={{ width: '45%' }}>
            {kv('Date', invoice.date)}
            {kv('Reference No', invoice.refNo)}
            {kv('Sales Type', invoice.salesType)}
            {kv('Sales Person', invoice.salesPerson)}
          </View>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: NAVY, color: '#fff', paddingVertical: 4 }}>
          <Text style={{ width: 28, textAlign: 'center' }}>NO</Text>
          <Text style={{ flexGrow: 1 }}>DESCRIPTION</Text>
          <Text style={{ width: 80, textAlign: 'right' }}>PRICE</Text>
          <Text style={{ width: 50, textAlign: 'right' }}>QTY</Text>
          <Text style={{ width: 90, textAlign: 'right', paddingRight: 4 }}>TOTAL</Text>
        </View>
        {invoice.lines.map((l, i) => (
          <View key={i} style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5 }} wrap={false}>
            <Text style={{ width: 28, textAlign: 'center' }}>{i + 1}</Text>
            <Text style={{ flexGrow: 1, paddingRight: 8 }}>{l.description}</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{fmt(l.price)}</Text>
            <Text style={{ width: 50, textAlign: 'right' }}>{l.qty}</Text>
            <Text style={{ width: 90, textAlign: 'right', paddingRight: 4 }}>{fmt(lineTotal(l.price, l.qty))}</Text>
          </View>
        ))}
        <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
          {[['Subtotal', t.subtotal], ['Discount', invoice.discount], ['Tax', invoice.tax]].map(([k, v]) => (
            <View key={k as string} style={{ flexDirection: 'row', marginBottom: 2 }}>
              <Text style={[s.bold, { width: 90, textAlign: 'right' }]}>{k as string}</Text>
              <Text style={{ width: 94, textAlign: 'right', paddingRight: 4 }}>{fmt(v as number)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', backgroundColor: '#E7E6E6', paddingVertical: 3, marginTop: 2 }}>
            <Text style={[s.bold, { width: 90, textAlign: 'right' }]}>Total (RM)</Text>
            <Text style={[s.bold, { width: 94, textAlign: 'right', paddingRight: 4 }]}>{fmt(t.total)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
