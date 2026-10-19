import type { AnimalDescription, Form, MessageKey, Stage } from '@daligotchi/core';

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

export interface Household {
  worldTime: number;
  home: MessageKey;
  slots: { used: number; total: number };
  animals: HouseholdAnimal[];
}

/** Erreur d'API : `status` 0 signifie que le serveur n'a pas répondu. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

async function request<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
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
};
