import fr from './fr.json';

export type MessageKey = keyof typeof fr;

/** Renvoie le texte français d'une clé, en remplaçant les {paramètres}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return fr[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
