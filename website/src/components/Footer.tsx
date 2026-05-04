import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <img src="/AppIcon.png" alt="Flusso" width="28" height="28" style={{ borderRadius: 6 }} />
            <span>Flusso</span>
          </div>
          <p className="footer-tagline">
            The premium focus app for people who mean it.
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <div className="footer-col-title">App</div>
            <a
              href="https://apps.apple.com/app/flusso/id6759956350"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download on iOS
            </a>
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Legal</div>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/support">Support</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Flusso. All rights reserved.</span>
      </div>
    </footer>
  );
}
