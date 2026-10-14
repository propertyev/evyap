import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../audit';
import { AppError } from '../errors';
import { assertCan } from '../permissions';
import type { Ctx } from './types';

export const userInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(['OWNER', 'ACCOUNTANT', 'STAFF']),
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
});

export async function listUsers(prisma: PrismaClient, companyId: string) {
  const users = await prisma.user.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
}

export async function createUser(prisma: PrismaClient, ctx: Ctx, raw: z.input<typeof userInput>) {
  assertCan(ctx.role, 'users:manage');
  const input = userInput.parse(raw);
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new AppError('EMAIL_TAKEN', 'A user with this email already exists.', 409);
  }
  const u = await prisma.user.create({
    data: {
      companyId: ctx.companyId, name: input.name, email: input.email, role: input.role,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });
  await audit(prisma, ctx, 'USER_CREATE', 'User', u.id, null, { email: u.email, role: u.role });
  return u.id;
}

export async function deleteUser(prisma: PrismaClient, ctx: Ctx, id: string) {
  assertCan(ctx.role, 'users:manage');
  if (id === ctx.userId) throw new AppError('SELF', 'You cannot delete your own account.', 409);
  const u = await prisma.user.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!u) throw new AppError('NOT_FOUND', 'User not found', 404);
  await prisma.user.delete({ where: { id } });
  await audit(prisma, ctx, 'USER_DELETE', 'User', id, { email: u.email, role: u.role }, null);
}
