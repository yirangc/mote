import { useEffect, useRef, useState } from 'react';
import leafCharacter from '../assets/leaf-character.svg';
import { Entries, Responses, SaveOutcome, longDate, pad2 } from '../journal';

const PLACEHOLDERS = ['ex: Dinner was delicious', 'ex: A friend checked in', 'ex: A sunny walk after work'];

/** Unsaved text, kept in memory for the page session (never persisted until Save). */
export interface Draft {
  /** The local date this text was written for. */
  date: string;
  responses: string[];
  /** 'edit' when it started from that day's saved entry. */
  mode: 'new' | 'edit';
}

interface Props {
  today: string;
  entries: Entries;
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  /** Re-read the device date; returns the current local date key. */
  refreshToday: () => string;
  /** Persists; reports 'saved' only after a confirmed write. */
  onSave: (date: string, responses: Responses, asNew: boolean) => SaveOutcome;
}

const hasText = (rs: string[]) => rs.some((r) => r.trim().length > 0);
const same = (a: string[], b: string[]) => a.every((r, i) => r.trim() === b[i]?.trim());

export function Today({ today, entries, draft, setDraft, refreshToday, onSave }: Props) {
  const entry = entries[today];

  // Is the in-memory text worth keeping? Unchanged or empty drafts are simply dropped.
  const dirty =
    !!draft &&
    hasText(draft.responses) &&
    !(draft.mode === 'edit' && entries[draft.date] && same(draft.responses, entries[draft.date].responses));

  // Midnight passed while the draft was open.
  const stale = !!draft && draft.date !== today;

  useEffect(() => {
    if (stale && !dirty) setDraft(null);
  }, [stale, dirty, setDraft]);

  if (stale && dirty) {
    return (
      <NewDay
        draft={draft!}
        todayHasEntry={!!entry}
        onUseToday={() => setDraft({ date: today, responses: draft!.responses, mode: 'new' })}
        onOpenToday={() => setDraft(null)}
        onDiscard={() => setDraft(null)}
      />
    );
  }

  if (entry && (!draft || stale)) {
    return (
      <Saved
        date={today}
        responses={entry.responses}
        onEdit={() => setDraft({ date: today, responses: [...entry.responses], mode: 'edit' })}
      />
    );
  }

  const current: Draft = draft && !stale ? draft : { date: today, responses: ['', '', ''], mode: 'new' };
  return (
    <Write
      draft={current}
      showStorageNote={Object.keys(entries).length === 0}
      onChange={setDraft}
      onSave={() => {
        // Recheck the date right before saving; never backdate.
        const now = refreshToday();
        if (now !== current.date) {
          setDraft(current);
          return 'rollover';
        }
        const result = onSave(now, current.responses as Responses, current.mode === 'new');
        if (result === 'saved') setDraft(null);
        return result;
      }}
      onOpenSaved={() => setDraft(null)}
    />
  );
}

