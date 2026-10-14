import { api } from '@/lib/session';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { previewImport } from '@/lib/services/import';

export const runtime = 'nodejs';
const MAX_BYTES = 15 * 1024 * 1024;

// multipart: files[] (+ optional columnMap JSON, sheetName, fileName to override mapping for one file)
export const POST = api(async ({ ctx }, req) => {
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) throw new AppError('NO_FILES', 'Choose at least one file.', 400);
  const uploads = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) throw new AppError('TOO_LARGE', `${f.name} is larger than 15 MB.`, 413);
    uploads.push({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) });
  }
  const cm = form.get('columnMap');
  const override = typeof cm === 'string' && cm
    ? {
        fileName: (form.get('fileName') as string) || undefined,
        sheetName: (form.get('sheetName') as string) || undefined,
        columnMap: JSON.parse(cm),
      }
    : undefined;
  let sheets;
  try {
    sheets = await previewImport(prisma, ctx.companyId, uploads, override);
  } catch (e) {
    if (e instanceof Error && /Unsupported file type/.test(e.message)) throw new AppError('UNSUPPORTED', e.message, 415);
    throw e;
  }
  return { sheets };
});
