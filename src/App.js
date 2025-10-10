import React, { useState, useEffect } from 'react';
import './App.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import SubHeader from './components/SubHeader';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import Trending from './pages/Trending';
import FMarket from './pages/FMarket';
import Market from './pages/Market';
import Resolved from './pages/Resolved';
import Bet from './pages/Bet';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
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
      </Routes>
    </div>
  );
}

export default function App() {
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const randomDuration = Math.floor(Math.random() * (2200 - 1500 + 1)) + 1500;
    const timer = setTimeout(() => setInitialLoad(false), randomDuration);
    return () => clearTimeout(timer);
  }, []);

  if (initialLoad) {
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
        <LoadingScreen />
      </PrivyProvider>
    );
  }

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
      <Router>
        <AppContent />
      </Router>
    </PrivyProvider>
  );
}