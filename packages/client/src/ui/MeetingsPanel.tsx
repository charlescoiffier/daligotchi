import { type MessageKey, type Phrase, PHRASES } from '@daligotchi/core';
import { useEffect, useState } from 'preact/hooks';
import {
  ApiError,
  api,
  type Friends,
  type Household,
  type Meeting,
  type Meetings,
  type PublicAnimal,
} from '../api/client.ts';
import { t } from '../i18n/index.ts';

type Tab = 'invitations' | 'friends' | 'place';
type Target = (PublicAnimal & { owner: string }) | null;

interface MeetingsPanelProps {
  household: Household;
  meetings: Meetings;
  friends: Friends;
  busy: boolean;
  onPlay: (meeting: Meeting, mode: 'play' | 'souvenir') => void;
  onAccept: (meeting: Meeting) => void;
  onDecline: (meeting: Meeting) => void;
  /** Recharger invitations et amis après un changement. */
  onChanged: () => void;
  onToast: (message: string) => void;
  onClose: () => void;
}

function formName(animal: PublicAnimal) {
  return `${animal.name} (${t(`form.${animal.form}` as MessageKey).toLowerCase()})`;
}

/** Rencontres entre joueurs : invitations, amis et lieu de rencontre (GDD §9 et §12). */
export function MeetingsPanel(props: MeetingsPanelProps) {
  const [tab, setTab] = useState<Tab>('invitations');
  const [target, setTarget] = useState<Target>(null);

  return (
    <section class="panel panel--tall" aria-label={t('meetings.title')}>
      <header class="panel__header">
        <h2>{target ? t('meetings.inviteTitle', { name: target.name }) : t('meetings.title')}</h2>
        <button type="button" class="card__close" onClick={props.onClose} aria-label={t('actions.close')}>
          ×
        </button>
      </header>
      {target ? (
        <InviteForm
          household={props.household}
          target={target}
          onDone={() => {
            setTarget(null);
            props.onChanged();
          }}
          onToast={props.onToast}
        />
      ) : (
        <>
          <nav class="tabs">
            {(['invitations', 'friends', 'place'] as const).map((name) => (
              <button
                key={name}
                type="button"
                class={`tabs__tab ${tab === name ? 'tabs__tab--active' : ''}`}
                onClick={() => setTab(name)}
              >
                {t(`meetings.tab${name[0]!.toUpperCase()}${name.slice(1)}` as MessageKey)}
              </button>
            ))}
          </nav>
          {tab === 'invitations' && <InvitationsTab {...props} />}
          {tab === 'friends' && <FriendsTab {...props} onInvite={setTarget} />}
          {tab === 'place' && <PlaceTab {...props} onInvite={setTarget} />}
        </>
      )}
    </section>
  );
}

function InvitationsTab({ meetings, busy, onPlay, onAccept, onDecline }: MeetingsPanelProps) {
  const empty =
    meetings.received.length + meetings.sent.length + meetings.toResume.length + meetings.souvenirs.length === 0;
  return (
    <ul class="adoption__list">
      {empty && <p class="panel__intro">{t('meetings.nothing')}</p>}
      {meetings.toResume.map((m) => (
        <li key={m.id} class="adoption__egg">
          <span>{t('meetings.toResume', { mine: m.inviteeAnimal.name, theirs: m.inviterAnimal.name })}</span>
          <button type="button" class="button button--action" onClick={() => onPlay(m, 'play')}>
            {t('meetings.resume')}
          </button>
        </li>
      ))}
      {meetings.received.map((m) => (
        <li key={m.id} class="adoption__egg">
          <div>
            <strong>
              {t('meetings.received', { from: m.inviter, theirs: formName(m.inviterAnimal), mine: m.inviteeAnimal.name })}
            </strong>
            <span>« {t(`phrase.${m.phrase}` as MessageKey)} »</span>
          </div>
          <div class="adoption__actions">
            <button type="button" class="button button--small" disabled={busy} onClick={() => onDecline(m)}>
              {t('meetings.decline')}
            </button>
            <button type="button" class="button button--action" disabled={busy} onClick={() => onAccept(m)}>
              {t('meetings.accept')}
            </button>
          </div>
        </li>
      ))}
      {meetings.souvenirs.map((m) => (
        <li key={m.id} class="adoption__egg">
          <span>{t('meetings.souvenir', { mine: m.inviterAnimal.name, theirs: m.inviteeAnimal.name, to: m.invitee })}</span>
          <button type="button" class="button button--action" onClick={() => onPlay(m, 'souvenir')}>
            {t('meetings.watch')}
          </button>
        </li>
      ))}
      {meetings.sent.map((m) => (
        <li key={m.id} class="adoption__egg adoption__egg--muted">
          <span>{t('meetings.sent', { mine: m.inviterAnimal.name, to: m.invitee, theirs: m.inviteeAnimal.name })}</span>
        </li>
      ))}
    </ul>
  );
}

