import type { ReactNode } from 'react';

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="pricing-feature-item">
      <svg className="pricing-check" width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="7.5" fill="currentColor" fillOpacity="0.15" />
        <path d="M4 7.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </li>
  );
}

export default function Pricing() {
  return (
    <section className="pricing">
      <div className="section-inner">
        <div className="section-label">PRICING</div>
        <h2 className="section-title">
          Start free. <span className="accent">Go all in.</span>
        </h2>
        <p className="section-subtitle">
          Core features are free forever. Flusso Premium unlocks everything — no limits on
          sessions, tasks, or streaks.
        </p>
        <div className="pricing-cards">
          <div className="pricing-card">
            <div className="pricing-tier">Free</div>
            <div className="pricing-price">
              $0<span>/mo</span>
            </div>
            <ul className="pricing-features">
              <CheckItem>Focus timer (unlimited sessions)</CheckItem>
              <CheckItem>Up to 3 active objectives</CheckItem>
              <CheckItem>Basic task management</CheckItem>
              <CheckItem>7-day calendar view</CheckItem>
              <CheckItem>1 habit tracker</CheckItem>
            </ul>
            <a
              href="https://apps.apple.com/app/flusso/id6759956350"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost-full"
            >
              Get Started Free
            </a>
          </div>

          <div className="pricing-card pricing-card--featured">
            <div className="pricing-badge">Most Popular</div>
            <div className="pricing-tier">Premium</div>
            <div className="pricing-price">
              $4.99<span>/mo</span>
            </div>
            <ul className="pricing-features">
              <CheckItem>Everything in Free</CheckItem>
              <CheckItem>Unlimited objectives &amp; tasks</CheckItem>
              <CheckItem>Unlimited habits &amp; streaks</CheckItem>
              <CheckItem>Social leaderboard &amp; friends</CheckItem>
              <CheckItem>Focus music &amp; soundscapes</CheckItem>
              <CheckItem>Live Activity Lock Screen widget</CheckItem>
              <CheckItem>Achievement badges</CheckItem>
              <CheckItem>Full calendar with sync</CheckItem>
            </ul>
            <a
              href="https://apps.apple.com/app/flusso/id6759956350"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary-full"
            >
              Start Free Trial
            </a>
          </div>

          <div className="pricing-card">
            <div className="pricing-tier">Annual</div>
            <div className="pricing-price">
              $39.99<span>/yr</span>
            </div>
            <div className="pricing-save">Save 33%</div>
            <ul className="pricing-features">
              <CheckItem>Everything in Premium</CheckItem>
              <CheckItem>Best value</CheckItem>
              <CheckItem>Billed once a year</CheckItem>
            </ul>
            <a
              href="https://apps.apple.com/app/flusso/id6759956350"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost-full"
            >
              Get Annual
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
