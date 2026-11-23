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
              {t === 'today' ? 'Today' : 'Look back'}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
