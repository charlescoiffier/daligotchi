import type { AnimalAction, EggAction, HouseholdAction, MessageKey } from '@daligotchi/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ApiError, api, type CareRequest, type Household, type Player } from '../api/client.ts';
import { bridge } from '../bridge.ts';
import { createGame, type GameHandle } from '../game/createGame.ts';
import { t } from '../i18n/index.ts';
import { ActionsPanel } from './ActionsPanel.tsx';
import { AdoptionPanel } from './AdoptionPanel.tsx';
import { AnimalCard } from './AnimalCard.tsx';
import { EggCard } from './EggCard.tsx';

const TOAST_DURATION_MS = 3000;
/** Rafraîchissement régulier du foyer (besoins, éclosions) tant que le jeu est ouvert. */
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

type Selection = { kind: 'animal'; id: string } | { kind: 'egg'; id: string } | null;
/** Action choisie avant la cible : il reste à toucher un animal ou un œuf. */
type Pending = { kind: 'animal'; action: AnimalAction } | { kind: 'egg'; action: EggAction } | null;
type Panel = 'actions' | 'adoption' | null;

interface HouseholdScreenProps {
  player: Player;
  onLogout: () => void;
}

export function HouseholdScreen({ player, onLogout }: HouseholdScreenProps) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [worldSpeed, setWorldSpeed] = useState(1);
  const [panel, setPanel] = useState<Panel>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const game = useRef<GameHandle | null>(null);
  const pendingRef = useRef<Pending>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(message: string) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  /** Nouveau foyer reçu du serveur : on l'affiche, et on fête les éclosions. */
  function updateHousehold(data: Household) {
    setHousehold(data);
    game.current?.setHousehold(data);
    for (const hatching of data.hatched) {
      const form = t(`form.${hatching.form}` as MessageKey).toLowerCase();
      showToast(t('hatch.born', { name: hatching.name, form }));
    }
  }

  function choosePending(next: Pending) {
    pendingRef.current = next;
    setPending(next);
  }

  function handleError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) return onLogout();
    showToast(t('actions.error'));
  }

  async function care(request: CareRequest) {
    setBusy(true);
    try {
      const data = await api.care(request);
      updateHousehold(data);
      const { action } = request;
      bridge.emit('care-performed', {
        action,
        animalId: 'animalId' in request ? request.animalId : undefined,
        eggId: 'eggId' in request ? request.eggId : undefined,
      });
      if (data.hatched.length > 0) return; // le message d'éclosion a la priorité
      const animalId = 'animalId' in request ? request.animalId : undefined;
      const name = data.animals.find((animal) => animal.id === animalId)?.name ?? '';
      if (action === 'ball' && !animalId) showToast(t('done.ballAll'));
      else showToast(t(`done.${action}` as MessageKey, { name }));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function adopt(eggId: string) {
    setBusy(true);
    try {
      updateHousehold(await api.adopt(eggId));
      setPanel(null);
      showToast(t('adoption.done'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'egg_unavailable') showToast(t('adoption.unavailable'));
      else if (e instanceof ApiError && e.code === 'no_free_slot') showToast(t('adoption.full', household?.slots ?? {}));
      else handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function rename(animalId: string, name: string) {
    try {
      await api.rename(animalId, name);
      updateHousehold(await api.household());
      return true;
    } catch {
      return false;
    }
  }

  // L'habitat Phaser vit tant que le joueur est connecté.
  useEffect(() => {
    game.current = createGame(document.getElementById('game')!);

    const onTargetSelected = (kind: 'animal' | 'egg', id: string) => {
      setSelection({ kind, id });
      // L'action avait été choisie avant la cible : on l'applique maintenant.
      const waiting = pendingRef.current;
      if (waiting?.kind === 'animal' && kind === 'animal') {
        choosePending(null);
        void care({ action: waiting.action, animalId: id });
      } else if (waiting?.kind === 'egg' && kind === 'egg') {
        choosePending(null);
        void care({ action: waiting.action, eggId: id });
      }
    };
    const offAnimal = bridge.on('animal-selected', ({ id }) => onTargetSelected('animal', id));
    const offEgg = bridge.on('egg-selected', ({ id }) => onTargetSelected('egg', id));

    // Chaque chargement est une visite : au retour sur l'onglet, et régulièrement.
    const load = () =>
      api
        .household()
        .then(updateHousehold)
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) onLogout();
        });
    const onVisible = () => document.visibilityState === 'visible' && load();
    const refresh = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_INTERVAL_MS);

    load();
    api.health().then((health) => setWorldSpeed(health.worldSpeed), () => {});
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(refresh);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(toastTimer.current);
      offAnimal();
      offEgg();
      game.current?.destroy();
      game.current = null;
    };
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  function closeCard() {
    setSelection(null);
    bridge.emit('animal-deselected', {});
  }

  const selectedAnimal =
    selection?.kind === 'animal' ? household?.animals.find((animal) => animal.id === selection.id) : undefined;
  const selectedEgg = selection?.kind === 'egg' ? household?.eggs.find((egg) => egg.id === selection.id) : undefined;
  const hasAnimals = (household?.animals.length ?? 0) > 0;
  const hasEggs = (household?.eggs.length ?? 0) > 0;
  const empty = household && !hasAnimals && !hasEggs;

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
        {selectedAnimal && !pending && (
          <AnimalCard
            key={selectedAnimal.id}
            animal={selectedAnimal}
            busy={busy}
            onAction={(action) => care({ action, animalId: selectedAnimal.id })}
            onRename={(name) => rename(selectedAnimal.id, name)}
            onClose={closeCard}
          />
        )}
        {selectedEgg && !pending && (
          <EggCard
            egg={selectedEgg}
            busy={busy}
            onAction={(action) => care({ action, eggId: selectedEgg.id })}
            onClose={closeCard}
          />
        )}
      </div>

      {!household && <p class="notice">{t('household.loading')}</p>}
      {empty && !panel && <p class="notice">{t('household.empty')}</p>}

      <footer class="bottom-bar">
        {toast && (
          <p class="toast" role="status">
            {toast}
          </p>
        )}
        {pending && (
          <div class="hint">
            <span>
              {t(pending.kind === 'animal' ? 'actions.chooseAnimal' : 'actions.chooseEgg', {
                action: t(`action.${pending.action}`),
              })}
            </span>
            <button type="button" class="button button--small" onClick={() => choosePending(null)}>
              {t('actions.cancel')}
            </button>
          </div>
        )}
        {panel === 'actions' && (
          <ActionsPanel
            hasAnimals={hasAnimals}
            hasEggs={hasEggs}
            busy={busy}
            onHomeAction={(action: HouseholdAction) => {
              setPanel(null);
              void care({ action });
            }}
            onBallForAll={() => {
              setPanel(null);
              void care({ action: 'ball' });
            }}
            onChooseAnimalAction={(action) => {
              setPanel(null);
              closeCard();
              choosePending({ kind: 'animal', action });
            }}
            onChooseEggAction={(action) => {
              setPanel(null);
              closeCard();
              choosePending({ kind: 'egg', action });
            }}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'adoption' && household && (
          <AdoptionPanel household={household} busy={busy} onAdopt={adopt} onClose={() => setPanel(null)} />
        )}
        {!panel && !pending && (
          <div class="bottom-bar__buttons">
            <button
              type="button"
              class="button button--secondary"
              disabled={!household}
              onClick={() => setPanel('adoption')}
            >
              {t('adoption.button')}
            </button>
            <button
              type="button"
              class="button button--primary actions-button"
              disabled={!household}
              onClick={() => setPanel('actions')}
            >
              {t('actions.button')}
            </button>
          </div>
        )}
      </footer>
    </>
  );
}

