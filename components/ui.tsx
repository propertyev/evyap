import type { ReactNode } from 'react';
import { fmt } from '@/lib/money';
import type { Grid, Statement } from '@/lib/statements';
import { t } from '@/lib/i18n';

export function Rujukan({ children }: { children: ReactNode }) {
  return (
    <div className="ref">
      <u>{t('rujukan.label')}</u>
      <br />
      {children}
    </div>
  );
}

export function PageHeader({
  title, company, year, extra,
}: { title: string; company: string; year: number; extra?: string }) {
  return (
    <>
      <div className="title">{title}</div>
      <div className="sub">
        {company}
        <br />
        {extra ?? `For The Year Ended 31 December ${year}`}
      </div>
    </>
  );
}

export function TallyBadge({ difference, hint = true }: { difference: number; hint?: boolean }) {
  const ok = difference === 0;
  return (
    <div className={`tally ${ok ? 'ok' : 'bad'}`} role="status">
      {ok
        ? t('tally.ok')
        : `${t('tally.bad')} ${fmt(Math.abs(difference))}${hint ? ` · ${t('tally.hint')}` : ''}`}
    </div>
  );
}

export function LockedBanner({ locked }: { locked: boolean }) {
  return locked ? <div className="lock">This financial year is closed and read-only.</div> : null;
}

export function StatementTable({ s, showNotes = true }: { s: Statement; showNotes?: boolean }) {
  return (
    <table className="stmt">
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }} />
          {showNotes && <th style={{ textAlign: 'center' }}>Notes</th>}
          <th>{s.columnLabel}</th>
        </tr>
      </thead>
      <tbody>
        {s.lines.map((l, i) =>
          l.style === 'sp' ? (
            <tr key={i}>
              <td colSpan={3} style={{ height: 10 }} />
            </tr>
          ) : (
            <tr key={i} className={l.style && l.style !== 'n' ? l.style : undefined}>
              <td>{l.label}</td>
              {showNotes && <td className="nt">{l.note ?? ''}</td>}
              <td className="n">{l.value === null || l.value === undefined ? '' : fmt(l.value)}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

export function GridTable({ g, maxWidth }: { g: Grid; maxWidth?: number }) {
  const cols = g.header.length;
  return (
    <div className="tw">
      <table className="xl" style={maxWidth ? { maxWidth, margin: '0 auto' } : undefined}>
        <thead>
          <tr>
            {g.header.map((h, i) => (
              <th key={i} className={i > 0 ? 'n' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r, i) =>
            r.style === 'sec' ? (
              <tr key={i} className="sec">
                <td colSpan={cols}>{r.label}</td>
              </tr>
            ) : (
              <tr key={i} className={r.style === 'tot' ? 'tot' : undefined}>
                <td>{r.label}</td>
                {r.values.map((v, j) => (
                  <td key={j} className="n">
                    {fmt(v, { dash: r.style !== 'tot' })}
                  </td>
                ))}
                {r.total !== undefined && g.header.length === r.values.length + 2 && (
                  <td className="n">{fmt(r.total)}</td>
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
      {g.note && <p className="note">{g.note}</p>}
    </div>
  );
}
