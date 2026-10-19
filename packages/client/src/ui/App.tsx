import { useEffect, useState } from 'preact/hooks';
import { ApiError, api, type Household, type Player } from '../api/client.ts';
import { bridge } from '../bridge.ts';
import { createGame } from '../game/createGame.ts';
import { t } from '../i18n/index.ts';
import { AnimalCard } from './AnimalCard.tsx';
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

function HouseholdScreen({ player, onLogout }: { player: Player; onLogout: () => void }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [worldSpeed, setWorldSpeed] = useState(1);

  // L'habitat Phaser vit tant que le joueur est connecté.
  useEffect(() => {
    const game = createGame(document.getElementById('game')!);
    const offSelect = bridge.on('animal-selected', ({ id }) => setSelectedId(id));

    // Chaque chargement est une visite : au retour sur l'onglet, on recharge le foyer.
    const load = () =>
      api
        .household()
        .then((data) => {
          setHousehold(data);
          game.setHousehold(data);
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) onLogout();
        });
    const onVisible = () => document.visibilityState === 'visible' && load();

    load();
    api.health().then((health) => setWorldSpeed(health.worldSpeed), () => {});
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      offSelect();
      game.destroy();
    };
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  const selected = household?.animals.find((animal) => animal.id === selectedId);

  return (
    <>
      <div class="top">
        <header class="top-bar">
          <div>
            <h1>{t('app.title')}</h1>
            <p class="top-bar__info">
              {player.pseudo}
              {household && ` · ${t('household.slots', household.slots)} · ${t(household.home)}`}
              {worldSpeed !== 1 && ` · ${t('server.worldSpeed', { speed: worldSpeed })}`}
            </p>
          </div>
          <button type="button" class="button button--small" onClick={logout}>
            {t('logout')}
          </button>
        </header>
        {selected && <AnimalCard animal={selected} onClose={() => setSelectedId(null)} />}
      </div>

      {!household && <p class="notice">{t('household.loading')}</p>}
      {household?.animals.length === 0 && <p class="notice">{t('household.empty')}</p>}

      <footer class="bottom-bar">
        <button type="button" class="button button--primary actions-button" disabled title={t('actions.soon')}>
          {t('actions.button')}
        </button>
      </footer>
    </>
  );
}
