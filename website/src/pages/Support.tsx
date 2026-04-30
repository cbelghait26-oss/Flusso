import Footer from '../components/Footer';

export default function Support() {
  return (
    <main>
      <div className="legal-page">
        <div className="legal-inner">
          <h1 className="legal-title">Support</h1>
          <p className="legal-updated">We're here to help.</p>

          <section className="legal-section">
            <h2>Contact Us</h2>
            <p>
              For help with Flusso, feature requests, or billing questions, email us at{' '}
              <a href="mailto:support@flussoapp.com">support@flussoapp.com</a>. We typically
              respond within 1–2 business days.
            </p>
          </section>

          <section className="legal-section">
            <h2>Frequently Asked Questions</h2>

            <div className="faq-item">
              <h3>How do I cancel my subscription?</h3>
              <p>
                Flusso subscriptions are managed entirely through Apple. To cancel, open
                the Settings app on your iPhone → tap your name → Subscriptions → Flusso →
                Cancel Subscription.
              </p>
            </div>

            <div className="faq-item">
              <h3>How do I restore my purchases?</h3>
              <p>
                In the Flusso app, go to Settings → Account → Restore Purchases. Make sure
                you're signed in with the same Apple ID used when you originally purchased.
              </p>
            </div>

            <div className="faq-item">
              <h3>My focus sessions aren't syncing across devices.</h3>
              <p>
                Ensure you're signed in with the same Flusso account on all devices, and
                that you have an active internet connection. Force-quit and reopen the app,
                then wait a few seconds for sync to complete.
              </p>
            </div>

            <div className="faq-item">
              <h3>How do I connect Spotify?</h3>
              <p>
                In the Flusso app, go to Settings → Music → Connect Spotify. You'll be
                redirected to authenticate with your Spotify account. Spotify Premium is
                required for playback.
              </p>
            </div>

            <div className="faq-item">
              <h3>How do I add friends on the leaderboard?</h3>
              <p>
                Go to the Social tab → tap the person+ icon in the top right → search by
                Flusso username. Once they accept, you'll appear on each other's leaderboard.
              </p>
            </div>

            <div className="faq-item">
              <h3>How do I delete my account?</h3>
              <p>
                In the Flusso app, go to Settings → Account → Delete Account. This
                permanently removes all your data from our servers and cannot be undone.
                Remember to cancel your subscription separately via Apple Settings before
                deleting.
              </p>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
