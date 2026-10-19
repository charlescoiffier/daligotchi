import { ANIMAL_NEEDS, type AnimalAction, type MessageKey } from '@daligotchi/core';
import { useState } from 'preact/hooks';
import type { HouseholdAnimal } from '../api/client.ts';
import { t } from '../i18n/index.ts';
import { ANIMAL_ACTIONS } from './ActionsPanel.tsx';

interface AnimalCardProps {
  animal: HouseholdAnimal;
  busy: boolean;
  onAction: (action: AnimalAction) => void;
  /** Renvoie false si le prénom n'a pas pu être enregistré. */
  onRename: (name: string) => Promise<boolean>;
  onClose: () => void;
}

/** Fiche d'un animal : uniquement des mots, jamais de nombres (GDD §5), et ses soins. */
export function AnimalCard({ animal, busy, onAction, onRename, onClose }: AnimalCardProps) {
  const { description } = animal;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(animal.name);
  const [error, setError] = useState(false);

  async function save(event: Event) {
    event.preventDefault();
    const ok = await onRename(name.trim());
    setError(!ok);
    if (ok) setEditing(false);
  }

  return (
    <section class="card" aria-label={animal.name}>
      <header class="card__header">
        <div>
          {editing ? (
            <form class="card__rename" onSubmit={save}>
              <input
                aria-label={t('card.namePlaceholder')}
                placeholder={t('card.namePlaceholder')}
                maxLength={20}
                required
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
              />
              <button type="submit" class="button button--small">
                {t('card.save')}
              </button>
            </form>
          ) : (
            <h2 class="card__name">
              {animal.name}{' '}
              <button
                type="button"
                class="card__edit"
                aria-label={t('card.rename')}
                title={t('card.rename')}
                onClick={() => {
                  setName(animal.name);
                  setEditing(true);
                }}
              >
                ✎
              </button>
            </h2>
          )}
          {error && <p class="login__error">{t('card.renameError')}</p>}
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
