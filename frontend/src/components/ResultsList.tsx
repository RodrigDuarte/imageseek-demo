import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FaQuestionCircle } from 'react-icons/fa';
import { apiEndpoints } from '../config/env';
import type { SearchResult } from '../hooks/useSearch';

interface ResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  loadingMessage: string;
  hasSearched: boolean;
  onImageClick: (src: string, title: string, hash?: string) => void;
}

const ResultsList: React.FC<ResultsListProps> = ({ 
  results, 
  isLoading, 
  loadingMessage,
  hasSearched, 
  onImageClick 
}) => {
  const { t } = useTranslation();
  const [columns, setColumns] = useState(4);

  const extractImageHash = (result: SearchResult, imgSrc: string): string | null => {
    if (result.hash) return result.hash;
    
    const hashMatch = imgSrc.match(/\/image\/([a-f0-9]+)/);
    if (hashMatch) return hashMatch[1];
    
    return result.id || null;
  };

  const extractTitle = (result: SearchResult): string => {
    return result.hash || result.id || 'Unknown';
  };

  const getColumnsCount = () => {
    if (typeof window === 'undefined') return 4;
    
    const width = window.innerWidth;
    if (width < 640) return 1;      // mobile
    if (width < 1024) return 2;     // tablet
    if (width < 1280) return 3;     // desktop
    return 4;                       // big desktop (xl breakpoint)
  };

  useEffect(() => {
    const handleResize = () => {
      setColumns(getColumnsCount());
    };

    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // distribute items into columns
  const distributeItems = () => {
    const cols: Array<Array<SearchResult & { originalIndex: number }>> = Array.from(
      { length: columns }, 
      () => []
    );
    
    results.forEach((item, index) => {
      const colIndex = index % columns;
      cols[colIndex].push({ ...item, originalIndex: index });
    });
    
    return cols;
  };

  const isModelLoading = isLoading && loadingMessage.includes('Model');

  if (isModelLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center py-20"
      >
        <div className="flex flex-col items-center space-y-6">
          <div className="flex space-x-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-3 h-3 bg-orange-500 rounded-full"
                animate={{
                  scale: [1, 1, 1],
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
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center space-y-3 max-w-md"
          >
            <h3 className="text-lg inter font-semibold  text-gray-900 dark:text-white">
              {t('results.loading.preparingModel')}
            </h3>
            <p className="text-gray-600 geist dark:text-gray-400 text-sm leading-relaxed geist">
              {loadingMessage}
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-xs geist">
              {t('results.loading.searchWillContinue')}
            </p>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center py-20"
      >
        <div className="flex flex-col items-center space-y-6">
          {/* loading */}
          <div className="flex space-x-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-1 h-1 bg-orange-500 rounded-full"
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
        </div>
      </motion.div>
    );
  }

  if (hasSearched && results.length === 0) {
    return (
      <motion.div 
        className="text-center py-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <FaQuestionCircle className="w-16 h-16 text-gray-400 dark:text-gray-500" />
          </motion.div>
          <p className="text-gray-600 dark:text-gray-400 font-medium text-base">
            {t('results.noResults')}
          </p>
        </div>
      </motion.div>
    );
  }

  if (!hasSearched) {
    return null;
  }

  const columnItems = distributeItems();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <AnimatePresence mode="sync">
        {columnItems.map((column, colIndex) => (
          <motion.div 
            key={`col-${colIndex}-${columns}`}
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence mode="popLayout">
              {column.map((result, itemIndex) => {
                const imgSrc = result.url || apiEndpoints.image(result.hash || result.id || '');
                const title = extractTitle(result);
                const hash = extractImageHash(result, imgSrc);
                const score = parseFloat(result.score?.toString() || '0');

                return (
                  <motion.div
                    key={`${result.id || result.hash || result.originalIndex}`}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden cursor-pointer
                             hover:shadow-lg transition-all duration-200 group"
                    onClick={() => onImageClick(imgSrc, title, hash || undefined)}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ 
                      duration: 0.3,
                      ease: [0.25, 0.46, 0.45, 0.94],
                      delay: itemIndex * 0.02
                    }}
                    layout
                    layoutId={`item-${result.id || result.hash || result.originalIndex}`}
                  >
                    <div className="relative bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <img
                        src={imgSrc}
                        alt={title}
                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                        onError={(e) => {
                          console.warn('Failed to load image:', imgSrc);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {/* Overlay with image information */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent 
                                    opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="text-white">
                            <div className="flex items-center justify-between text-sm">
                              <span className='font-bold text-base'>{score.toFixed(3)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ResultsList;