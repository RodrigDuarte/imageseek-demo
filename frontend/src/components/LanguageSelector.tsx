import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'EN' },
    { code: 'pt', name: 'PT' }
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const toggleLanguage = () => {
    const nextLanguage = currentLanguage.code === 'en' ? 'pt' : 'en';
    i18n.changeLanguage(nextLanguage);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 
               hover:text-gray-700 dark:hover:text-gray-300 transition-colors
               bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 
               rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer"
      title={`Switch to ${currentLanguage.code === 'en' ? 'Portuguese' : 'English'}`}
    >
      {currentLanguage.name}
    </button>
  );
};

export default LanguageSelector;