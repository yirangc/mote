import { useEffect, useMemo, useRef, useState } from 'react';
import petalCharacters from '../assets/petal-characters.svg';
import listIconWhite from '../assets/list-icon-white.svg';
import listIconBrown from '../assets/list-icon-brown.svg';
import calendarIconWhite from '../assets/calendar-icon-white.svg';
import calendarIconBrown from '../assets/calendar-icon-brown.svg';
import expandIcon from '../assets/expand.svg';
import collapseIcon from '../assets/collapse.svg';
import trashIcon from '../assets/trash.svg';
import prevIcon from '../assets/prev-month.svg';
import nextIcon from '../assets/next-month.svg';
import { Entries, Entry, fromKey, longDate, monthDay, monthLabel, pad2, toKey } from '../journal';

export type View = 'list' | 'calendar';

interface Props {
  entries: Entries;
  today: string;
  view: View;
  onView: (v: View) => void;
  /** Returns true only after the deletion is confirmed in storage. */
  onDelete: (date: string) => boolean;
  onDeleted: () => void;
  onWrite: () => void;
}

export function LookBack({ entries, today, view, onView, onDelete, onDeleted, onWrite }: Props) {
  const sorted = useMemo(
    () =>
      Object.entries(entries)
        .map(([date, entry]) => ({ date, entry }))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries],
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState<{ date: string; opener: HTMLElement | null } | null>(null);

  const askDelete = (date: string) => setPending({ date, opener: document.activeElement as HTMLElement | null });

  return (
    <>
      <div className="page-title tight">
        <h1 className="h-page" tabIndex={-1} ref={heading}>
          Look back
        </h1>
        <p className="body-muted">Little things you chose to keep.</p>
      </div>

      {sorted.length === 0 ? (
        <>
          <section className="empty-card">
            <img src={petalCharacters} width={100} height={94} alt="" />
            <h2 className="empty-title">A place for small things</h2>
            <p className="empty-body">Once you save your first entry, you can revisit it here.</p>
          </section>
          <button className="btn btn-primary btn-tall" onClick={onWrite}>
            Write
          </button>
        </>
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Look back view">
            {(['list', 'calendar'] as const).map((v) => {
              const active = view === v;
              const icon =
                v === 'list' ? (active ? listIconWhite : listIconBrown) : active ? calendarIconWhite : calendarIconBrown;
              return (
                <button
                  key={v}
                  aria-pressed={active}
                  className={`segment ${active ? 'is-active' : ''}`}
                  onClick={() => onView(v)}
                >
                  <img src={icon} width={16} height={16} alt="" />
                  {v === 'list' ? 'List' : 'Calendar'}
                </button>
              );
            })}
          </div>
          {view === 'list' ? (
            <ListView items={sorted} onAskDelete={askDelete} />
          ) : (
            <CalendarView entries={entries} today={today} onAskDelete={askDelete} />
          )}
        </>
      )}

      {pending && (
        <ConfirmDelete
          date={pending.date}
          onCancel={() => {
            const opener = pending.opener;
            setPending(null);
            requestAnimationFrame(() => opener?.focus());
          }}
          onConfirm={() => {
            if (!onDelete(pending.date)) return false;
            setPending(null);
            onDeleted();
            requestAnimationFrame(() => heading.current?.focus());
            return true;
          }}
        />
      )}
    </>
  );
}

// ---------- shared pieces ----------

function Responses({ entry }: { entry: Entry }) {
  return (
    <ol className="responses">
      {entry.responses.map((text, i) => (
        <li key={i} className="gratitude">
          <span className="num" aria-hidden="true">
            {pad2(i + 1)}
          </span>
          <p>{text}</p>
        </li>
      ))}
    </ol>
  );
}

function DeleteButton({ date, onClick }: { date: string; onClick: () => void }) {
  return (
    <div className="entry-actions">
      <button className="btn-delete" onClick={onClick} aria-label={`Delete entry for ${longDate(date)}`}>
        <img src={trashIcon} width={16} height={16} alt="" />
        Delete
      </button>
    </div>
  );
}

