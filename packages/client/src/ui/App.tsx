import { useEffect, useState } from 'preact/hooks';
import { ApiError, api, type Player } from '../api/client.ts';
import { t } from '../i18n/index.ts';
import { HouseholdScreen } from './HouseholdScreen.tsx';
import { LoginScreen } from './LoginScreen.tsx';

type Session = { kind: 'checking' } | { kind: 'down' } | { kind: 'loggedOut' } | { kind: 'loggedIn'; player: Player };

export function App() {
  const [session, setSession] = useState<Session>({ kind: 'checking' });

  useEffect(() => {
    api
      .me()
      .then(({ player }) => setSession({ kind: 'loggedIn', player }))
      .catch((e) =>
        setSession(e instanceof ApiError && e.status === 401 ? { kind: 'loggedOut' } : { kind: 'down' }),
      );
  }, []);

  switch (session.kind) {
    case 'checking':
      return null;
    case 'down':
      return <p class="notice">{t('server.down')}</p>;
    case 'loggedOut':
      return <LoginScreen onLogin={(player) => setSession({ kind: 'loggedIn', player })} />;
    case 'loggedIn':
      return <HouseholdScreen player={session.player} onLogout={() => setSession({ kind: 'loggedOut' })} />;
  }
}
