import { getPage } from '@/lib/page';
import { COVER_INDEX } from '@/lib/statements';

export default async function Page() {
  const { company, year } = await getPage();
  return (
    <section>
      <div className="row noprint" style={{ justifyContent: 'flex-end' }}>
        <a className="btn pri" href={`/api/pdf/pack?year=${year}`} target="_blank" rel="noreferrer">
          <i>⎙</i>Print Management Accounts
        </a>
      </div>
      <div className="cover">
        <h1>{company.name}</h1>
        <div>{company.ssmNo}</div>
        <div style={{ marginTop: 6 }}>31 Dec {year}</div>
        <div style={{ marginTop: 30, fontWeight: 700 }}>(MANAGEMENT ACCOUNTS)</div>
        <table>
          <tbody>
            <tr><td><b>INDEX</b></td><td><b>PAGE</b></td></tr>
            {COVER_INDEX.map(([n, p]) => (
              <tr key={n}><td>{n}</td><td>{p}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
