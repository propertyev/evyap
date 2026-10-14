import type { Role } from './services/types';
import { AppError } from './errors';

export type Action =
  | 'entry:create'   // add / edit data
  | 'entry:delete'   // delete data rows
  | 'import:undo'
  | 'settings:edit'  // company profile, last-year figures, assets, tax config
  | 'year:close'
  | 'year:reopen'
  | 'data:clear'
  | 'users:manage'
  | 'audit:view';

const MATRIX: Record<Role, Action[]> = {
  OWNER: ['entry:create', 'entry:delete', 'import:undo', 'settings:edit', 'year:close', 'year:reopen', 'data:clear', 'users:manage', 'audit:view'],
  ACCOUNTANT: ['entry:create', 'entry:delete', 'import:undo', 'settings:edit', 'year:close', 'audit:view'],
  STAFF: ['entry:create'],
};

export const can = (role: Role, action: Action) => MATRIX[role]?.includes(action) ?? false;

export function assertCan(role: Role, action: Action) {
  if (!can(role, action)) throw new AppError('FORBIDDEN', `Your role (${role}) cannot perform this action.`, 403);
}
