import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import USFlag from './flags/USFlag';
import ChinaFlag from './flags/ChinaFlag';
import './LanguageSelector.css';

export default function LanguageSelector({ onClose }) {
  const { language, changeLanguage } = useLanguage();

  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    onClose();
  };

  return (
    <div className="language-selector-overlay" onClick={onClose}>
      <div className="language-selector" onClick={(e) => e.stopPropagation()}>
        <div className="language-selector-header">
          <h3>Select Language</h3>
          <button className="language-selector-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="language-selector-options">
          <button
            className={`language-option ${language === 'en' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('en')}
          >
            <div className="language-option-flag">
              <USFlag width={40} height={30} />
            </div>
            <div className="language-option-info">
              <div className="language-option-name">English</div>
              <div className="language-option-native">English</div>
            </div>
            {language === 'en' && (
              <svg className="language-option-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>

          <button
            className={`language-option ${language === 'zh' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('zh')}
          >
            <div className="language-option-flag">
              <ChinaFlag width={40} height={30} />
            </div>
            <div className="language-option-info">
              <div className="language-option-name">Chinese</div>
              <div className="language-option-native">中文</div>
            </div>
            {language === 'zh' && (
              <svg className="language-option-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