function ConfirmDelete({ date, onCancel, onConfirm }: { date: string; onCancel: () => void; onConfirm: () => boolean }) {
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelRef.current();
      } else if (e.key === 'Tab' && dialog.current) {
        // Keep focus inside the dialog.
        const items = dialog.current.querySelectorAll<HTMLElement>('button');
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, []);

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        ref={dialog}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-title">Delete this entry?</h2>
        <p id="delete-desc">
          All three things you wrote on {monthDay(date)} will be permanently deleted.
        </p>
        {failed && (
          <p className="error" role="alert">
            The entry wasn’t deleted. This browser didn’t allow Mote to change its storage. Try again.
          </p>
        )}
        <div className="dialog-actions">
          <button className="btn-cancel" ref={cancel} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-danger" onClick={() => setFailed(!onConfirm())}>
            {failed ? 'Try again' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- list ----------

function ListView({
  items,
  onAskDelete,
}: {
  items: { date: string; entry: Entry }[];
  onAskDelete: (date: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  // Group by month, newest first.
  const groups = useMemo(() => {
    const out: { label: string; items: typeof items }[] = [];
    for (const it of items) {
      const d = fromKey(it.date);
      const label = monthLabel(d.getFullYear(), d.getMonth());
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(it);
      else out.push({ label, items: [it] });
    }
    return out;
  }, [items]);

  return (
    <div className="month-groups">
      {groups.map((g) => (
        <section key={g.label} className="month-group" aria-label={g.label}>
          <h2 className="month-label">{g.label}</h2>
          <div className="entry-list">
            {g.items.map(({ date, entry }) => {
              const isOpen = open === date;
              const panelId = `entry-${date}`;
              return (
                isOpen ? (
                  // The whole expanded card collapses on click, except the Delete button.
                  <article
                    key={date}
                    className="entry-expanded is-clickable"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('.btn-delete, .entry-head')) setOpen(null);
                    }}
                  >
                    <button className="entry-head" aria-expanded="true" aria-controls={panelId} onClick={() => setOpen(null)}>
                      <span className="entry-date accent">{longDate(date)}</span>
                      <img src={collapseIcon} width={18} height={18} alt="" />
                    </button>
                    <div id={panelId} className="entry-panel">
                      <Responses entry={entry} />
                      <DeleteButton date={date} onClick={() => onAskDelete(date)} />
                    </div>
                  </article>
                ) : (
                  // The whole collapsed row (date, preview and chevron) is one button.
                  <article key={date} className="entry-collapsed">
                    <button
                      className="entry-row"
                      aria-expanded="false"
                      aria-controls={panelId}
                      onClick={() => setOpen(date)}
                    >
                      <span className="entry-head">
                        <span className="entry-date">{longDate(date)}</span>
                        <img src={expandIcon} width={18} height={18} alt="" />
                      </span>
                      <span id={panelId} className="entry-preview">
                        {entry.responses[0]}
                      </span>
                    </button>
                    <div className="divider" />
                  </article>
                )
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------- calendar ----------

function CalendarView({
  entries,
  today,
  onAskDelete,
}: {
  entries: Entries;
  today: string;
  onAskDelete: (date: string) => void;
}) {
  const now = fromKey(today);
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(today);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(null); // changing months clears the selection and its panel
  };

  const selectedEntry = selected ? entries[selected] : undefined;

  return (
    <div className="calendar">
      <div className="month-nav">
        <h2 className="month-label" aria-live="polite">
          {monthLabel(cursor.y, cursor.m)}
        </h2>
        <div className="month-controls">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <img src={prevIcon} width={18} height={18} alt="" />
          </button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
            <img src={nextIcon} width={18} height={18} alt="" />
          </button>
        </div>
      </div>
      <table className="cal-grid">
        <thead>
          <tr>
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
              <th key={d} scope="col" abbr={d}>
                <span aria-hidden="true">{d[0]}</span>
                <span className="sr-only">{d}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {Array.from({ length: 7 }, (_, di) => {
                const day = week[di];
                if (!day) return <td key={di} />;
                const key = toKey(new Date(cursor.y, cursor.m, day));
                const entry = entries[key];
                const isSel = selected === key;
                const cls = ['day', entry ? 'has-entry' : '', isSel ? 'is-selected' : '', key === today ? 'is-today' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td key={di}>
                    <button
                      className={cls}
                      aria-pressed={isSel}
                      aria-current={key === today ? 'date' : undefined}
                      aria-label={`${longDate(key)}${entry ? ', has an entry' : ''}`}
                      onClick={() => setSelected(key)}
                    >
                      <span className="day-num">{day}</span>
                      {entry && (
                        <span className="day-snippet" aria-hidden="true">
                          {entry.responses[0]}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <article className="entry-expanded selected-day" aria-live="polite">
          <h3 className="entry-date accent">{longDate(selected)}</h3>
          {selectedEntry ? (
            <>
              <Responses entry={selectedEntry} />
              <DeleteButton date={selected} onClick={() => onAskDelete(selected)} />
            </>
          ) : (
            <p className="no-entry">No entry for this date.</p>
          )}
        </article>
      )}
    </div>
  );
}
