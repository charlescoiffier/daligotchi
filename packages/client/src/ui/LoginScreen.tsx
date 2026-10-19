import { useState } from 'preact/hooks';
import { ApiError, api, type Player } from '../api/client.ts';
import { type MessageKey, t } from '../i18n/index.ts';

export function LoginScreen({ onLogin }: { onLogin: (player: Player) => void }) {
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: Event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { player } = await api.login(pseudo, password);
      onLogin(player);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError(
        status === 401 || status === 400
          ? 'login.error.invalid'
          : status === 429
            ? 'login.error.tooMany'
            : 'login.error.network',
      );
      setLoading(false);
    }
  }

  return (
    <main class="login">
      <h1 class="login__title">{t('app.title')}</h1>
      <form class="login__form" onSubmit={submit}>
        <label>
          {t('login.pseudo')}
          <input
            name="pseudo"
            autocomplete="username"
            autocapitalize="none"
            spellcheck={false}
            required
            value={pseudo}
            onInput={(e) => setPseudo(e.currentTarget.value)}
          />
        </label>
        <label>
          {t('login.password')}
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            required
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>
        {error && (
          <p class="login__error" role="alert">
            {t(error)}
          </p>
        )}
        <button type="submit" class="button button--primary" disabled={loading}>
          {loading ? t('login.loading') : t('login.submit')}
        </button>
      </form>
    </main>
  );
}
