import { EGG_ACTIONS, type EggAction } from '@daligotchi/core';
import type { HouseholdEgg } from '../api/client.ts';
import { t } from '../i18n/index.ts';

interface EggCardProps {
  egg: HouseholdEgg;
  busy: boolean;
  onAction: (action: EggAction) => void;
  onClose: () => void;
}

/** Fiche d'un œuf : son état en mots, et les soins qui le font éclore (GDD §6). */
export function EggCard({ egg, busy, onAction, onClose }: EggCardProps) {
  const { description } = egg;
  return (
    <section class="card" aria-label={t('egg.title')}>
      <header class="card__header">
        <div>
          <h2 class="card__name">{t('egg.title')}</h2>
          <p class="card__subtitle">{t(description.progress)}</p>
        </div>
        <button type="button" class="card__close" onClick={onClose} aria-label={t('card.close')}>
          ×
        </button>
      </header>
      <ul class="card__needs">
        {[description.warmth, description.cleanliness].map((key) => (
          <li key={key} class={`need need--${key.split('.').pop()}`}>
            {t(key)}
          </li>
        ))}
      </ul>
      <div class="card__actions">
        {EGG_ACTIONS.map((action) => (
          <button key={action} type="button" class="button button--action" disabled={busy} onClick={() => onAction(action)}>
            {t(`action.${action}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
