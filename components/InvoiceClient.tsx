'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { rmToSen, senToInput, today } from '@/lib/format';
import { fmt } from '@/lib/money';
import { invoiceTotals, type InvoiceView } from '@/lib/invoice-math';
import { useToast } from './Toast';

interface Company { name: string; ssmNo: string; address: string; phone: string; email: string; logoUrl: string }
interface Draft {
  id?: string; type: 'INVOICE' | 'RECEIPT'; refNo: string; date: string; attention: string; company: string; address: string;
  phone: string; email: string; salesType: string; salesPerson: string; discount: string; tax: string; recorded: boolean;
  lines: { description: string; price: string; qty: string }[];
}

const blank = (type: 'INVOICE' | 'RECEIPT', year: number): Draft => ({
  type, refNo: '', date: today().startsWith(String(year)) ? today() : `${year}-01-01`, attention: '', company: '', address: '',
  phone: '', email: '', salesType: '', salesPerson: '', discount: '', tax: '', recorded: false,
  lines: [{ description: '', price: '', qty: '1' }],
});

const fromView = (v: InvoiceView): Draft => ({
  id: v.id, type: v.type, refNo: v.refNo, date: v.date, attention: v.attention, company: v.company, address: v.address,
  phone: v.phone, email: v.email, salesType: v.salesType, salesPerson: v.salesPerson,
  discount: senToInput(v.discount), tax: senToInput(v.tax), recorded: v.recorded,
  lines: v.lines.map((l) => ({ description: l.description, price: senToInput(l.price), qty: String(l.qty) })),
});

