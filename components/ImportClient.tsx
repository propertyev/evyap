'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client';
import { fmt } from '@/lib/money';
import { takePendingFiles } from '@/lib/pending-files';
import { useToast } from './Toast';

interface Cat {
  name: string;
  direction: 'IN' | 'OUT';
  group: string;
}
interface Row {
  key: string;
  date: string;
  details: string;
  direction: 'IN' | 'OUT';
  amount: number;
  category: string;
  suggested: string;
  source: string;
  hash: string;
  duplicate: boolean;
  partyName?: string;
  removed?: boolean;
}
interface Sheet {
  fileName: string;
  fileType: string;
  sheetName: string;
  signature: string;
  headers: string[];
  columnMap: Record<string, number>;
  mapSource: string;
  mapDescription: string;
  preview: string[][];
  warnings: string[];
  rows: Row[];
}
interface Batch {
  id: string;
  fileName: string;
  rowCount: number;
  skipped: number;
  status: string;
  createdAt: string;
}

const ROLES: [string, string][] = [
  ['date', 'Date'], ['details', 'Details'], ['category', 'Category'], ['amount', 'Amount'],
  ['in', 'Cash In (Credit)'], ['out', 'Cash Out (Debit)'], ['flag', 'Dr/Cr flag'],
];

export function ImportClient({
  categories, batches, canUndo, parties, locked,
}: { categories: Cat[]; batches: Batch[]; canUndo: boolean; parties: { debtors: string[]; creditors: string[] }; locked: boolean }) {
  const router = useRouter();
  const { show, node } = useToast();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [mapping, setMapping] = useState<Sheet | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (list: File[]) => {
      if (!list.length) return;
      setBusy(true);
      try {
        const form = new FormData();
        list.forEach((f) => form.append('files', f));
        const res = await apiFetch<{ sheets: Sheet[] }>('/api/import/preview', { form });
        if (!res.sheets.length) {
          show('No transactions detected. Make sure the file has Date and Amount columns.', 'err');
        }
        setFiles(list);
        setSheets(res.sheets);
      } catch (e) {
        show((e as Error).message, 'err');
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  useEffect(() => {
    const p = takePendingFiles();
    if (p.length) void upload(p);
  }, [upload]);

  // drop anywhere on this page
  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      setHover(true);
    };
    const leave = () => setHover(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setHover(false);
      if (e.dataTransfer?.files.length) void upload([...e.dataTransfer.files]);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [upload]);

  const update = (si: number, ri: number, patch: Partial<Row>) =>
    setSheets((prev) =>
      prev.map((s, i) => (i !== si ? s : { ...s, rows: s.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) })),
    );

  const catsFor = (dir: 'IN' | 'OUT') => categories.filter((c) => c.direction === dir);
  const groupOf = (name: string) => categories.find((c) => c.name === name)?.group;

  async function commit(si: number) {
    const s = sheets[si];
    const rows = s.rows.filter((r) => !r.removed && !r.duplicate);
    if (!rows.length) {
      show('Nothing new to add — every row is a duplicate or removed.', 'err');
      return;
    }
    setBusy(true);
    try {
      const multi = sheets.filter((x) => x.fileName === s.fileName).length > 1;
      const res = await apiFetch<{ added: number; skipped: number; createdYears: number[]; switchToYear: number | null; learned: number }>(
        '/api/import/commit',
        {
          body: {
            fileName: multi ? `${s.fileName} › ${s.sheetName}` : s.fileName,
            fileType: s.fileType,
            columnMap: s.columnMap,
            signature: s.signature,
            rows: rows.map((r) => ({
              date: r.date, details: r.details, direction: r.direction, amount: r.amount, category: r.category,
              suggested: r.suggested, partyName: r.partyName || undefined,
            })),
          },
        },
      );
      const dup = s.rows.filter((r) => r.duplicate).length + res.skipped;
      show(
        `${res.added} transactions added${dup ? ` (${dup} duplicates skipped)` : ''}${res.learned ? ` · learned ${res.learned} rule(s)` : ''}${
          res.switchToYear ? ` · switched to ${res.switchToYear}` : ''
        }`,
      );
      setSheets((prev) => prev.filter((_, i) => i !== si));
      router.refresh();
    } catch (e) {
      show((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string) {
    if (!confirm('Undo this import? All transactions it added will be removed.')) return;
    try {
      const r = await apiFetch<{ removed: number }>(`/api/import/${id}/undo`, { method: 'POST' });
      show(`${r.removed} transactions removed.`);
      router.refresh();
    } catch (e) {
      show((e as Error).message, 'err');
    }
  }

  async function applyMapping(map: Record<string, number>) {
    if (!mapping) return;
    const f = files.find((x) => x.name === mapping.fileName);
    if (!f) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('files', f);
      form.append('columnMap', JSON.stringify(map));
      form.append('fileName', mapping.fileName);
      form.append('sheetName', mapping.sheetName);
      const res = await apiFetch<{ sheets: Sheet[] }>('/api/import/preview', { form });
      const fresh = res.sheets.find((s) => s.sheetName === mapping.sheetName);
      if (fresh) {
        setSheets((prev) => prev.map((s) => (s.fileName === mapping.fileName && s.sheetName === mapping.sheetName ? fresh : s)));
      } else show('That mapping produced no transactions.', 'err');
      setMapping(null);
    } catch (e) {
      show((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div
        className={`drop${hover ? ' hover' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        aria-label="Drop bank statement files here or press Enter to browse"
      >
        <div className="big">
          <i>⇪</i>Drag &amp; drop Excel / CSV / PDF files here
        </div>
        <div className="sm">
          .xlsx · .xls · .xlsm · .csv · text-based bank-statement .pdf — Date, Details, Amount / Debit / Credit and Category
          columns are detected automatically
        </div>
        <div className="sm" style={{ marginTop: 14 }}>
          <button
            className="btn pri"
            type="button"
            disabled={busy || locked}
            onClick={(e) => {
              e.stopPropagation();
              input.current?.click();
            }}
          >
            <i>▸</i>Browse files
          </button>{' '}
          <a className="btn" href="/api/import/sample" onClick={(e) => e.stopPropagation()}>
            <i>⤓</i>Download sample file
          </a>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept=".xlsx,.xls,.xlsm,.csv,.pdf"
          onChange={(e) => {
            void upload([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
      {busy && <p className="note">Working…</p>}

      {sheets.map((s, si) => {
        const live = s.rows.filter((r) => !r.removed);
        const dups = live.filter((r) => r.duplicate).length;
        return (
          <div key={`${s.fileName}:${s.sheetName}`} style={{ marginTop: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <b>
                  {s.fileName}
                  {s.sheetName !== 'CSV' && s.sheetName !== 'PDF' ? ` › ${s.sheetName}` : ''}
                </b>{' '}
                — {live.length} transactions detected{dups ? `, ${dups} already in the books (skipped)` : ''}
                <div className="note">
                  Columns{s.mapSource === 'saved' ? ' (saved bank format)' : ''}: {s.mapDescription || '—'}
                </div>
                {s.warnings.length > 0 && <div className="note">⚠ {s.warnings.length} row(s) had a guessed direction — please check.</div>}
              </div>
              <div className="row">
                {s.fileType !== 'pdf' && (
                  <button className="btn" type="button" onClick={() => setMapping(s)}>
                    <i>⚙</i>Edit column mapping
                  </button>
                )}
                <button className="btn red" type="button" onClick={() => setSheets((p) => p.filter((_, i) => i !== si))}>
                  <i>✕</i>Discard
                </button>
                <button className="btn pri" type="button" disabled={busy || locked} onClick={() => commit(si)}>
                  <i>✓</i>Add to ledger
                </button>
              </div>
            </div>
            <div className="tw">
              <table className="xl">
                <thead>
                  <tr>
                    <th>Date</th><th>Details</th><th>In / Out</th><th>Category</th><th>Party</th><th className="n">Amount (RM)</th><th />
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, ri) =>
                    r.removed ? null : (
                      <tr key={r.key} className={r.duplicate ? 'dup' : undefined}>
                        <td>{r.date}</td>
                        <td>
                          {r.details}
                          {r.duplicate && <span className="note"> · duplicate — will be skipped</span>}
                        </td>
                        <td>
                          <select
                            aria-label="Cash in or out"
                            value={r.direction}
                            onChange={(e) => {
                              const dir = e.target.value as 'IN' | 'OUT';
                              update(si, ri, { direction: dir, category: dir === 'IN' ? 'Sales' : 'Lain-lain Perbelanjaan' });
                            }}
                          >
                            <option value="IN">Cash In</option>
                            <option value="OUT">Cash Out</option>
                          </select>
                        </td>
                        <td>
                          <select aria-label="Category" value={r.category} onChange={(e) => update(si, ri, { category: e.target.value })}>
                            {catsFor(r.direction).map((c) => (
                              <option key={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {(groupOf(r.category) === 'DEBTOR' || groupOf(r.category) === 'CREDITOR') && (
                            <>
                              <input
                                aria-label="Debtor or creditor name"
                                list={`parties-${groupOf(r.category)}`}
                                value={r.partyName ?? ''}
                                placeholder="Name"
                                onChange={(e) => update(si, ri, { partyName: e.target.value })}
                              />
                            </>
                          )}
                        </td>
                        <td className="n">{fmt(r.amount)}</td>
                        <td>
                          <button className="btn red sm" type="button" aria-label="Remove row" onClick={() => update(si, ri, { removed: true })}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <datalist id="parties-DEBTOR">{parties.debtors.map((p) => <option key={p} value={p} />)}</datalist>
      <datalist id="parties-CREDITOR">{parties.creditors.map((p) => <option key={p} value={p} />)}</datalist>

      <div className="title" style={{ marginTop: 28 }}>Recent imports</div>
      <div className="tw">
        <table className="xl" style={{ maxWidth: 820, margin: '0 auto' }}>
          <thead>
            <tr><th>When</th><th>File</th><th className="n">Rows added</th><th className="n">Skipped</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr><td colSpan={6} className="note" style={{ textAlign: 'center' }}>No imports yet.</td></tr>
            )}
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.createdAt.slice(0, 16).replace('T', ' ')}</td>
                <td>{b.fileName}</td>
                <td className="n">{b.rowCount}</td>
                <td className="n">{b.skipped}</td>
                <td>{b.status === 'UNDONE' ? 'Undone' : 'Committed'}</td>
                <td>
                  {canUndo && b.status === 'COMMITTED' && (
                    <button className="btn sm red" type="button" onClick={() => undo(b.id)}>Undo</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mapping && <MappingDialog sheet={mapping} onClose={() => setMapping(null)} onApply={applyMapping} />}
      {node}
    </section>
  );
}

function MappingDialog({
  sheet, onClose, onApply,
}: { sheet: Sheet; onClose: () => void; onApply: (m: Record<string, number>) => void }) {
  const [map, setMap] = useState<Record<string, number | ''>>(() => ({ ...sheet.columnMap }));
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Column mapping">
      <div className="modal">
        <div className="title" style={{ textAlign: 'left' }}>Column mapping — {sheet.fileName}</div>
        <p className="note">Choose which column of the file holds each field. The mapping is remembered for this bank format.</p>
        <table className="xl" style={{ maxWidth: 520 }}>
          <tbody>
            {ROLES.map(([k, label]) => (
              <tr key={k}>
                <td><b>{label}</b></td>
                <td>
                  <select
                    value={map[k] === undefined ? '' : String(map[k])}
                    onChange={(e) => setMap({ ...map, [k]: e.target.value === '' ? '' : Number(e.target.value) })}
                  >
                    <option value="">— not used —</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(column ${i + 1})`}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.preview.length > 0 && (
          <div className="tw" style={{ marginTop: 12 }}>
            <table className="xl">
              <tbody>
                {sheet.preview.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => i === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          <button
            className="btn pri"
            type="button"
            onClick={() =>
              onApply(Object.fromEntries(Object.entries(map).filter(([, v]) => v !== '' && v !== undefined)) as Record<string, number>)
            }
          >
            Apply mapping
          </button>
        </div>
      </div>
    </div>
  );
}
