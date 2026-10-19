import { t } from '../i18n/index.ts';

/** « Roux », « Roux et Bulle », « Roux, Bulle et Pépite ». */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names.at(-1)}`;
}
