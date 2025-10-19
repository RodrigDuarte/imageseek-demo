import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaSearch, FaImage, FaBrain, FaGlobe} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Modal Content */}
          <motion.div 
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            {/* <FaRobot className="h-6 w-6 text-blue-500" /> */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('about.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors
                     w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            title={t('about.close')}
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-3 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Introduction */}
          <div className="space-y-3">
            <p className="text-sm font-light text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong>{t('about.intro.title')}</strong> {t('about.intro.description')}
            </p>
            
           <p className="text-sm font-light text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('about.intro.dataset')} <strong>{t('about.intro.datasetCount')}</strong> {t('about.intro.datasetSource')}
            </p>

           <p className="text-sm font-light text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('about.intro.innovation')} <strong>{t('about.intro.innovationHighlight')}</strong> {t('about.intro.innovationDescription')}
            </p>
          </div>
          
          {/* Features */}
          <div className="space-y-3 mt-5">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('about.featuresTitle')}</h4>
            
            <div className="flex items-start space-x-3">
              <FaGlobe className="h-4 w-4 text-gray-900 dark:text-white mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-sm text-gray-900 dark:text-white">
                  {t('about.features.multilingual.title')}
                </h5>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                  {t('about.features.multilingual.description')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <FaImage className="h-4 w-4 text-gray-900 dark:text-white mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-sm text-gray-900 dark:text-white">
                  {t('about.features.hybrid.title')}
                </h5>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                  {t('about.features.hybrid.description')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <FaBrain className="h-4 w-4 text-gray-900 dark:text-white mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-sm text-gray-900 dark:text-white">
                  {t('about.features.clip.title')}
                </h5>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                  {t('about.features.clip.description')}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <FaSearch className="h-4 w-4 text-gray-900 dark:text-white mt-1 flex-shrink-0" />
              <div>
                <h5 className="text-sm text-gray-900 dark:text-white">
                  {t('about.features.comparison.title')}
                </h5>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                  {t('about.features.comparison.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Dataset Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <strong>{t('about.datasetInfo.label')}</strong> {t('about.datasetInfo.description')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('about.footer.institutions')}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
            {t('about.footer.github')}
          </p>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AboutModal;