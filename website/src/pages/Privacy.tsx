import Footer from '../components/Footer';

export default function Privacy() {
  return (
    <main>
      <div className="legal-page">
        <div className="legal-inner">
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-updated">Last updated: April 30, 2026</p>

          <section className="legal-section">
            <h2>1. Information We Collect</h2>
            <p>
              Flusso collects information you provide directly, including your email address,
              display name, and profile photo when you create an account. We also collect
              usage data such as focus session durations, task completion records, and habit
              streaks to provide app functionality and syncing across devices.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide, maintain, and improve Flusso's features</li>
              <li>Sync your data across devices via Firebase Firestore</li>
              <li>Send optional push notifications (reminders, streak alerts)</li>
              <li>Enable social features (leaderboard, friend connections)</li>
              <li>Process subscription payments via Apple In-App Purchase</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Data Storage & Security</h2>
            <p>
              Your data is stored securely in Google Firebase (Firestore and Authentication).
              Firebase uses industry-standard encryption in transit and at rest. We do not
              sell your personal information to third parties.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Third-Party Services</h2>
            <p>Flusso integrates with the following third-party services:</p>
            <ul>
              <li>
                <strong>Firebase (Google)</strong> — Authentication, cloud database, and
                cloud functions.{' '}
                <a
                  href="https://firebase.google.com/support/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong>Spotify</strong> — Optional music integration. Only activated if
                you connect your Spotify account. No Spotify data is stored by Flusso.{' '}
                <a
                  href="https://www.spotify.com/legal/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong>RevenueCat</strong> — Subscription management and entitlement
                verification.{' '}
                <a
                  href="https://www.revenuecat.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Data Retention & Deletion</h2>
            <p>
              You may delete your account and all associated data at any time from
              Settings → Account → Delete Account inside the Flusso app. Account deletion
              is permanent and cannot be undone.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Children's Privacy</h2>
            <p>
              Flusso is not directed to children under 13. We do not knowingly collect
              personal information from children under 13. If you believe a child has
              provided us personal information, please contact us immediately.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              significant changes by posting the new policy on this page with an updated
              date. Continued use of Flusso after changes constitutes acceptance.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:support@flussoapp.com">support@flussoapp.com</a>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
