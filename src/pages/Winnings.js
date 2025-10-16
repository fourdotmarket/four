import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Winnings.css';

export default function Winnings() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="winnings-page">
      <button className="winnings-back-btn" onClick={handleBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>BACK</span>
      </button>

      <div className="winnings-header">
        <h1 className="winnings-title">MY WINNINGS</h1>
        <p className="winnings-subtitle">Track your earnings from resolved markets</p>
      </div>
    </div>
  );
}

