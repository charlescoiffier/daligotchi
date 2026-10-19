import { t } from '../i18n/index.ts';

/** Message d'adieu, doux et simple, après la scène (GDD §4). */
export function FarewellPanel({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <section class="panel farewell" role="dialog" aria-label={t('farewell.title', { name })}>
      <h2>✦ {t('farewell.title', { name })}</h2>
      <p>{t('farewell.text', { name })}</p>
      <button type="button" class="button button--primary" onClick={onClose}>
        {t('farewell.ok', { name })}
      </button>
    </section>
  );
}
