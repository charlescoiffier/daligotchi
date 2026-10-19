import type {
  AnimalAction,
  AnimalDescription,
  EggAction,
  EggDescription,
  Form,
  HouseholdAction,
  MessageKey,
  Stage,
} from '@daligotchi/core';

export interface Health {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  worldSpeed: number;
  serverTime: string;
}

export interface Player {
  id: string;
  pseudo: string;
}

export interface HouseholdAnimal {
  id: string;
  name: string;
  form: Form;
  stage: Stage;
  description: AnimalDescription;
}

export interface HouseholdEgg {
  id: string;
  description: EggDescription;
}

export interface Hatching {
  eggId: string;
  animalId: string;
  name: string;
  form: Form;
}

export interface Household {
  worldTime: number;
  home: MessageKey;
  slots: { used: number; total: number };
  animals: HouseholdAnimal[];
  eggs: HouseholdEgg[];
  /** Éclosions survenues pendant cette visite. */
  hatched: Hatching[];
}

export interface AdoptionEgg {
  id: string;
  origin: 'game' | 'player';
}

/** Un soin : action de foyer, ou action sur un animal (la balle sans animal va à tout le foyer). */
export type CareRequest =
  | { action: HouseholdAction }
  | { action: AnimalAction; animalId?: string }
  | { action: EggAction; eggId: string };

/** Erreur d'API : `status` 0 signifie que le serveur n'a pas répondu. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'unknown');
  return data as T;
}

export const api = {
  health: () => request<Health>('GET', '/api/health'),
  me: () => request<{ player: Player }>('GET', '/api/me'),
  login: (pseudo: string, password: string) =>
    request<{ player: Player }>('POST', '/api/auth/login', { pseudo, password }),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout'),
  household: () => request<Household>('GET', '/api/household'),
  care: (care: CareRequest) => request<Household>('POST', '/api/household/care', care),
  rename: (animalId: string, name: string) => request<{ ok: true }>('PATCH', `/api/animals/${animalId}`, { name }),
  adoption: () => request<{ eggs: AdoptionEgg[]; slotsTotal: number }>('GET', '/api/adoption'),
  adopt: (eggId: string) => request<Household>('POST', `/api/adoption/${eggId}/adopt`),
};
