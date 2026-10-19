export interface Health {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  worldSpeed: number;
  serverTime: string;
}

export async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/health');
  if (!response.ok && response.status !== 503) {
    throw new Error(`health: ${response.status}`);
  }
  return (await response.json()) as Health;
}
