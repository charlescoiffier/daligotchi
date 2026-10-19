import type { AnimalAction, HouseholdAction } from '@daligotchi/core';
import { t } from '../i18n/index.ts';

const HOME_ACTIONS: readonly HouseholdAction[] = ['feed', 'water', 'cleanHome'];
export const ANIMAL_ACTIONS: readonly AnimalAction[] = ['pet', 'ball', 'wash'];

interface ActionsPanelProps {
  hasAnimals: boolean;
  busy: boolean;
  onHomeAction: (action: HouseholdAction) => void;
  onBallForAll: () => void;
  /** L'action est choisie d'abord ; il faudra ensuite toucher un animal. */
  onChooseAnimalAction: (action: AnimalAction) => void;
  onClose: () => void;
}

/** Panneau du bouton Actions : soins du foyer, puis soins pour un animal (GDD §5). */
export function ActionsPanel(props: ActionsPanelProps) {
  const { hasAnimals, busy } = props;
  return (
    <section class="panel" aria-label={t('actions.button')}>
      <header class="panel__header">
        <h2>{t('actions.forHome')}</h2>
        <button type="button" class="card__close" onClick={props.onClose} aria-label={t('actions.close')}>
          ×
        </button>
      </header>
      <div class="panel__buttons">
        {HOME_ACTIONS.map((action) => (
          <button key={action} type="button" class="button button--action" disabled={busy} onClick={() => props.onHomeAction(action)}>
            {t(`action.${action}`)}
          </button>
        ))}
        <button type="button" class="button button--action" disabled={busy || !hasAnimals} onClick={props.onBallForAll}>
          {t('action.ballAll')}
        </button>
      </div>

      <h2>{t('actions.forAnimal')}</h2>
      <div class="panel__buttons">
        {ANIMAL_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            class="button button--action"
            disabled={busy || !hasAnimals}
            onClick={() => props.onChooseAnimalAction(action)}
          >
            {t(`action.${action}`)}
          </button>
        ))}
      </div>
    </section>
  );
}
