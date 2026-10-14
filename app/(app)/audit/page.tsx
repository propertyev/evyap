import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getPage } from '@/lib/page';
import { can } from '@/lib/permissions';

export default async function Page() {
  const p = await getPage();
  if (!can(p.ctx.role, 'audit:view')) redirect('/dashboard');
  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({ where: { companyId: p.ctx.companyId }, orderBy: { at: 'desc' }, take: 300 }),
    prisma.user.findMany({ where: { companyId: p.ctx.companyId }, select: { id: true, email: true } }),
  ]);
  const who = new Map(users.map((u) => [u.id, u.email]));
  return (
    <section>
      <div className="title">Audit log</div>
      <div className="sub">Last 300 changes</div>
      <div className="tw">
        <table className="xl">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{l.at.toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td>{(l.userId && who.get(l.userId)) || 'system'}</td>
                <td>{l.action}</td>
                <td>{l.entity}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 480, wordBreak: 'break-all' }}>
                  {l.after !== 'null' ? l.after.slice(0, 240) : l.before.slice(0, 240)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
