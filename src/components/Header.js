import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import DepositModal from './DepositModal';
import './Header.css';

export default function Header() {
  const { ready, authenticated, login } = usePrivy();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDepositModal, setShowDepositModal] = useState(false);

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="header-logo-brand" onClick={() => navigate('/')}>
            <img src="/logo.png" alt="Logo" className="header-logo" />
            <span className="header-brand">four.market</span>
          </div>
          
          <div className="header-nav">
            <div 
              className={`header-nav-item ${location.pathname === '/trending' ? 'active' : ''}`}
              onClick={() => navigate('/trending')}
            >
              <svg className="trend-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M1.75,12.25l3.646-3.646c.195-.195,.512-.195,.707,0l3.293,3.293c.195,.195,.512,.195,.707,0l6.146-6.146" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path>
                <polyline fill="none" points="11.25 5.75 16.25 5.75 16.25 10.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></polyline>
              </svg>
              <span>Trending</span>
            </div>
            
            <div 
              className={`header-nav-item ${location.pathname === '/fmarket' ? 'active' : ''}`}
              onClick={() => navigate('/fmarket')}
            >
              <span>Four.Market</span>
            </div>
            
            <div 
              className={`header-nav-item ${location.pathname === '/market' ? 'active' : ''}`}
              onClick={() => navigate('/market')}
            >
              <span>Public Market</span>
            </div>
            
            <div 
              className={`header-nav-item ${location.pathname === '/resolved' ? 'active' : ''}`}
              onClick={() => navigate('/resolved')}
            >
              <span>Resolved</span>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          {ready && !authenticated && (
            <button className="header-button" onClick={login}>
              SIGN IN
            </button>
          )}
          
          {ready && authenticated && !loading && user && (
            <>
              <button 
                className="header-button header-deposit-btn" 
                onClick={() => setShowDepositModal(true)}
              >
                DEPOSIT
              </button>
              
              <div className="header-profile">
                <div className="header-profile-avatar">
                  {user.username ? user.username.charAt(2).toUpperCase() : 'U'}
                </div>
                <span className="header-profile-name">{user.username || 'User'}</span>
              </div>
            </>
          )}
          
          <span className="header-separator">|</span>
          
          <button className="header-globe">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </button>
        </div>
      </header>

      {showDepositModal && user && user.wallet_address && (
        <DepositModal 
          walletAddress={user.wallet_address}
          onClose={() => setShowDepositModal(false)}
        />
      )}
    </>
  );
}