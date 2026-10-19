import { useEffect, useState } from 'preact/hooks';
import { fetchHealth, type Health } from '../api/client.ts';
import { t } from '../i18n/index.ts';

type ServerState = { kind: 'checking' } | { kind: 'ok'; health: Health } | { kind: 'down' };

export function App() {
  const [server, setServer] = useState<ServerState>({ kind: 'checking' });

  useEffect(() => {
    fetchHealth()
      .then((health) => setServer(health.status === 'ok' ? { kind: 'ok', health } : { kind: 'down' }))
      .catch(() => setServer({ kind: 'down' }));
  }, []);

  return (
    <>
      <header class="top-bar">
        <h1>{t('app.title')}</h1>
        <span class={`status status--${server.kind}`}>
          {server.kind === 'checking' && t('server.checking')}
          {server.kind === 'down' && t('server.down')}
          {server.kind === 'ok' &&
            (server.health.worldSpeed === 1
              ? t('server.ok')
              : `${t('server.ok')} · ${t('server.worldSpeed', { speed: server.health.worldSpeed })}`)}
        </span>
      </header>
      <footer class="bottom-bar">
        <button type="button" class="actions-button" disabled title={t('actions.soon')}>
          {t('actions.button')}
        </button>
      </footer>
    </>
  );
}
