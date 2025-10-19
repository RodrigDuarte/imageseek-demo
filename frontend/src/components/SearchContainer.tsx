import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaGoogle, FaInfoCircle, FaExternalLinkAlt } from 'react-icons/fa';
import Dropdown from './Dropdown';
import type { ModelInfo } from '../hooks/useSearch';

// import arquivoPtLogo from '/src/assets/arquivopt.png';

interface SearchContainerProps {
  isLoading: boolean;
  loadingMessage: string;
  isHybridSearch: boolean;
  maxResults: number;
  hybridFunction: number;
  modelInfo: ModelInfo | null;
  currentQuery: string; // Current query from URL/state
  showTitle?: boolean;
  onSearch: (query: string) => void;
  onToggleSearchMode: () => void;
  onMaxResultsChange: (value: number) => void;
  onHybridFunctionChange: (value: number) => void;
  onGoogleComparison: (query: string) => void;
  onArquivoComparison: (query: string) => void;
}

const SearchContainer: React.FC<SearchContainerProps> = ({
  isLoading,
  loadingMessage,
  isHybridSearch,
  maxResults,
  hybridFunction,
  modelInfo,
  currentQuery,
  showTitle = false,
  onSearch,
  onToggleSearchMode,
  onMaxResultsChange,
  onHybridFunctionChange,
  onGoogleComparison,
  onArquivoComparison
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState(currentQuery);

  React.useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const getModelTooltip = () => {
    if (!modelInfo?.info) {
      return t('model.infoNotAvailable');
    }

    const info = modelInfo.info;
    const modelName = info.alias || t('model.unknownModel');
    const modelDescription = info.description || t('model.noDescription');
    const modelType = info.model_type || t('model.unknownType');

    return `${t('model.model')}: ${modelName}\n${t('model.type')}: ${modelType}\n${t('model.description')}: ${modelDescription}`;
  };

  const maxResultsOptions = [
    { value: 4, label: '4' },
    { value: 8, label: '8' },
    { value: 16, label: '16' },
    { value: 32, label: '32' }
  ];

  const hybridFunctions = [
    { value: 1, label: t('hybridFunctions.linearZero') },
    { value: 2, label: t('hybridFunctions.linearOne') },
    { value: 3, label: t('hybridFunctions.squareRoot') },
    { value: 4, label: t('hybridFunctions.exponential') }
  ];

  return (
    <div className="space-y-6">
      {/* big title, shown on the main page only */}
      {showTitle && (
        <div className="text-center space-y-2">
          <motion.h1 
            className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white inter tracking-tighter"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {t('app.title')}
          </motion.h1>
          <motion.p
            className="text-sm md:text-base text-gray-600 dark:text-gray-400 tracking-wide geist font-light"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            {t('app.subtitle')}
          </motion.p>
        </div>
      )}

      {/* search container */}
      <div className="bg-slate-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isHybridSearch ? t('search.placeholderHybrid') : t('search.placeholder')}
            className="w-full pl-10 geist pr-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* left side */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            {/* search mode toggle */}
            <div className="flex items-center space-x-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mr-3 whitespace-nowrap">{t('search.searchMode')}</span>
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => isHybridSearch && onToggleSearchMode()}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    !isHybridSearch
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer'
                  }`}
                >
                  {t('search.normal')}
                </button>
                <button
                  type="button"
                  onClick={() => !isHybridSearch && onToggleSearchMode()}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    isHybridSearch
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer' 
                  }`}
                >
                  {t('search.hybrid')}
                </button>
              </div>
              {modelInfo?.info && (
                <button
                  type="button"
                  title={getModelTooltip()}
                  className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FaInfoCircle className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* max results dropdown */}
            <div className="flex items-center space-x-2">
              <Dropdown
                label={t('search.results')}
                value={maxResults}
                options={maxResultsOptions}
                onChange={(value) => onMaxResultsChange(Number(value))}
              />
            </div>

            {/* hybrid */}
            {isHybridSearch && (
              <div className="flex items-center space-x-2 sm:hidden">
                <Dropdown
                  label={t('search.hybridFunction')}
                  value={hybridFunction}
                  options={hybridFunctions}
                  onChange={(value) => onHybridFunctionChange(Number(value))}
                />
              </div>
            )}
          </div>

          {/* right side */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <motion.button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg 
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 cursor-pointer"
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center space-x-2"
                  >
                    <div className="flex space-x-1">
                      {[0, 1, 2].map((index) => (
                        <motion.div
                          key={index}
                          className="w-1 h-1 bg-white rounded-full"
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5],
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: index * 0.2,
                            ease: "easeInOut"
                          }}
                        />
                      ))}
                    </div>
                    <span>{loadingMessage.includes('Model') ? t('search.searching') : t('search.searching')}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center space-x-2"
                  >
                    <FaSearch className="h-3 w-3" />
                    <span>{t('search.search')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <button
              type="button"
              onClick={() => onGoogleComparison(query)}
              disabled={!query.trim()}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-900 
                       text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 cursor-pointer"
              title={t('search.compareWithGoogle')}
            >
              <FaGoogle className="h-3 w-3" />
              <span className="inline">{t('search.googleImages')}</span>
              {/* <span className="sm:hidden">Google</span> */}
            </button>

            <button
              type="button"
              onClick={() => onArquivoComparison(query)}
              disabled={!query.trim()}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-900
                       text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 cursor-pointer"
              title={t('search.compareWithArquivo')}
            >
              {/* <img src={arquivoPtLogo} alt="Arquivo.pt" className="h-3 w-auto flex-shrink-0" /> */}
              <FaExternalLinkAlt className="h-3 w-3" />
              <span className="inline">{t('search.arquivoPt')}</span>
            </button>

          </div>
        </div>

        {/* Hybrid Function (only visible in hybrid mode on desktop) - Shows on desktop after buttons */}
        {isHybridSearch && (
          <div className="hidden sm:flex items-center space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Dropdown
              label={t('search.hybridFunction')}
              value={hybridFunction}
              options={hybridFunctions}
              onChange={(value) => onHybridFunctionChange(Number(value))}
            />
          </div>
        )}
      </form>
    </div>
    </div>
  );
};

export default SearchContainer;