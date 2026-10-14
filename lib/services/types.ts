import type { Prisma, PrismaClient } from '@prisma/client';

export type Db = PrismaClient | Prisma.TransactionClient;
export type Role = 'OWNER' | 'ACCOUNTANT' | 'STAFF';

export interface Ctx {
  companyId: string;
  userId: string | null;
  role: Role;
}

export const num = (v: bigint | number | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
export const big = (n: number): bigint => BigInt(Math.round(n));
