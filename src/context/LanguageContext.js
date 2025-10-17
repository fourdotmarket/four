import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../translations/en.json';
import zh from '../translations/zh.json';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [translations, setTranslations] = useState(en);

  // Auto-detect language based on location or browser settings
  useEffect(() => {
    const detectLanguage = () => {
      // Check if language is stored in localStorage
      const savedLanguage = localStorage.getItem('preferred_language');
      if (savedLanguage) {
        return savedLanguage;
      }

      // Check browser language
      const browserLang = navigator.language || navigator.userLanguage;
      
      // Check for Chinese regions
      if (browserLang.startsWith('zh')) {
        return 'zh';
      }

      // Try to detect timezone for China/Hong Kong
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone === 'Asia/Shanghai' || timezone === 'Asia/Hong_Kong' || timezone === 'Asia/Chongqing') {
        return 'zh';
      }

      return 'en';
    };

    const detectedLanguage = detectLanguage();
    changeLanguage(detectedLanguage);
  }, []);

  const changeLanguage = (lang) => {
    setLanguage(lang);
    setTranslations(lang === 'zh' ? zh : en);
    localStorage.setItem('preferred_language', lang);
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

