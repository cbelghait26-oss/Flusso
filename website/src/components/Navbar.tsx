import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <img src="/AppIcon.png" alt="Flusso" className="logo-icon" />
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
            href="https://apps.apple.com/app/flusso/id6759956350"
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
