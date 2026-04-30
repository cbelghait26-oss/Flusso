const features = [
  {
    icon: '⏱',
    title: 'Deep Focus Sessions',
    description:
      'Run timed Pomodoro-style focus blocks with ambient soundscapes, a live iOS Lock Screen widget, and full session history to track your deep work over time.',
    accent: '#1C7ED6',
  },
  {
    icon: '🎯',
    title: 'Objectives & Tasks',
    description:
      'Build a hierarchy of bold objectives broken into concrete tasks. Color-code by domain, set due dates, and watch progress bars fill as you close out work.',
    accent: '#A855F7',
  },
  {
    icon: '📅',
    title: 'Unified Calendar',
    description:
      'Every task, objective deadline, focus session, and synced calendar event on a single timeline. Week and month views, holiday overlays, and drag-to-reschedule.',
    accent: '#2EC4B6',
  },
  {
    icon: '⚡️',
    title: 'Habits & Streaks',
    description:
      'Build daily non-negotiables with streak counters, completion rings, and fire-streak rewards. Habits live in the Training Room alongside your fitness stats.',
    accent: '#F97316',
  },
  {
    icon: '🏆',
    title: 'Social Leaderboard',
    description:
      'Add friends, compare weekly focus hours, and earn achievement badges. A competitive layer that turns private discipline into shared momentum.',
    accent: '#FACC15',
  },
  {
    icon: '🎵',
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
              <div className="feature-icon" style={{ background: `${f.accent}22` }}>
                <span>{f.icon}</span>
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
