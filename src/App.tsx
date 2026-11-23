import { useCallback, useEffect, useRef, useState } from 'react';
import { Header, Tab } from './components/Header';
import { Draft, Today } from './components/Today';
import { LookBack, View } from './components/LookBack';
import { PREVIEW, todayKey, useJournal } from './journal';

/** The device's local date, rechecked every 30s and whenever the page becomes visible. */
function useToday() {
  const [key, setKey] = useState(todayKey);
  const refresh = useCallback(() => {
    const now = todayKey();
    setKey(now);
    return now;
  }, []);
  useEffect(() => {
    const id = window.setInterval(refresh, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);
  return [key, refresh] as const;
}

export default function App() {
  const { entries, storageError, save, remove, reload } = useJournal();
  const [today, refreshToday] = useToday();
  const [tab, setTab] = useState<Tab>('today');
  // Session state that survives switching between Today and Look back.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setView] = useState<View>('list');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();

  const announce = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3000);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <>
      <div className={`app ${tab === 'today' ? 'gap-24' : 'gap-16'}${PREVIEW ? ' is-preview' : ''}`}>
        <Header tab={tab} onTab={setTab} />
        {storageError && (
          <div className="banner" role="alert">
            <p>
              {storageError === 'invalid'
                ? 'Mote can’t read the entries saved in this browser, so saving is paused to keep them safe.'
                : 'This browser isn’t letting Mote use its storage right now, so entries can’t be saved. Private browsing or blocked site data can cause this.'}
            </p>
            <button className="banner-action" onClick={reload}>
              Try again
            </button>
          </div>
        )}
        <main className="screen">
          {tab === 'today' ? (
            <Today
              today={today}
              entries={entries}
              draft={draft}
              setDraft={setDraft}
              refreshToday={refreshToday}
              onSave={save}
            />
          ) : (
            <LookBack
              entries={entries}
              today={today}
              view={view}
              onView={setView}
              onDelete={remove}
              onDeleted={() => announce('Entry deleted.')}
              onWrite={() => setTab('today')}
            />
          )}
        </main>
        {PREVIEW && (
          <p className="preview-note">
            Preview: the past entries are samples from the design. What you write stays in this browser.
          </p>
        )}
      </div>

      {!PREVIEW && (
        <div className="wide-notice">
          <p>Mote is designed for mobile. Open this link on your phone.</p>
        </div>
      )}

      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}