function Write({
  draft,
  showStorageNote,
  onChange,
  onSave,
  onOpenSaved,
}: {
  draft: Draft;
  showStorageNote: boolean;
  onChange: (d: Draft) => void;
  onSave: () => SaveOutcome | 'rollover';
  onOpenSaved: () => void;
}) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [problem, setProblem] = useState<'failed' | 'exists' | null>(null);
  const failed = problem === 'failed';
  const ready = draft.responses.every((s) => s.trim().length > 0);

  const submit = () => {
    if (!ready) return;
    const r = onSave();
    setProblem(r === 'failed' || r === 'exists' ? r : null);
  };

  // Grow each field to fit its text (two lines minimum, as designed).
  useEffect(() => {
    refs.current.forEach((el) => {
      if (!el) return;
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;
    });
  }, [draft.responses]);

  return (
    <>
      <section className="prompt-card">
        <div className="prompt-text">
          <p className="prompt-date">{longDate(draft.date).toUpperCase()}</p>
          <h1 className="prompt-title">
            What are you
            <br />
            thankful for?
          </h1>
        </div>
        <img src={leafCharacter} width={100} height={94} alt="" />
      </section>

      <form
        className="writing-area"
        aria-labelledby="todays-gratitude"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="writing-head">
          <h2 className="h-section" id="todays-gratitude">
            Today’s gratitude
          </h2>
          <p className="body-muted" id="write-hint">
            Write three things you’re thankful for.
          </p>
        </div>
        <div className="fields">
          {draft.responses.map((value, i) => (
            <div key={i} className="field" onClick={() => refs.current[i]?.focus()}>
              <span className="num" aria-hidden="true">
                {pad2(i + 1)}
              </span>
              <label className="sr-only" htmlFor={`gratitude-${i + 1}`}>
                Gratitude {i + 1}
              </label>
              <textarea
                id={`gratitude-${i + 1}`}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                rows={2}
                maxLength={500}
                value={value}
                placeholder={PLACEHOLDERS[i]}
                aria-describedby="write-hint"
                onChange={(e) => {
                  setProblem(null);
                  onChange({ ...draft, responses: draft.responses.map((p, j) => (j === i ? e.target.value : p)) });
                }}
              />
            </div>
          ))}
        </div>
        {failed && (
          <p className="error" role="alert">
            Your entry wasn’t saved. This browser didn’t allow Mote to store it. Your text is still here, so you can try
            again.
          </p>
        )}
        {problem === 'exists' && (
          <div className="error" role="alert">
            <p>An entry for today was already saved in another window, so this text wasn’t saved over it.</p>
            <button type="button" className="banner-action" onClick={onOpenSaved}>
              Open today’s entry
            </button>
          </div>
        )}
        <button type="submit" className="btn btn-save" disabled={!ready}>
          {failed ? 'Try again' : 'Save'}
        </button>
        {showStorageNote && (
          <p className="storage-note">Entries are saved in this browser. Clearing browser data removes them.</p>
        )}
      </form>
    </>
  );
}

function Saved({ date, responses, onEdit }: { date: string; responses: string[]; onEdit: () => void }) {
  return (
    <>
      <div className="page-title saved-title">
        <h1 className="h-page">Gratitude saved</h1>
        <p className="body-muted">{longDate(date)}</p>
      </div>
      <section className="saved-card" aria-label="What you saved">
        {responses.map((text, i) => (
          <div key={i} className="saved-item">
            <span className="num">{pad2(i + 1)}</span>
            <p>{text}</p>
          </div>
        ))}
      </section>
      <button className="btn btn-soft" onClick={onEdit}>
        Edit
      </button>
    </>
  );
}

function NewDay({
  draft,
  todayHasEntry,
  onUseToday,
  onOpenToday,
  onDiscard,
}: {
  draft: Draft;
  todayHasEntry: boolean;
  onUseToday: () => void;
  onOpenToday: () => void;
  onDiscard: () => void;
}) {
  return (
    <>
      <section className="newday-card" role="alert" aria-labelledby="newday-title">
        <h1 id="newday-title" className="h-section">
          It’s a new day. Save this for today?
        </h1>
        <p className="body-muted small">
          You started this on {longDate(draft.date)}.{' '}
          {todayHasEntry
            ? 'You already saved an entry today, so this text can’t replace it.'
            : 'It won’t be added to that day.'}
        </p>
        <div className="newday-actions">
          {todayHasEntry ? (
            <button className="btn btn-primary" onClick={onOpenToday}>
              Open today’s entry
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onUseToday}>
              Use it for today
            </button>
          )}
          <button className="btn btn-soft" onClick={onDiscard}>
            Discard this text
          </button>
        </div>
      </section>
      <section className="saved-card" aria-label="Your unsaved text">
        {draft.responses.map((text, i) => (
          <div key={i} className="saved-item">
            <span className="num">{pad2(i + 1)}</span>
            <p>{text.trim() || '—'}</p>
          </div>
        ))}
      </section>
    </>
  );
}
