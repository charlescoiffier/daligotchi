import { ANIMAL_NEEDS, type AnimalAction, type MessageKey } from '@daligotchi/core';
import type { HouseholdAnimal } from '../api/client.ts';
import { t } from '../i18n/index.ts';
import { ANIMAL_ACTIONS } from './ActionsPanel.tsx';

interface AnimalCardProps {
  animal: HouseholdAnimal;
  busy: boolean;
  onAction: (action: AnimalAction) => void;
  onClose: () => void;
}

/** Fiche d'un animal : uniquement des mots, jamais de nombres (GDD §5), et ses soins. */
export function AnimalCard({ animal, busy, onAction, onClose }: AnimalCardProps) {
  const { description } = animal;
  return (
    <section class="card" aria-label={animal.name}>
      <header class="card__header">
        <div>
          <h2 class="card__name">{animal.name}</h2>
          <p class="card__subtitle">
            {t(`form.${animal.form}` as MessageKey)} · {t(description.stage)} · {t(description.emotion)}
          </p>
        </div>
        <button type="button" class="card__close" onClick={onClose} aria-label={t('card.close')}>
          ×
        </button>
      </header>
      {description.elderSigns && <p class="card__elder">{t('elder.signs')}</p>}
      <ul class="card__needs" aria-label={t('card.needs')}>
        {ANIMAL_NEEDS.map((need) => {
          const key = description.needs[need];
          return (
            <li key={need} class={`need need--${key.split('.').pop()}`}>
              {t(key)}
            </li>
          );
        })}
      </ul>
      <div class="card__actions">
        {ANIMAL_ACTIONS.map((action) => (
          <button key={action} type="button" class="button button--action" disabled={busy} onClick={() => onAction(action)}>
            {t(`action.${action}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
