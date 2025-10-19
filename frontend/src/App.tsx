import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from './config/env';
import { useTheme } from './hooks/useTheme';
import { useNotifications } from './hooks/useNotifications';
import { useSearch } from './hooks/useSearch';
import { useImageViewer } from './hooks/useImageViewer';
import { useDebugModal } from './hooks/useDebugModal';
import { useModelStatus } from './hooks/useModelStatus';

import Header from './components/Header';
import SearchContainer from './components/SearchContainer';
import WelcomeSection from './components/WelcomeSection';
import ResultsList from './components/ResultsList';
import ImageViewer from './components/ImageViewer';
import Notifications from './components/Notifications';
import Footer from './components/Footer';
import DebugModal from './components/DebugModal';

function App() {
  const { theme, setLight, setDark, setSystem } = useTheme();
  const {
    notifications,
    showError,
    showWarning,
    removeNotification,
  } = useNotifications();
  
  const {
    isLoading,
    loadingMessage,
    results,
    isHybridSearch,
    maxResults,
    hybridFunction,
    modelInfo,
    currentQuery,
    initialQuery,
    setMaxResults,
    setHybridFunction,
    performSearch,
    fetchModelInfo,
    clearResults,
    toggleSearchMode,
    openGoogleComparison,
    openArquivoComparison,
  } = useSearch();

  const {
    isOpen: isImageViewerOpen,
    imageSrc,
    title: imageTitle,
    imageDetails,
    openImageViewer,
    closeImageViewer,
  } = useImageViewer();

  const {
    isOpen: isDebugModalOpen,
    closeDebugModal,
    toggleDebugModal,
  } = useDebugModal();

  // Use the model status hook with 3-second polling
  const { status: modelStatus } = useModelStatus(3000);

  const [hasSearched, setHasSearched] = useState(false);

  // fetching the model info on mount and setting up the interval for refreshing
  useEffect(() => {
    fetchModelInfo();
    
    // refreshing the model info
    const interval = setInterval(fetchModelInfo, config.modelInfoRefreshInterval);
    return () => clearInterval(interval);
  }, [fetchModelInfo]);

  // handling the initial query
  useEffect(() => {
    if (initialQuery.trim()) {
      setHasSearched(true);
      performSearch(
        initialQuery, 
        (message: string) => showError('Search Error', message),
        (message: string) => showWarning('Search Warning', message)
      );
    }
  }, [initialQuery, performSearch, showError, showWarning]);

  const handleSearch = async (query: string) => {
    setHasSearched(true);
    await performSearch(
      query, 
      (message: string) => showError('Search Error', message),
      (message: string) => showWarning('Search Warning', message)
    );
  };

  const handleQuerySelect = (query: string) => {
    setHasSearched(true);
    performSearch(
      query, 
      (message: string) => showError('Search Error', message),
      (message: string) => showWarning('Search Warning', message)
    );
  };

  const handleGoogleComparison = (query: string) => {
    openGoogleComparison(query, (message: string) => showError('Google Search Error', message));
  };

  const handleArquivoComparison = (query: string) => {
    openArquivoComparison(query, (message: string) => showError('Arquivo Search Error', message));
  }

  const handleToggleSearchMode = () => {
    toggleSearchMode();
  };

  const handleMaxResultsChange = (value: number) => {
    setMaxResults(value);
  };

  const handleHybridFunctionChange = (value: number) => {
    setHybridFunction(value);
  };

  const showWelcome = !hasSearched && results.length === 0;

  const handleBackToWelcome = () => {
    setHasSearched(false);
    clearResults();
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-gray-900 transition-colors">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Header 
          theme={theme} 
          showBackButton={!showWelcome}
          showTitle={!showWelcome}
          modelInfo={modelInfo}
          modelStatus={modelStatus}
          onSetLight={setLight}
          onSetDark={setDark}
          onSetSystem={setSystem}
          onBackClick={handleBackToWelcome}
          onDebugClick={toggleDebugModal}
        />
        
        <div className={`w-full ${
          showWelcome 
            ? 'flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.32)-theme(spacing.32))]' 
            : 'space-y-6'
        }`}>
          <div className="w-full max-w-6xl">
            <SearchContainer
              isLoading={isLoading}
              loadingMessage={loadingMessage}
              isHybridSearch={isHybridSearch}
              maxResults={maxResults}
              hybridFunction={hybridFunction}
              modelInfo={modelInfo}
              currentQuery={currentQuery}
              showTitle={showWelcome}
              onSearch={handleSearch}
              onToggleSearchMode={handleToggleSearchMode}
              onMaxResultsChange={handleMaxResultsChange}
              onHybridFunctionChange={handleHybridFunctionChange}
              onGoogleComparison={handleGoogleComparison}
              onArquivoComparison={handleArquivoComparison}
            />
            
            <AnimatePresence mode="wait">
              {showWelcome && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-8"
                >
                  <WelcomeSection onQuerySelect={handleQuerySelect} />
                </motion.div>
              )}
              
              {!showWelcome && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6"
                >
                  <ResultsList
                    results={results}
                    isLoading={isLoading}
                    loadingMessage={loadingMessage}
                    hasSearched={hasSearched}
                    onImageClick={openImageViewer}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <ImageViewer
          isOpen={isImageViewerOpen}
          imageSrc={imageSrc}
          title={imageTitle}
          imageDetails={imageDetails}
          onClose={closeImageViewer}
        />

        <Notifications
          notifications={notifications}
          onRemove={removeNotification}
        />

        <DebugModal
          isOpen={isDebugModalOpen}
          onClose={closeDebugModal}
        />
      </div>
      
      <Footer />
    </div>
  );
}

export default App;
