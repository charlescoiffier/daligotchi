import { useEffect, useState } from 'preact/hooks';
import { type AdoptionEgg, api, type Household } from '../api/client.ts';
import { t } from '../i18n/index.ts';

interface AdoptionPanelProps {
  household: Household;
  busy: boolean;
  onAdopt: (eggId: string) => void;
  onClose: () => void;
}

/** Lieu d'adoption : œufs disponibles, sans jamais révéler leur espèce (GDD §10). */
export function AdoptionPanel({ household, busy, onAdopt, onClose }: AdoptionPanelProps) {
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
              <span>{t('adoption.founder')}</span>
            </div>
            <button
              type="button"
              class="button button--action"
              disabled={busy || full}
              onClick={() => onAdopt(egg.id)}
            >
              {t('adoption.adopt')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
