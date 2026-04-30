import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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
          </div>
          <span className="logo-text">Flusso</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" onClick={() => setMenuOpen(false)} end>
            Home
          </NavLink>
          <a href="/#features" onClick={() => setMenuOpen(false)}>
            Features
          </a>
          <NavLink to="/privacy" onClick={() => setMenuOpen(false)}>
            Privacy
          </NavLink>
          <NavLink to="/support" onClick={() => setMenuOpen(false)}>
            Support
          </NavLink>
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-download-nav"
            onClick={() => setMenuOpen(false)}
          >
            Download
          </a>
        </div>

        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}
