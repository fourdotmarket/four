import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const buttons = [
    {
      id: 'trending',
      label: t('home.trending'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      ),
      path: '/trending',
    },
    {
      id: 'market',
      label: t('home.market'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
      ),
      path: '/market',
    },
    {
      id: 'deposit',
      label: t('home.deposit'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        </svg>
      ),
      path: '/deposit',
      requiresAuth: true,
    },
    {
      id: 'settings',
      label: t('home.settings'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m0-6h6m-6 0H6"></path>
          <path d="M19.07 4.93l-4.24 4.24m0 5.66l4.24 4.24M4.93 4.93l4.24 4.24m0 5.66l-4.24 4.24"></path>
        </svg>
      ),
      path: '/settings',
      requiresAuth: true,
    },
  ];

  return (
    <div className="home-page">
      <div className="home-container">
        {/* Logo and Title */}
        <div className="home-header">
          <img src="/logo.png" alt="four.market" className="home-logo" />
          <h1 className="home-title">four.market</h1>
          <p className="home-tagline">{t('home.tagline')}</p>
        </div>

        {/* Navigation Grid */}
        <div className="home-nav-grid">
          {buttons.map((button) => (
            <button
              key={button.id}
              className="home-nav-btn"
              onClick={() => navigate(button.path)}
            >
              <div className="home-nav-icon">{button.icon}</div>
              <span className="home-nav-label">{button.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="home-footer">
          <div className="home-tech-stack">
            <span className="tech-badge">Web3</span>
            <span className="tech-separator">•</span>
            <span className="tech-badge">Blockchain</span>
            <span className="tech-separator">•</span>
            <span className="tech-badge">DeFi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
