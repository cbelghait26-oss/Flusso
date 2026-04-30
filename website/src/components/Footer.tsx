import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#1C7ED6" />
              <path
                d="M8 22C10 18 12 14 16 12C20 10 22 14 20 18C18 22 14 22 12 20"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="16" cy="16" r="3" fill="white" opacity="0.9" />
            </svg>
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
              href="https://apps.apple.com"
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
