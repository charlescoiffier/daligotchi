import type { AnimalAction, EggAction, HouseholdAction, MessageKey } from '@daligotchi/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  ApiError,
  api,
  type CareRequest,
  type Friends,
  type Household,
  type Meeting,
  type MeetingInteraction,
  type Meetings,
  type Player,
} from '../api/client.ts';
import { bridge } from '../bridge.ts';
import { createGame, type GameHandle } from '../game/createGame.ts';
import { t } from '../i18n/index.ts';
import { ActionsPanel } from './ActionsPanel.tsx';
import { AdoptionPanel } from './AdoptionPanel.tsx';
import { AnimalCard } from './AnimalCard.tsx';
import { EggCard } from './EggCard.tsx';
import { FarewellPanel } from './FarewellPanel.tsx';
import { GenealogyPanel, type GenealogyTarget } from './GenealogyPanel.tsx';
import { MeetingOverlay } from './MeetingOverlay.tsx';
import { MeetingsPanel } from './MeetingsPanel.tsx';
import { joinNames } from './names.ts';
import { NestPanel } from './NestPanel.tsx';

const TOAST_DURATION_MS = 3000;
/** Rafraîchissement régulier du foyer (besoins, éclosions) tant que le jeu est ouvert. */
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

type Selection = { kind: 'animal'; id: string } | { kind: 'egg'; id: string } | null;
/** Action choisie avant la cible : il reste à toucher un animal ou un œuf. */
type Pending = { kind: 'animal'; action: AnimalAction } | { kind: 'egg'; action: EggAction } | null;
type Panel = 'actions' | 'adoption' | 'nest' | 'genealogy' | 'meetings' | null;

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
  const [genealogy, setGenealogy] = useState<GenealogyTarget | null>(null);
  /** Adieux à montrer, un par un, après la scène. */
  const [farewells, setFarewells] = useState<string[]>([]);
  const [meetings, setMeetings] = useState<Meetings | null>(null);
  const [friends, setFriends] = useState<Friends | null>(null);
  /** Scène de rencontre en cours (jouée ou revue en souvenir). */
  const [scene, setScene] = useState<{ meeting: Meeting; mode: 'play' | 'souvenir' } | null>(null);

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
    for (const clutch of data.newClutches) {
      const parents = joinNames(clutch.parents);
      showToast(
        clutch.eggCount === 1
          ? t('clutch.laidOne', { parents })
          : t('clutch.laidMany', { parents, count: clutch.eggCount }),
      );
    }
    if (data.farewells.length > 0) {
      // Laisser le temps à la scène d'adieu (l'étoile qui monte) avant le message.
      const names = data.farewells.map((f) => f.name);
      setTimeout(() => setFarewells((list) => [...list, ...names]), 4500);
    }
    for (const hatching of data.hatched) {
      const form = t(`form.${hatching.form}` as MessageKey).toLowerCase();
      showToast(t('hatch.born', { name: hatching.name, form }));
    }
  }

  function loadSocial() {
    api.meetings().then(setMeetings, () => {});
    api.friends().then(setFriends, () => {});
  }

  function startScene(meeting: Meeting, mode: 'play' | 'souvenir') {
    setPanel(null);
    setSelection(null);
    setScene({ meeting, mode });
    game.current?.startMeeting({
      inviter: meeting.inviterAnimal,
      invitee: meeting.inviteeAnimal,
      replay: mode === 'souvenir' ? meeting.interactions : undefined,
    });
  }

  async function acceptMeeting(meeting: Meeting) {
    setBusy(true);
    try {
      startScene(await api.acceptMeeting(meeting.id), 'play');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'busy') showToast(t('meetings.error.busy'));
      else handleError(e);
      loadSocial();
    } finally {
      setBusy(false);
    }
  }

  async function finishScene(interactions: MeetingInteraction[]) {
    if (!scene) return;
    const { meeting, mode } = scene;
    setBusy(true);
    try {
      if (mode === 'play') {
        const { outcome } = await api.finishMeeting(meeting.id, interactions);
        const names = { a: meeting.inviterAnimal.name, b: meeting.inviteeAnimal.name };
        showToast(t(`outcome.${outcome.level}`, names) + (outcome.eggCount > 0 ? t('outcome.eggs') : ''));
      } else {
        await api.souvenirSeen(meeting.id);
      }
    } catch (e) {
      handleError(e);
    } finally {
      game.current?.stopMeeting();
      setScene(null);
      setBusy(false);
      loadSocial();
      api.household().then(updateHousehold, () => {});
    }
  }

  function openGenealogy(target: GenealogyTarget) {
    setGenealogy(target);
    setPanel('genealogy');
  }

  async function placeNestEgg(eggId: string, choice: 'keep' | 'deposit') {
    setBusy(true);
    try {
      const data = await api.nest(eggId, choice);
      updateHousehold(data);
      showToast(t(choice === 'keep' ? 'nest.kept' : 'nest.deposited'));
      if (data.nest.length === 0) setPanel(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'no_free_slot') showToast(t('adoption.full', household?.slots ?? {}));
      else handleError(e);
    } finally {
      setBusy(false);
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

  async function updateAnimal(animalId: string, changes: { name?: string; description?: string }) {
    try {
      await api.updateAnimal(animalId, changes);
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
    const offNest = bridge.on('nest-selected', () => setPanel('nest'));

    // Chaque chargement est une visite : au retour sur l'onglet, et régulièrement.
    const load = () =>
      api
        .household()
        .then(updateHousehold)
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) onLogout();
        });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      load();
      loadSocial();
    };
    const refresh = setInterval(onVisible, REFRESH_INTERVAL_MS);

    load();
    loadSocial();
    api.health().then((health) => setWorldSpeed(health.worldSpeed), () => {});
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(refresh);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(toastTimer.current);
      offAnimal();
      offEgg();
      offNest();
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
  const socialCount =
    (meetings ? meetings.received.length + meetings.toResume.length + meetings.souvenirs.length : 0) +
    (friends?.incoming.length ?? 0);

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
        {selectedAnimal && !pending && !scene && (
          <AnimalCard
            key={selectedAnimal.id}
            animal={selectedAnimal}
            busy={busy}
            onAction={(action) => care({ action, animalId: selectedAnimal.id })}
            onRename={(name) => updateAnimal(selectedAnimal.id, { name })}
            onSaveStory={(description) => updateAnimal(selectedAnimal.id, { description })}
            onGenealogy={() => openGenealogy({ kind: 'animal', id: selectedAnimal.id, name: selectedAnimal.name })}
            onClose={closeCard}
          />
        )}
        {selectedEgg && !pending && !scene && (
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
        {farewells[0] && <FarewellPanel name={farewells[0]} onClose={() => setFarewells((list) => list.slice(1))} />}
        {scene && (
          <MeetingOverlay
            key={scene.meeting.id}
            meeting={scene.meeting}
            mode={scene.mode}
            busy={busy}
            onPet={(which) => game.current?.meetingPet(which)}
            onBall={() => game.current?.meetingBall()}
            onFinish={finishScene}
          />
        )}
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
          <AdoptionPanel
            household={household}
            busy={busy}
            onAdopt={adopt}
            onAncestry={(parentIds) => openGenealogy({ kind: 'egg', parentIds })}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'nest' && household && (
          <NestPanel
            nest={household.nest}
            full={household.slots.used >= household.slots.total}
            busy={busy}
            onKeep={(eggId) => placeNestEgg(eggId, 'keep')}
            onDeposit={(eggId) => placeNestEgg(eggId, 'deposit')}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'genealogy' && genealogy && <GenealogyPanel target={genealogy} onClose={() => setPanel(null)} />}
        {panel === 'meetings' && household && meetings && friends && (
          <MeetingsPanel
            household={household}
            meetings={meetings}
            friends={friends}
            busy={busy}
            onPlay={startScene}
            onAccept={acceptMeeting}
            onDecline={(m) => api.declineMeeting(m.id).then(loadSocial, loadSocial)}
            onChanged={loadSocial}
            onToast={showToast}
            onClose={() => setPanel(null)}
          />
        )}
        {!panel && !pending && !scene && (
          <div class="bottom-bar__buttons">
            <button type="button" class="button button--secondary" disabled={!household} onClick={() => setPanel('meetings')}>
              {socialCount > 0 ? t('meetings.buttonCount', { count: socialCount }) : t('meetings.button')}
            </button>
            {household && household.nest.length > 0 && (
              <button type="button" class="button button--secondary" onClick={() => setPanel('nest')}>
                {t('nest.button', { count: household.nest.length })}
              </button>
            )}
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

