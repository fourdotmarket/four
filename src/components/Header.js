import React, { useState, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useBalance } from '../hooks/useBalance';
import DepositModal from './DepositModal';
import ProfileDropdown from './ProfileDropdown';
import Notification from './Notification';
import './Header.css';

export default function Header() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { user, loading, authReady } = useAuth();
  const { notification, showNotification, hideNotification } = useNotification();
  const { balance, loading: balanceLoading } = useBalance(user?.wallet_address);
  const navigate = useNavigate();
  const location = useLocation();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileRef = useRef(null);

  // REMOVED: Debug console.log that was causing spam

  const handleDepositClick = () => {
    if (user && user.wallet_address) {
      setShowDepositModal(true);
    } else {
      console.warn('⚠️ No wallet address available for deposit');
      showNotification('Wallet address not available. Please try refreshing the page.', 'error');
    }
  };

  const handleProfileClick = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  const handleLogout = () => {
    logout();
    setShowProfileDropdown(false);
  };

  return (
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
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
                onClick={handleDepositClick}
              >
                DEPOSIT
              </button>
              
              <div 
                ref={profileRef}
                className={`header-profile ${showProfileDropdown ? 'active' : ''}`}
                onClick={handleProfileClick}
              >
                <div className="header-profile-avatar">
                  {user.username ? user.username.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="header-profile-info">
                  <span className="header-profile-name">{user.username}</span>
                  <span className="header-profile-balance">
                    {balanceLoading ? (
                      '...'
                    ) : balance !== null ? (
                      `${balance.toFixed(4)} BNB`
                    ) : (
                      '0.0000 BNB'
                    )}
                  </span>
                </div>
                <svg 
                  className="header-profile-chevron" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              {showProfileDropdown && (
                <ProfileDropdown 
                  user={user}
                  onLogout={handleLogout}
                  onClose={() => setShowProfileDropdown(false)}
                />
              )}
            </>
          )}
          
          {ready && authenticated && loading && (
            <div className="header-loading">Loading...</div>
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