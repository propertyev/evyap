// Server-side upload parsing: Excel (.xlsx/.xls/.xlsm), CSV and text PDFs -> normalised rows.
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  describeMap, detectColumns, extractRows, findHeaderRow, headerSignature, type ColumnMap, type RawRow,
} from './columns';
import { parseDate } from './dates';
import { extractPdfText, parseStatementText } from './pdf';

export interface ParsedSheet {
  fileName: string;
  fileType: 'xlsx' | 'csv' | 'pdf';
  sheetName: string;
  headerIndex: number;
  headers: string[];
  signature: string;
  columnMap: ColumnMap;
  mapSource: 'saved' | 'auto' | 'manual' | 'pdf';
  mapDescription: string;
  rows: RawRow[];
  /** header + first rows, for the mapping dialog */
  preview: string[][];
  warnings: string[];
}

export interface ParseOptions {
  /** saved column maps keyed by header signature */
  savedFormats?: Map<string, ColumnMap>;
  /** manual override for a given sheet */
  override?: { sheetName?: string; columnMap: ColumnMap };
}

const cell = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function fileKind(name: string): 'xlsx' | 'csv' | 'pdf' | null {
  const n = name.toLowerCase();
  if (/\.(xlsx|xls|xlsm)$/.test(n)) return 'xlsx';
  if (/\.csv$/.test(n)) return 'csv';
  if (/\.pdf$/.test(n)) return 'pdf';
  return null;
}

function parseGrid(
  grid: unknown[][], fileName: string, fileType: 'xlsx' | 'csv', sheetName: string, opts: ParseOptions,
): ParsedSheet | null {
  const headerIndex = findHeaderRow(grid);
  if (headerIndex < 0) return null;
  const header = grid[headerIndex] ?? [];
  const signature = headerSignature(header);
  const sample = grid.slice(headerIndex + 1, headerIndex + 21);

  let columnMap: ColumnMap;
  let mapSource: ParsedSheet['mapSource'] = 'auto';
  const ov = opts.override;
  if (ov && (!ov.sheetName || ov.sheetName === sheetName)) {
    columnMap = ov.columnMap;
    mapSource = 'manual';
  } else if (opts.savedFormats?.has(signature)) {
    columnMap = opts.savedFormats.get(signature)!;
    mapSource = 'saved';
  } else {
    columnMap = detectColumns(header, sample);
  }
  const rows = extractRows(grid, headerIndex, columnMap, (v) => parseDate(v));
  return {
    fileName, fileType, sheetName, headerIndex,
    headers: header.map(cell), signature, columnMap, mapSource,
    mapDescription: describeMap(header, columnMap),
    rows,
    preview: grid.slice(headerIndex, headerIndex + 6).map((r) => (r ?? []).map(cell)),
    warnings: [],
  };
}

export async function parseUpload(buf: Buffer, fileName: string, opts: ParseOptions = {}): Promise<ParsedSheet[]> {
  const kind = fileKind(fileName);
  if (!kind) throw new Error(`Unsupported file type: ${fileName}`);
  const out: ParsedSheet[] = [];

  if (kind === 'xlsx') {
    const wb = XLSX.read(buf, { type: 'buffer' });
    for (const sheetName of wb.SheetNames) {
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
      const ps = parseGrid(grid, fileName, 'xlsx', sheetName, opts);
      if (ps && ps.rows.length) out.push(ps);
    }
  } else if (kind === 'csv') {
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const res = Papa.parse<string[]>(text, { skipEmptyLines: false });
    const ps = parseGrid(res.data as unknown[][], fileName, 'csv', 'CSV', opts);
    if (ps && ps.rows.length) out.push(ps);
  } else {
    const text = await extractPdfText(buf);
    const { rows, warnings } = parseStatementText(text);
    if (rows.length) {
      out.push({
        fileName, fileType: 'pdf', sheetName: 'PDF', headerIndex: 0,
        headers: ['Date', 'Details', 'Amount'], signature: 'pdf', columnMap: {}, mapSource: 'pdf',
        mapDescription: 'Text statement (dates, descriptions and amounts read from the PDF)',
        rows, preview: [], warnings,
      });
    }
  }
  return out;
}
