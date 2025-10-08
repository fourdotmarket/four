import React from 'react';
import './LoadingScreen.css';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img src="/logo.png" alt="Loading" className="loading-logo" />
      </div>
    </div>
  );
}