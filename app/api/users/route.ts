import { api, json } from '@/lib/session';
import { prisma } from '@/lib/db';
import { createUser } from '@/lib/services/users';

export const POST = api(async ({ ctx }, req) => ({ id: await createUser(prisma, ctx, await json(req)) }));
