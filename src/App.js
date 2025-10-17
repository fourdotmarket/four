import React, { useState, useEffect } from 'react';
import './App.css';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import Header from './components/Header';
import SubHeader from './components/SubHeader';
import LoadingScreen from './components/LoadingScreen';
import PrivateKeyUI from './components/PrivateKeyUI';
import { useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import Trending from './pages/Trending';
import FMarket from './pages/FMarket';
import Market from './pages/Market';
import Resolved from './pages/Resolved';
import Bet from './pages/Bet';
import Position from './pages/Position';
import Winnings from './pages/Winnings';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

function AppContent() {
  const [initialLoad, setInitialLoad] = useState(true);
  const { ready: privyReady } = usePrivy();
  
  // CRITICAL: Get ALL the values from useAuth
  const { 
    user, 
    loading: authLoading, 
    showPrivateKeyUI, 
    privateKeyData, 
    closePrivateKeyUI 
  } = useAuth();

  // Wait for initial animation AND Privy to be ready
  useEffect(() => {
    const randomDuration = Math.floor(Math.random() * (2200 - 1500 + 1)) + 1500;
    const timer = setTimeout(() => {
      console.log('🎬 Initial animation complete');
      setInitialLoad(false);
    }, randomDuration);
    return () => clearTimeout(timer);
  }, []);

  // Enhanced debug logging
  useEffect(() => {
    console.log('🎯 App State:', {
      initialLoad,
      privyReady,
      authLoading,
      hasUser: !!user,
      username: user?.username,
      showPrivateKeyUI,
      hasPrivateKeyData: !!privateKeyData
    });
  }, [initialLoad, privyReady, authLoading, user, showPrivateKeyUI, privateKeyData]);

  // Show loading screen while: 
  // 1. Initial animation is playing, OR
  // 2. Privy is not ready yet, OR  
  // 3. Auth is loading
  const showLoading = initialLoad || !privyReady || authLoading;

  if (showLoading) {
    console.log('🔄 Showing loading screen:', { initialLoad, privyReady, authLoading });
    return <LoadingScreen />;
  }

  console.log('✅ App fully loaded and ready');

  return (
    <>
      {/* CRITICAL: Private Key UI - Must be at root level, outside all other content */}
      {showPrivateKeyUI && privateKeyData && (
        <PrivateKeyUI
          privateKey={privateKeyData.privateKey}
          walletAddress={privateKeyData.walletAddress}
          onClose={closePrivateKeyUI}
        />
      )}

      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <Header />
        <SubHeader />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/fmarket" element={<FMarket />} />
          <Route path="/market" element={<Market />} />
          <Route path="/resolved" element={<Resolved />} />
          <Route path="/bet/:betId" element={<Bet />} />
          <Route path="/position" element={<Position />} />
          <Route path="/winnings" element={<Winnings />} />
          <Route path="/settings" element={<Settings />} />
          {/* Admin route - random token-based access */}
          <Route path="/admin/:token" element={<Admin />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <PrivyProvider
      appId="cmggw74r800rujm0cccr9s7np"
      config={{
        appearance: {
          theme: {
            colors: {
              backgroundPrimary: '#0E0E0E',
              backgroundSecondary: '#000000',
              backgroundTertiary: '#1a1a1a',
              textPrimary: '#ffffff',
              textSecondary: '#b8b8b8',
              accent: '#FFD43B',
              buttonBackground: '#FFD43B',
              buttonText: '#000000',
            },
          },
          accentColor: '#FFD43B',
          logo: '/logo.png',
          showWalletLoginFirst: false,
        },
        loginMethods: ['email', 'google', 'twitter'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <LanguageProvider>
        <Router>
          <AppContent />
        </Router>
      </LanguageProvider>
    </PrivyProvider>
  );
}
