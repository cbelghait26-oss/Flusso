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
              <li>✓ Focus timer (unlimited sessions)</li>
              <li>✓ Up to 3 active objectives</li>
              <li>✓ Basic task management</li>
              <li>✓ 7-day calendar view</li>
              <li>✓ 1 habit tracker</li>
            </ul>
            <a
              href="https://apps.apple.com"
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
              <li>✓ Everything in Free</li>
              <li>✓ Unlimited objectives & tasks</li>
              <li>✓ Unlimited habits & streaks</li>
              <li>✓ Social leaderboard & friends</li>
              <li>✓ Focus music &amp; soundscapes</li>
              <li>✓ Live Activity Lock Screen widget</li>
              <li>✓ Achievement badges</li>
              <li>✓ Full calendar with sync</li>
            </ul>
            <a
              href="https://apps.apple.com"
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
              <li>✓ Everything in Premium</li>
              <li>✓ Best value</li>
              <li>✓ Billed once a year</li>
            </ul>
            <a
              href="https://apps.apple.com"
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
