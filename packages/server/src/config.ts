import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  SERVER_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  /** Multiplie l'écoulement du temps du monde (1 en production, plus en test). */
  WORLD_SPEED: z.coerce.number().positive().default(1),
  /** Dossier du jeu compilé à servir (production). Vide en développement : Vite s'en charge. */
  CLIENT_DIST: z.string().optional(),
  /** Essais de connexion autorisés par minute et par adresse. */
  LOGIN_ATTEMPTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  /** Dossier des migrations SQL, relatif au dossier courant. */
  MIGRATIONS_DIR: z.string().default('drizzle'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
