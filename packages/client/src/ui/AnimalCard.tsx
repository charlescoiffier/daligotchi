import { ANIMAL_NEEDS, type MessageKey } from '@daligotchi/core';
import type { HouseholdAnimal } from '../api/client.ts';
import { t } from '../i18n/index.ts';

/** Fiche d'un animal : uniquement des mots, jamais de nombres (GDD §5). */
export function AnimalCard({ animal, onClose }: { animal: HouseholdAnimal; onClose: () => void }) {
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
    </section>
  );
}