function FriendsTab({
  friends,
  busy,
  onChanged,
  onToast,
  onInvite,
}: MeetingsPanelProps & { onInvite: (target: Target) => void }) {
  const [pseudo, setPseudo] = useState('');
  const [openFriend, setOpenFriend] = useState<string | null>(null);
  const [animals, setAnimals] = useState<PublicAnimal[]>([]);

  async function add(event: Event) {
    event.preventDefault();
    try {
      const result = await api.requestFriend(pseudo);
      onToast(t(result.status === 'accepted' ? 'friends.nowFriends' : 'friends.requested', { pseudo: result.pseudo }));
      setPseudo('');
      onChanged();
    } catch (e) {
      onToast(t(e instanceof ApiError && e.code === 'self' ? 'friends.self' : 'friends.unknown'));
    }
  }

  async function open(friendId: string) {
    setOpenFriend(openFriend === friendId ? null : friendId);
    if (openFriend !== friendId) setAnimals((await api.friendAnimals(friendId)).animals);
  }

  return (
    <div>
      <form class="friends__add" onSubmit={add}>
        <input
          aria-label={t('friends.pseudo')}
          placeholder={t('friends.pseudo')}
          autocapitalize="none"
          value={pseudo}
          required
          onInput={(e) => setPseudo(e.currentTarget.value)}
        />
        <button type="submit" class="button button--action" disabled={busy}>
          {t('friends.send')}
        </button>
      </form>
      <ul class="adoption__list">
        {friends.incoming.map((f) => (
          <li key={f.id} class="adoption__egg">
            <span>{t('friends.incoming', { pseudo: f.pseudo })}</span>
            <div class="adoption__actions">
              <button type="button" class="button button--small" onClick={() => api.removeFriend(f.id).then(onChanged)}>
                {t('friends.refuse')}
              </button>
              <button type="button" class="button button--action" onClick={() => api.acceptFriend(f.id).then(onChanged)}>
                {t('friends.accept')}
              </button>
            </div>
          </li>
        ))}
        {friends.friends.length === 0 && friends.incoming.length === 0 && <p class="panel__intro">{t('friends.none')}</p>}
        {friends.friends.map((f) => (
          <li key={f.id} class="adoption__egg adoption__egg--column">
            <button type="button" class="card__link" onClick={() => open(f.id)}>
              {f.pseudo} · {t('friends.animals')}
            </button>
            {openFriend === f.id &&
              animals.map((animal) => (
                <div key={animal.id} class="friends__animal">
                  <span>{formName(animal)}</span>
                  <button type="button" class="button button--small" onClick={() => onInvite({ ...animal, owner: f.pseudo })}>
                    {t('meetings.invite')}
                  </button>
                </div>
              ))}
          </li>
        ))}
        {friends.outgoing.map((f) => (
          <li key={f.id} class="adoption__egg adoption__egg--muted">
            <span>{t('friends.outgoing', { pseudo: f.pseudo })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlaceTab({ household, onInvite }: MeetingsPanelProps & { onInvite: (target: Target) => void }) {
  const [place, setPlace] = useState<{ others: (PublicAnimal & { owner: string })[]; mine: string[] } | null>(null);
  const load = () => api.meetingPlace().then(setPlace, () => setPlace({ others: [], mine: [] }));
  useEffect(() => {
    load();
  }, []);

  async function toggle(animalId: string, listed: boolean) {
    await api.setListed(animalId, listed);
    load();
  }

  return (
    <div>
      <p class="panel__intro">{t('place.intro')}</p>
      <h3 class="panel__subtitle">{t('place.mine')}</h3>
      <ul class="adoption__list">
        {household.animals.map((animal) => {
          const listed = place?.mine.includes(animal.id) ?? false;
          return (
            <li key={animal.id} class="adoption__egg">
              <span>
                {animal.name}
                {listed && <em> · {t('place.listed')}</em>}
              </span>
              <button type="button" class="button button--small" onClick={() => toggle(animal.id, !listed)}>
                {t(listed ? 'place.unlist' : 'place.list')}
              </button>
            </li>
          );
        })}
      </ul>
      <h3 class="panel__subtitle">{t('place.others')}</h3>
      <ul class="adoption__list">
        {place?.others.length === 0 && <p class="panel__intro">{t('place.empty')}</p>}
        {place?.others.map((animal) => (
          <li key={animal.id} class="adoption__egg">
            <div>
              <strong>{formName(animal)}</strong>
              <span>{t('place.owner', { owner: animal.owner })}</span>
            </div>
            <button type="button" class="button button--action" onClick={() => onInvite(animal)}>
              {t('meetings.invite')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteForm({
  household,
  target,
  onDone,
  onToast,
}: {
  household: Household;
  target: PublicAnimal & { owner: string };
  onDone: () => void;
  onToast: (message: string) => void;
}) {
  const [mine, setMine] = useState(household.animals[0]?.id ?? '');
  const [phrase, setPhrase] = useState<Phrase>('hello');

  async function send(event: Event) {
    event.preventDefault();
    try {
      await api.invite(mine, target.id, phrase);
      onToast(t('meetings.sentOk'));
      onDone();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      const known = ['too_many_pending', 'not_reachable', 'busy'].includes(code);
      onToast(known ? t(`meetings.error.${code}` as MessageKey) : t('actions.error'));
    }
  }

  return (
    <form class="invite" onSubmit={send}>
      <p class="panel__intro">
        {formName(target)} · {t('place.owner', { owner: target.owner })}
      </p>
      <fieldset>
        <legend>{t('meetings.chooseMine')}</legend>
        {household.animals.map((animal) => (
          <label key={animal.id} class="invite__choice">
            <input type="radio" name="mine" checked={mine === animal.id} onChange={() => setMine(animal.id)} />
            {formName(animal)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('meetings.choosePhrase')}</legend>
        {PHRASES.filter((p) => p !== 'thanks').map((p) => (
          <label key={p} class="invite__choice">
            <input type="radio" name="phrase" checked={phrase === p} onChange={() => setPhrase(p)} />
            {t(`phrase.${p}` as MessageKey)}
          </label>
        ))}
      </fieldset>
      <div class="invite__buttons">
        <button type="button" class="button button--small" onClick={onDone}>
          {t('meetings.back')}
        </button>
        <button type="submit" class="button button--action" disabled={!mine}>
          {t('meetings.send')}
        </button>
      </div>
    </form>
  );
}
