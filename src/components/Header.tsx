import logoMark from '../assets/logo-mark.svg';

export type Tab = 'today' | 'lookback';

export function Header({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <header className="nav">
      <div className="wordmark">
        <img src={logoMark} width={30} height={30} alt="" />
        <span>mote</span>
      </div>
      <nav className="tabs" aria-label="Sections">
        {(['today', 'lookback'] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              className={`tab ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onTab(t)}
            >
              {active && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6.25L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {t === 'today' ? 'Today' : 'Look back'}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
