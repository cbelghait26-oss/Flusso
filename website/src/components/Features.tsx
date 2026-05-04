const features = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: 'Deep Focus Sessions',
    description:
      'Run timed Pomodoro-style focus blocks with ambient soundscapes, a live iOS Lock Screen widget, and full session history to track your deep work over time.',
    accent: '#1C7ED6',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Objectives & Tasks',
    description:
      'Build a hierarchy of bold objectives broken into concrete tasks. Color-code by domain, set due dates, and watch progress bars fill as you close out work.',
    accent: '#A855F7',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Unified Calendar',
    description:
      'Every task, objective deadline, focus session, and synced calendar event on a single timeline. Week and month views, holiday overlays, and drag-to-reschedule.',
    accent: '#2EC4B6',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'Habits & Streaks',
    description:
      'Build daily non-negotiables with streak counters, completion rings, and streak rewards. Habits live in the Training Room alongside your fitness stats.',
    accent: '#F97316',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Social Leaderboard',
    description:
      'Add friends, compare weekly focus hours, and earn achievement badges. A competitive layer that turns private discipline into shared momentum.',
    accent: '#FACC15',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    title: 'Focus Music',
    description:
      'Spotify integration streams focus-curated playlists directly in the app. Or pick from built-in ambient sounds — rain, white noise, café hum — with volume mixing.',
    accent: '#22C55E',
  },
];

export default function Features() {
  return (
    <section className="features" id="features">
      <div className="section-inner">
        <div className="section-label">WHAT FLUSSO DOES</div>
        <h2 className="section-title">
          Every tool for your <span className="accent">best work.</span>
        </h2>
        <p className="section-subtitle">
          Flusso combines the focused depth of a Pomodoro timer with the organizational
          power of an OKR system — built for people who take their output seriously.
        </p>
        <div className="features-grid">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon" style={{ background: `${f.accent}22`, color: f.accent }}>
                {f.icon}
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