export function InvoiceClient({
  invoices, company, year, locked, canDelete,
}: { invoices: InvoiceView[]; company: Company; year: number; locked: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { show, node } = useToast();
  const [d, setD] = useState<Draft>(() => blank('INVOICE', year));
  const [busy, setBusy] = useState(false);

  // next reference number for new documents
  useEffect(() => {
    if (d.id || d.refNo) return;
    apiFetch<{ refNo: string }>(`/api/invoices?nextRef=${d.type}&year=${d.date.slice(0, 4)}`)
      .then((r) => setD((cur) => (cur.id || cur.refNo ? cur : { ...cur, refNo: r.refNo })))
      .catch(() => undefined);
  }, [d.id, d.refNo, d.type, d.date]);

  const lines = d.lines.map((l) => ({ price: rmToSen(l.price), qty: Number(l.qty) || 0 }));
  const totals = invoiceTotals(lines, rmToSen(d.discount), rmToSen(d.tax));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const setLine = (i: number, k: 'description' | 'price' | 'qty', v: string) =>
    setD((cur) => ({ ...cur, lines: cur.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const readOnly = d.recorded || locked;

  const payload = () => ({
    id: d.id, type: d.type, refNo: d.refNo || undefined, date: d.date, attention: d.attention, company: d.company,
    address: d.address, phone: d.phone, email: d.email, salesType: d.salesType, salesPerson: d.salesPerson,
    discount: rmToSen(d.discount), tax: rmToSen(d.tax),
    lines: d.lines.map((l) => ({ description: l.description, price: rmToSen(l.price), qty: Number(l.qty) || 0 })),
  });

  async function save(): Promise<string | null> {
    try {
      const r = await apiFetch<{ id: string }>('/api/invoices', { body: payload() });
      setD((cur) => ({ ...cur, id: r.id }));
      return r.id;
    } catch (e) {
      show((e as Error).message, 'err');
      return null;
    }
  }

  async function record() {
    if (totals.total <= 0) return show('Tiada amaun — nothing to record.', 'err');
    setBusy(true);
    const id = d.id ?? (await save());
    if (id) {
      try {
        const r = await apiFetch<{ as: string }>(`/api/invoices/${id}/record`, { method: 'POST' });
        show(r.as === 'DEBTOR' ? 'Recorded as Debtor (credit sale).' : 'Recorded as Cash In – Sales.');
        setD((cur) => ({ ...cur, recorded: true, id }));
        router.refresh();
      } catch (e) {
        show((e as Error).message, 'err');
      }
    }
    setBusy(false);
  }

  const F = ({ k, label, type = 'text' }: { k: keyof Draft; label: string; type?: string }) => (
    <tr>
      <td><b>{label}:</b></td>
      <td>
        <input type={type} aria-label={label} value={d[k] as string} disabled={readOnly}
          onChange={(e) => set(k, e.target.value as never)} />
      </td>
    </tr>
  );

  return (
    <section>
      <div className="row noprint" style={{ marginBottom: 10 }}>
        <select aria-label="Document type" value={d.type} disabled={!!d.id}
          onChange={(e) => setD({ ...d, type: e.target.value as 'INVOICE' | 'RECEIPT', refNo: '' })}>
          <option>INVOICE</option><option>RECEIPT</option>
        </select>
        <button className="btn" type="button" disabled={readOnly} onClick={() => set('lines', [...d.lines, { description: '', price: '', qty: '1' }])}>+ Line</button>
        <button className="btn" type="button" disabled={readOnly || busy} onClick={async () => { const id = await save(); if (id) { show('Saved.'); router.refresh(); } }}>Save</button>
        <button className="btn" type="button" onClick={() => window.print()}>⎙ Print</button>
        {d.id && <a className="btn" href={`/api/pdf/invoice/${d.id}`} target="_blank" rel="noreferrer">⤓ PDF</a>}
        <button className="btn pri" type="button" disabled={readOnly || busy} onClick={record}>✓ Record</button>
        <button className="btn red" type="button" onClick={() => setD(blank('INVOICE', year))}>New</button>
      </div>

      <div className="paper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div>
            <div className="mark" style={{ fontSize: 24 }}>
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} />
              ) : (
                <><i>E</i>{company.name}</>
              )}
            </div>
            <div className="note">
              {company.ssmNo ? `(${company.ssmNo})` : ''}<br />{company.address}<br />{company.phone}
              {company.email ? ` · ${company.email}` : ''}
            </div>
          </div>
          <h1>{d.type}</h1>
        </div>
        <table style={{ margin: '18px 0', width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <F k="attention" label="Attention" />
                    <F k="company" label="Company" />
                    <F k="address" label="Address" />
                    <F k="phone" label="Phone" />
                    <F k="email" label="Email" />
                  </tbody>
                </table>
              </td>
              <td style={{ verticalAlign: 'top' }}>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <F k="date" label="Date" type="date" />
                    <F k="refNo" label="Reference No" />
                    <F k="salesType" label="Sales Type" />
                    <F k="salesPerson" label="Sales Person" />
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <table className="xl">
          <thead>
            <tr><th>NO</th><th>DESCRIPTION</th><th className="n">PRICE</th><th className="n">QTY</th><th className="n">TOTAL</th></tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input aria-label={`Description ${i + 1}`} value={l.description} disabled={readOnly} onChange={(e) => setLine(i, 'description', e.target.value)} /></td>
                <td className="n"><input aria-label={`Price ${i + 1}`} inputMode="decimal" style={{ textAlign: 'right' }} value={l.price} disabled={readOnly} onChange={(e) => setLine(i, 'price', e.target.value)} /></td>
                <td className="n"><input aria-label={`Quantity ${i + 1}`} inputMode="decimal" style={{ textAlign: 'right', width: 60 }} value={l.qty} disabled={readOnly} onChange={(e) => setLine(i, 'qty', e.target.value)} /></td>
                <td className="n">{lines[i].price * lines[i].qty ? fmt(Math.round(lines[i].price * lines[i].qty)) : ''}</td>
              </tr>
            ))}
            <tr><td colSpan={3} style={{ border: 0 }} /><td><b>Subtotal</b></td><td className="n">{fmt(totals.subtotal)}</td></tr>
            <tr>
              <td colSpan={3} style={{ border: 0 }} /><td><b>Discount</b></td>
              <td className="n"><input aria-label="Discount" inputMode="decimal" style={{ textAlign: 'right' }} value={d.discount} disabled={readOnly} onChange={(e) => set('discount', e.target.value)} /></td>
            </tr>
            <tr>
              <td colSpan={3} style={{ border: 0 }} /><td><b>Tax</b></td>
              <td className="n"><input aria-label="Tax" inputMode="decimal" style={{ textAlign: 'right' }} value={d.tax} disabled={readOnly} onChange={(e) => set('tax', e.target.value)} /></td>
            </tr>
            <tr className="tot"><td colSpan={3} style={{ border: 0, background: '#fff' }} /><td>Total (RM)</td><td className="n">{fmt(totals.total)}</td></tr>
          </tbody>
        </table>
        {d.recorded && <p className="note">✓ Recorded in the books</p>}
      </div>

      <div className="title noprint" style={{ marginTop: 20 }}>Issued Documents</div>
      <div className="tw noprint">
        <table className="xl">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Ref No</th><th>Company</th><th className="n">Total (RM)</th><th>Recorded</th><th /></tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={7} className="note" style={{ textAlign: 'center' }}>None yet.</td></tr>}
            {invoices.map((x) => (
              <tr key={x.id}>
                <td>{x.date}</td><td>{x.type}</td><td>{x.refNo}</td><td>{x.company || x.attention}</td>
                <td className="n">{fmt(x.total)}</td><td>{x.recorded ? '✓' : ''}</td>
                <td>
                  <div className="row">
                    <button className="btn sm" type="button" onClick={() => setD(fromView(x))}>Open</button>
                    {canDelete && !locked && (
                      <button className="btn red sm" type="button" aria-label={`Delete ${x.refNo}`}
                        onClick={async () => {
                          if (!confirm(`Delete ${x.refNo}${x.recorded ? ' and the entry it created' : ''}?`)) return;
                          try { await apiFetch(`/api/invoices/${x.id}`, { method: 'DELETE' }); router.refresh(); }
                          catch (e) { show((e as Error).message, 'err'); }
                        }}>✕</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {node}
    </section>
  );
}
