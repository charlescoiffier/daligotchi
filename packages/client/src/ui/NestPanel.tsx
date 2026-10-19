import type { NestEgg } from '../api/client.ts';
import { t } from '../i18n/index.ts';
import { joinNames } from './names.ts';

interface NestPanelProps {
  nest: NestEgg[];
  full: boolean;
  busy: boolean;
  onKeep: (eggId: string) => void;
  onDeposit: (eggId: string) => void;
  onClose: () => void;
}

/** Nid : les œufs pondus attendent, hors des six places (GDD §6). */
export function NestPanel({ nest, full, busy, onKeep, onDeposit, onClose }: NestPanelProps) {
  return (
    <section class="panel" aria-label={t('nest.title')}>
      <header class="panel__header">
        <h2>{t('nest.title')}</h2>
        <button type="button" class="card__close" onClick={onClose} aria-label={t('actions.close')}>
          ×
        </button>
      </header>
      <p class="panel__intro">{t('nest.intro')}</p>
      <ul class="adoption__list">
        {nest.map((egg) => (
          <li key={egg.id} class="adoption__egg">
            <div>
              <strong>{t('nest.egg', { parents: joinNames(egg.parents) })}</strong>
              <span>{t('nest.leavesIn', { days: egg.depositInDays })}</span>
            </div>
            <div class="adoption__actions">
              <button type="button" class="button button--action" disabled={busy || full} onClick={() => onKeep(egg.id)}>
                {t('nest.keep')}
              </button>
              <button type="button" class="button button--action" disabled={busy} onClick={() => onDeposit(egg.id)}>
                {t('nest.deposit')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
