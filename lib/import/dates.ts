// Date parsing for bank statements / Excel sheets. Returns ISO "YYYY-MM-DD" or null.
const MON: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Malay
  mac: 3, mei: 5, ogos: 8, okt: 10, dis: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function valid(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > dim) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

export function excelSerialToISO(serial: number): string | null {
  if (!(serial > 20000 && serial < 80000)) return null;
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * @param yearHint used for day/month-only dates ("05/01", "5 Jan") common in PDF statements
 */
export function parseDate(value: unknown, yearHint?: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return valid(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') return excelSerialToISO(value);
  const s = String(value).trim();
  if (!s) return null;

  // pure serial in a string
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToISO(parseFloat(s));

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // ISO / yyyy/mm/dd
  if (m) return valid(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[\s\-/.]([A-Za-z]{3,9})[\s\-/.,]*(\d{2,4})/); // 05 Jan 2026 / 05-Jan-26
  if (m) {
    const mo = MON[m[2].slice(0, 3).toLowerCase()] ?? MON[m[2].toLowerCase()];
    if (mo) return valid(fullYear(+m[3]), mo, +m[1]);
  }

  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/); // dd/mm/yyyy (Malaysian: day first)
  if (m) return valid(fullYear(+m[3]), +m[2], +m[1]);

  if (yearHint) {
    m = s.match(/^(\d{1,2})[\s\-/.]([A-Za-z]{3,9})\b/); // 05 Jan
    if (m) {
      const mo = MON[m[2].slice(0, 3).toLowerCase()];
      if (mo) return valid(yearHint, mo, +m[1]);
    }
    m = s.match(/^(\d{1,2})[/\-.](\d{1,2})$/); // 05/01
    if (m) return valid(yearHint, +m[2], +m[1]);
  }
  return null;
}
