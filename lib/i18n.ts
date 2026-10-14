import dict from '../i18n/en-ms.json';

type Dict = typeof dict;

/** t('menu.dashboard') -> string. Missing keys return the key itself. */
export function t(key: string): string {
  let cur: unknown = dict as Dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}
