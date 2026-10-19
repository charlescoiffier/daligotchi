import type { MessageKey } from '@daligotchi/core';
import { useRef, useState } from 'preact/hooks';
import type { Meeting, MeetingInteraction } from '../api/client.ts';
import { t } from '../i18n/index.ts';

interface MeetingOverlayProps {
  meeting: Meeting;
  mode: 'play' | 'souvenir';
  busy: boolean;
  onPet: (which: 'inviter' | 'invitee') => void;
  onBall: () => void;
  /** En jeu : renvoie les interactions enregistrées. En souvenir : ferme simplement. */
  onFinish: (interactions: MeetingInteraction[]) => void;
}

/**
 * Commandes de la scène de rencontre. En jeu, chaque geste est noté avec son moment, pour
 * que l'invitant puisse revoir la scène telle quelle. En souvenir, les gestes ne comptent pas.
 */
export function MeetingOverlay({ meeting, mode, busy, onPet, onBall, onFinish }: MeetingOverlayProps) {
  const start = useRef(performance.now());
  const [interactions, setInteractions] = useState<MeetingInteraction[]>([]);
  const a = meeting.inviterAnimal;
  const b = meeting.inviteeAnimal;

  function record(interaction: Omit<MeetingInteraction, 'at'>) {
    if (mode === 'play') {
      setInteractions((list) => [...list, { ...interaction, at: Math.round(performance.now() - start.current) }]);
    }
  }

  return (
    <section class="panel scene-panel">
      <h2>
        {t(mode === 'play' ? 'scene.title' : 'scene.souvenirTitle', { a: a.name, b: b.name })}
      </h2>
      <p class="panel__intro">
        {mode === 'play'
          ? `${meeting.inviter} : « ${t(`phrase.${meeting.phrase}` as MessageKey)} »`
          : t('scene.souvenirHint')}
      </p>
      <div class="scene-panel__buttons">
        <button
          type="button"
          class="button button--action"
          onClick={() => {
            onPet('inviter');
            record({ kind: 'pet', animal: 'inviter' });
          }}
        >
          {t('scene.pet', { name: a.name })}
        </button>
        <button
          type="button"
          class="button button--action"
          onClick={() => {
            onPet('invitee');
            record({ kind: 'pet', animal: 'invitee' });
          }}
        >
          {t('scene.pet', { name: b.name })}
        </button>
        <button
          type="button"
          class="button button--action"
          onClick={() => {
            onBall();
            record({ kind: 'ball' });
          }}
        >
          {t('scene.ball')}
        </button>
      </div>
      <button type="button" class="button button--primary scene-panel__finish" disabled={busy} onClick={() => onFinish(interactions)}>
        {t(mode === 'play' ? 'scene.finish' : 'scene.close')}
      </button>
    </section>
  );
}
