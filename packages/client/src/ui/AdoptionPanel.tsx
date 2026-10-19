import { useEffect, useState } from 'preact/hooks';
import { type AdoptionEgg, api, type Household } from '../api/client.ts';
import { t } from '../i18n/index.ts';
import { joinNames } from './names.ts';

interface AdoptionPanelProps {
  household: Household;
  busy: boolean;
  onAdopt: (eggId: string) => void;
  /** Consulter l'ascendance d'un œuf pondu par des animaux de joueurs. */
  onAncestry: (parentIds: string[]) => void;
  onClose: () => void;
}

/** Lieu d'adoption : œufs disponibles, sans jamais révéler leur espèce (GDD §10). */
export function AdoptionPanel({ household, busy, onAdopt, onAncestry, onClose }: AdoptionPanelProps) {
  const [eggs, setEggs] = useState<AdoptionEgg[] | null>(null);
  const full = household.slots.used >= household.slots.total;

  useEffect(() => {
    api.adoption().then(
      (data) => setEggs(data.eggs),
      () => setEggs([]),
    );
  }, []);

  return (
    <section class="panel" aria-label={t('adoption.title')}>
      <header class="panel__header">
        <h2>{t('adoption.title')}</h2>
        <button type="button" class="card__close" onClick={onClose} aria-label={t('actions.close')}>
          ×
        </button>
      </header>
      <p class="panel__intro">{full ? t('adoption.full', household.slots) : t('adoption.intro')}</p>
      {eggs?.length === 0 && <p class="panel__intro">{t('adoption.empty')}</p>}
      <ul class="adoption__list">
        {eggs?.map((egg, index) => (
          <li key={egg.id} class="adoption__egg">
            <div>
              <strong>{t('adoption.egg', { number: index + 1 })}</strong>
              <span>
                {egg.parents.length > 0
                  ? t('nest.egg', { parents: joinNames(egg.parents.map((p) => p.name)) })
                  : t('adoption.founder')}
              </span>
            </div>
            <div class="adoption__actions">
              {egg.parents.length > 0 && (
                <button
                  type="button"
                  class="button button--small"
                  onClick={() => onAncestry(egg.parents.map((p) => p.id))}
                >
                  {t('adoption.ancestry')}
                </button>
              )}
              <button
                type="button"
                class="button button--action"
                disabled={busy || full}
                onClick={() => onAdopt(egg.id)}
              >
                {t('adoption.adopt')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
