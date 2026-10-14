'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { rmToSen, senToInput } from '@/lib/format';
import { fmt } from '@/lib/money';
import { TallyBadge } from './ui';
import { useToast } from './Toast';

interface Company { name: string; ssmNo: string; address: string; phone: string; email: string; logoUrl: string }
interface Figures {
  closingStock: number; openStock: number; openCapital: number; openPL: number; openCash: number; openLongTermLoan: number;
  openOtherLTLiab: number; openAdvances: number; openTradeDebtors: number; openCreditors: number;
}
interface User { id: string; name: string; email: string; role: string }

const LY: [keyof Figures, string][] = [
  ['openStock', 'Stok Awal (Opening Stock)'],
  ['openCapital', 'Modal Awal (Opening Capital)'],
  ['openPL', 'Untung/Rugi Mula (Opening P&L)'],
  ['openCash', 'Baki Mula (Opening Cash & Bank)'],
  ['openLongTermLoan', 'Long Term Loan'],
  ['openOtherLTLiab', 'Other long-term liabilities'],
  ['openAdvances', 'Advances, Deposits & Prepayment'],
  ['openTradeDebtors', 'Trade Debtor'],
  ['openCreditors', 'Creditor, accruals & other liabilities'],
];

export function SetupClient({
  company, figures, openingTally, year, locked, canEdit, canClose, canReopen, canManageUsers, canAudit, users, tally,
}: {
  company: Company; figures: Figures; openingTally: { assets: number; equityAndLiabilities: number; difference: number };
  year: number; locked: boolean; canEdit: boolean; canClose: boolean; canReopen: boolean; canManageUsers: boolean;
  canAudit: boolean; users: User[]; tally: number;
}) {
  const router = useRouter();
  const { show, node } = useToast();
  const [c, setC] = useState(company);
  const [f, setF] = useState<Record<keyof Figures, string>>(
    () => Object.fromEntries(Object.entries(figures).map(([k, v]) => [k, senToInput(v)])) as Record<keyof Figures, string>,
  );
  const [nu, setNu] = useState({ name: '', email: '', role: 'STAFF', password: '' });

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      show(ok);
      router.refresh();
    } catch (e) {
      show((e as Error).message, 'err');
    }
  }

  const figuresBody = () =>
    Object.fromEntries(Object.keys(figures).map((k) => [k, rmToSen(f[k as keyof Figures])]));

  return (
    <section>
      <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
        <table className="xl" style={{ maxWidth: 460 }}>
          <thead><tr><th colSpan={2}>Company Profile</th></tr></thead>
          <tbody>
            {([['name', 'Company Name'], ['ssmNo', 'SSM No'], ['address', 'Address'], ['phone', 'Phone'], ['email', 'Email']] as const).map(([k, l]) => (
              <tr key={k}>
                <td><label htmlFor={`c-${k}`} style={{ margin: 0 }}>{l}</label></td>
                <td><input id={`c-${k}`} value={c[k]} disabled={!canEdit} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></td>
              </tr>
            ))}
            <tr>
              <td><label htmlFor="c-logo" style={{ margin: 0 }}>Logo</label></td>
              <td>
                {c.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logoUrl} alt="Logo" style={{ maxHeight: 48, display: 'block', marginBottom: 4 }} />
                )}
                <input id="c-logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" disabled={!canEdit}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 400_000) return show('Logo must be under 400 KB.', 'err');
                    const r = new FileReader();
                    r.onload = () => setC((cur) => ({ ...cur, logoUrl: String(r.result) }));
                    r.readAsDataURL(file);
                  }} />
              </td>
            </tr>
            <tr>
              <td colSpan={2}>
                <button className="btn pri" type="button" disabled={!canEdit}
                  onClick={() => run(() => apiFetch('/api/setup/company', { method: 'PUT', body: c }), 'Company profile saved.')}>
                  <i>✓</i>Save profile
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="xl" style={{ maxWidth: 520 }}>
          <thead><tr><th colSpan={2}>Last Year Figure (Baki Awal) — FY{year}</th></tr></thead>
          <tbody>
            <tr>
              <td><label htmlFor="f-close" style={{ margin: 0 }}>Stok Akhir / Closing Stock (RM)</label></td>
              <td><input id="f-close" className="inp" inputMode="decimal" value={f.closingStock} disabled={!canEdit || locked}
                onChange={(e) => setF({ ...f, closingStock: e.target.value })} /></td>
            </tr>
            {LY.map(([k, l]) => (
              <tr key={k}>
                <td><label htmlFor={`f-${k}`} style={{ margin: 0 }}>{l}</label></td>
                <td><input id={`f-${k}`} className="inp" inputMode="decimal" value={f[k]} disabled={!canEdit || locked}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })} /></td>
              </tr>
            ))}
            <tr>
              <td colSpan={2}>
                <button className="btn pri" type="button" disabled={!canEdit || locked}
                  onClick={() => run(() => apiFetch('/api/setup/year', { method: 'PUT', body: { year, figures: figuresBody() } }), 'Figures saved.')}>
                  <i>✓</i>Save figures
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="title">Opening position check</div>
        <TallyBadge difference={openingTally.difference} />
        <p className="note" style={{ textAlign: 'center' }}>
          Opening assets (stock + cash + debtors + advances + fixed-asset NBV) {fmt(openingTally.assets)} vs opening capital + P&amp;L +
          liabilities {fmt(openingTally.equityAndLiabilities)}. Current Balance Sheet difference: {fmt(tally)}.
        </p>
      </div>

      <div className="ref" style={{ marginTop: 18 }}>
        <b>Year-end close — {year}</b>
        <p style={{ margin: '6px 0' }}>
          Locks {year} (read-only) and creates {year + 1} with opening balances carried forward from this year’s closing Balance Sheet.
        </p>
        <div className="row">
          {!locked && canClose && (
            <button className="btn red" type="button"
              onClick={async () => {
                if (!confirm(`Close ${year}? The year becomes read-only.`)) return;
                try {
                  await apiFetch('/api/year/close', { body: { year } });
                  show(`${year} closed. ${year + 1} created.`);
                  router.refresh();
                } catch (e) {
                  const err = e as Error & { code?: string };
                  if (err.code === 'NOT_TALLY' && confirm(`${err.message}\n\nClose anyway?`)) {
                    await run(() => apiFetch('/api/year/close', { body: { year, force: true } }), `${year} closed.`);
                  } else show(err.message, 'err');
                }
              }}>
              <i>🔒</i>Close year {year}
            </button>
          )}
          {locked && canReopen && (
            <button className="btn" type="button"
              onClick={() => confirm(`Reopen ${year}?`) && run(() => apiFetch('/api/year/reopen', { body: { year } }), `${year} reopened.`)}>
              Reopen {year}
            </button>
          )}
          {locked && !canReopen && <span className="note">This year is closed. Only the owner can reopen it.</span>}
          {canAudit && <Link className="btn" href="/audit">Audit log</Link>}
        </div>
      </div>

      {canManageUsers && (
        <div style={{ marginTop: 18 }}>
          <div className="title" style={{ textAlign: 'left' }}>Users &amp; roles</div>
          <div className="tw">
            <table className="xl" style={{ maxWidth: 760 }}>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                    <td>
                      <button className="btn red sm" type="button" aria-label={`Delete ${u.email}`}
                        onClick={() => confirm(`Delete ${u.email}?`) && run(() => apiFetch(`/api/users/${u.id}`, { method: 'DELETE' }), 'User deleted.')}>✕</button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td><input aria-label="New user name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder="Name" /></td>
                  <td><input aria-label="New user email" type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} placeholder="Email" /></td>
                  <td>
                    <select aria-label="New user role" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
                      <option>STAFF</option><option>ACCOUNTANT</option><option>OWNER</option>
                    </select>
                  </td>
                  <td>
                    <input aria-label="New user password" type="password" autoComplete="new-password" value={nu.password}
                      onChange={(e) => setNu({ ...nu, password: e.target.value })} placeholder="Password (10+ chars)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button className="btn pri" type="button" style={{ marginTop: 8 }}
            onClick={() => run(async () => {
              await apiFetch('/api/users', { body: nu });
              setNu({ name: '', email: '', role: 'STAFF', password: '' });
            }, 'User added.')}>
            <i>+</i>Add user
          </button>
          <p className="note">STAFF: data entry only (no delete, no settings). ACCOUNTANT: everything except clearing data, reopening years and managing users.</p>
        </div>
      )}
      {node}
    </section>
  );
}
