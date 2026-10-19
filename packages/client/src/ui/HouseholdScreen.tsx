import type { AnimalAction, CareAction, HouseholdAction } from '@daligotchi/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ApiError, api, type Household, type Player } from '../api/client.ts';
import { bridge } from '../bridge.ts';
import { createGame, type GameHandle } from '../game/createGame.ts';
import { t } from '../i18n/index.ts';
import { ActionsPanel } from './ActionsPanel.tsx';
import { AnimalCard } from './AnimalCard.tsx';

const TOAST_DURATION_MS = 2500;

interface HouseholdScreenProps {
  player: Player;
  onLogout: () => void;
}

export function HouseholdScreen({ player, onLogout }: HouseholdScreenProps) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [worldSpeed, setWorldSpeed] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AnimalAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const game = useRef<GameHandle | null>(null);
  const pendingRef = useRef<AnimalAction | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function updateHousehold(data: Household) {
    setHousehold(data);
    game.current?.setHousehold(data);
  }

  function showToast(message: string) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  function choosePending(action: AnimalAction | null) {
    pendingRef.current = action;
    setPendingAction(action);
  }

  async function care(action: CareAction, animalId?: string) {
    setBusy(true);
    try {
      const data = await api.care(
        animalId ? { action: action as AnimalAction, animalId } : { action: action as HouseholdAction },
      );
      updateHousehold(data);
      bridge.emit('care-performed', { action, animalId });
      const name = data.animals.find((animal) => animal.id === animalId)?.name ?? '';
      if (action === 'ball' && !animalId) showToast(t('done.ballAll'));
      else showToast(t(`done.${action}`, { name }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onLogout();
      showToast(t('actions.error'));
    } finally {
      setBusy(false);
    }
  }

  // L'habitat Phaser vit tant que le joueur est connecté.
  useEffect(() => {
    game.current = createGame(document.getElementById('game')!);

    const offSelect = bridge.on('animal-selected', ({ id }) => {
      setSelectedId(id);
      // L'action avait été choisie avant l'animal : on l'applique maintenant.
      const pending = pendingRef.current;
      if (pending) {
        choosePending(null);
        void care(pending, id);
      }
    });

    // Chaque chargement est une visite : au retour sur l'onglet, on recharge le foyer.
    const load = () =>
      api
        .household()
        .then(updateHousehold)
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) onLogout();
        });
    const onVisible = () => document.visibilityState === 'visible' && load();

    load();
    api.health().then((health) => setWorldSpeed(health.worldSpeed), () => {});
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(toastTimer.current);
      offSelect();
      game.current?.destroy();
      game.current = null;
    };
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  function closeCard() {
    setSelectedId(null);
    bridge.emit('animal-deselected', {});
  }

  const selected = household?.animals.find((animal) => animal.id === selectedId);
  const hasAnimals = (household?.animals.length ?? 0) > 0;

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
        {selected && !pendingAction && (
          <AnimalCard animal={selected} busy={busy} onAction={(action) => care(action, selected.id)} onClose={closeCard} />
        )}
      </div>

      {!household && <p class="notice">{t('household.loading')}</p>}
      {household && !hasAnimals && <p class="notice">{t('household.empty')}</p>}

      <footer class="bottom-bar">
        {toast && (
          <p class="toast" role="status">
            {toast}
          </p>
        )}
        {pendingAction && (
          <div class="hint">
            <span>{t('actions.chooseAnimal', { action: t(`action.${pendingAction}`) })}</span>
            <button type="button" class="button button--small" onClick={() => choosePending(null)}>
              {t('actions.cancel')}
            </button>
          </div>
        )}
        {panelOpen && (
          <ActionsPanel
            hasAnimals={hasAnimals}
            busy={busy}
            onHomeAction={(action) => {
              setPanelOpen(false);
              void care(action);
            }}
            onBallForAll={() => {
              setPanelOpen(false);
              void care('ball');
            }}
            onChooseAnimalAction={(action) => {
              setPanelOpen(false);
              closeCard();
              choosePending(action);
            }}
            onClose={() => setPanelOpen(false)}
          />
        )}
        {!panelOpen && !pendingAction && (
          <button
            type="button"
            class="button button--primary actions-button"
            disabled={!household}
            onClick={() => setPanelOpen(true)}
          >
            {t('actions.button')}
          </button>
        )}
      </footer>
    </>
  );
}
