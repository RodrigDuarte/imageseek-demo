import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaGithub, FaInfoCircle } from 'react-icons/fa';
import AboutModal from './AboutModal';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  return (
    <>
      <div className="container mx-auto max-w-6xl px-4">
        <footer className="mt-12 py-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0">
          {/* Left side - Copyright */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} {t('footer.copyright')}
          </div>
          
          {/* Right side - Links */}
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/RodrigDuarte/image-retrieval-system"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 
                       hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title={t('footer.github')}
            >
              <FaGithub className="h-3 w-3" />
              <span>{t('footer.github')}</span>
            </a>
            
            {/* <a
              href="#"
              className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 
                       hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title={t('footer.docs')}
            >
              <FaBook className="h-3 w-3" />
              <span>API Docs</span>
            </a> */}
            
            <button
              onClick={() => setIsAboutModalOpen(true)}
              className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 
                       hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
              title={t('footer.about')}
            >
              <FaInfoCircle className="h-3 w-3" />
              <span>{t('footer.about')}</span>
            </button>
            </div>
          </div>
        </footer>
      </div>

      <AboutModal 
        isOpen={isAboutModalOpen} 
        onClose={() => setIsAboutModalOpen(false)} 
      />
    </>
  );
};

export default Footer;