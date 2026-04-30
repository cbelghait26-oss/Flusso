export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-content">
        <div className="hero-badge">Available on iOS</div>
        <h1 className="hero-title">
          Flow into <span className="accent">Focus.</span>
        </h1>
        <p className="hero-subtitle">
          Set bold objectives. Crush your tasks. Run deep work sessions.
          Build habits that stick — and compete with friends who push you forward.
        </p>
        <div className="hero-cta">
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-appstore"
          >
            <AppStoreIcon />
            <span>
              <small>Download on the</small>
              App Store
            </span>
          </a>
          <a href="#features" className="btn-ghost">
            See Features ↓
          </a>
        </div>
        <p className="hero-note">Free to download · Premium unlocks everything</p>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="phone-mockup">
          <div className="phone-screen">
            <MockScreen />
          </div>
        </div>
      </div>
    </section>
  );
}

function AppStoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.18 1.27-2.16 3.79.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.37 2.79M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function MockScreen() {
  const tasks = [
    { label: 'Morning workout', done: true, color: '#2EC4B6' },
    { label: 'Review quarterly OKRs', done: false, color: '#1C7ED6' },
    { label: 'Deep work block 90 min', done: false, color: '#A855F7' },
  ];

  return (
    <div className="mock-screen-inner">
      <div className="mock-header">
        <span className="mock-greeting">Good morning, Alex</span>
        <div className="mock-streak">🔥 14</div>
      </div>
      <div className="mock-focus-card">
        <div className="mock-focus-label">FOCUS</div>
        <div className="mock-focus-timer">45:00</div>
        <div className="mock-focus-progress">
          <div className="mock-focus-bar" />
        </div>
      </div>
      <div className="mock-tasks">
        {tasks.map((t) => (
          <div key={t.label} className="mock-task">
            <div
              className="mock-task-check"
              style={{
                background: t.done ? t.color : 'transparent',
                border: `2px solid ${t.color}`,
              }}
            >
              {t.done && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <span
              className="mock-task-label"
              style={{
                opacity: t.done ? 0.45 : 1,
                textDecoration: t.done ? 'line-through' : 'none',
              }}
            >
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
