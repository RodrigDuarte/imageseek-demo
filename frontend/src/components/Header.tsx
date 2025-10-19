import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaSun, FaMoon, FaDesktop, FaArrowLeft } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSelector from './LanguageSelector';
import type { ModelInfo } from '../hooks/useSearch';
import type { ModelStatusData } from '../hooks/useModelStatus';

interface HeaderProps {
  theme: string;
  showBackButton?: boolean;
  showTitle?: boolean;
  modelInfo: ModelInfo | null;
  modelStatus: ModelStatusData | null;
  onSetLight: () => void;
  onSetDark: () => void;
  onSetSystem: () => void;
  onBackClick?: () => void;
  onDebugClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  theme, 
  showBackButton, 
  showTitle = true, 
  modelInfo,
  modelStatus: liveModelStatus,
  onSetLight, 
  onSetDark, 
  onSetSystem, 
  onBackClick 
}) => {
  const { t } = useTranslation();

  const getModelStatus = () => {
    // Use live status if available
    if (liveModelStatus) {
      const isLoading = liveModelStatus.model_status === 'loading';
      const isReady = liveModelStatus.ready_for_search && liveModelStatus.model_status === 'loaded';
      const isUnloaded = liveModelStatus.model_status === 'unloaded';

      if (isUnloaded) {
        return {
          status: 'unloaded',
          color: 'bg-gray-600 dark:bg-gray-300',
          text: t('model.status.unloaded'),
          tooltip: t('model.status.tooltips.unloaded')
        };
      }

      if (isLoading) {
        return {
          status: 'loading',
          color: 'bg-yellow-500',
          text: t('model.status.loading'),
          tooltip: `${liveModelStatus.model_alias || t('model.unknownModel')} - ${t('model.status.tooltips.loading')}`
        };
      }

      if (isReady) {
        return {
          status: 'ready',
          color: 'bg-green-500',
          text: t('model.status.ready'),
          tooltip: `${liveModelStatus.model_alias || modelInfo?.info?.alias || t('model.unknownModel')} - ${t('model.status.tooltips.ready')}`
        };
      }
    }

    // Fallback to modelInfo
    if (!modelInfo) {
      return { 
        status: 'unknown', 
        color: 'bg-gray-400', 
        text: t('model.status.unknown'),
        tooltip: t('model.status.tooltips.unknown')
      };
    }

    if (modelInfo.info) {
      return {
        status: 'ready',
        color: 'bg-green-500',
        text: t('model.status.ready'),
        tooltip: `${modelInfo.info.alias || t('model.unknownModel')} - ${t('model.status.tooltips.ready')}`
      };
    }

    return {
      status: 'unknown',
      color: 'bg-gray-400',
      text: t('model.status.unknown'),
      tooltip: t('model.status.tooltips.unknown')
    };
  };

  const modelStatusDisplay = getModelStatus();

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <FaSun className="w-4 h-4 " />;
      case 'dark':
        return <FaMoon className="w-4 h-4" />;
      case 'system':
        return <FaDesktop className="w-4 h-4" />;
      default:
        return <FaDesktop className="w-4 h-4" />;
    }
  };

  const getNextThemeAction = () => {
    switch (theme) {
      case 'light':
        return { action: onSetDark, label: t('header.switchToDark') };
      case 'dark':
        return { action: onSetSystem, label: t('header.switchToSystem') };
      case 'system':
        return { action: onSetLight, label: t('header.switchToLight') };
      default:
        return { action: onSetLight, label: t('header.switchToLight') };
    }
  };

  const { action, label } = getNextThemeAction();

  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-3">
        <AnimatePresence mode="wait">
          {showBackButton && (
            <motion.button
              key="back-button"
              onClick={onBackClick}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 
                       transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white
                       flex items-center space-x-2"
              title="Back to welcome"
              initial={{ opacity: 0, x: -20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <FaArrowLeft className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
        
        {showTitle && (
          <motion.h1 
            className="text-xl font-semibold text-gray-900 dark:text-white inter tracking-tighter"
            layout
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {t('app.title')}
          </motion.h1>
        )}
      </div>
      
      <div className="theme-toggle-container flex items-center space-x-2">
         {/* model status */}
        <motion.div
          className="flex items-center space-x-2 px-2 py-1.5 rounded-full cursor-help"
          title={`${modelStatusDisplay.text} - ${modelStatusDisplay.tooltip}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${modelStatusDisplay.color}`} />
            {/* Pulse for ready state */}
            {modelStatusDisplay.status === 'ready' && (
              <motion.div
                className={`absolute inset-0 w-2 h-2 rounded-full ${modelStatusDisplay.color}`}
                animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {/* Pulse for loading state */}
            {modelStatusDisplay.status === 'loading' && (
              <motion.div
                className={`absolute inset-0 w-2 h-2 rounded-full ${modelStatusDisplay.color}`}
                animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0.2, 0.8] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
        </motion.div>
        <LanguageSelector />
        {/* {onDebugClick && (
          <button
            onClick={onDebugClick}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 
                     transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            title="Debug Panel (Press D)"
          >
            <FaBug className="w-4 h-4" />
          </button>
        )} */}
        <button
          onClick={action}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 
                   transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          title={label}
        >
          {getThemeIcon()}
        </button>
      </div>
    </div>
  );
};

export default Header;