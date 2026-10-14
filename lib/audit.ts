import type { Db, Ctx } from './services/types';

const replacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v);

export async function audit(
  db: Db, ctx: Pick<Ctx, 'companyId' | 'userId'>, action: string, entity: string, entityId: string,
  before: unknown = null, after: unknown = null,
) {
  await db.auditLog.create({
    data: {
      companyId: ctx.companyId, userId: ctx.userId, action, entity, entityId,
      before: JSON.stringify(before, replacer), after: JSON.stringify(after, replacer),
    },
  });
}
