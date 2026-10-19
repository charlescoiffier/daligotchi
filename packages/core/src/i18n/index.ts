import fr from './fr.json';

/**
 * Textes du jeu, partagés par le jeu, le serveur et le simulateur.
 * Une future traduction ajoutera un fichier par langue avec les mêmes clés.
 */
export type MessageKey = keyof typeof fr;

/** Renvoie le texte français d'une clé, en remplaçant les {paramètres}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return fr[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
