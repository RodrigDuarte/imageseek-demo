import { useState, useCallback, useEffect } from 'react';
import { config, apiEndpoints } from '../config/env';

export interface SearchResult {
  id?: string;
  hash?: string;
  url?: string;
  score?: number;
}

export interface SearchData {
  results: SearchResult[];
  total: number;
  warning?: {
    message: string;
    reason?: string;
  };
  search_type?: string;
  status?: string;
  message?: string;
  suggestion?: string;
}

export interface ModelInfo {
  info?: {
    alias?: string;
    description?: string;
    model_type?: string;
  };
}

export const useSearch = () => {
  // Helper functions for URL parameters
  const getUrlParams = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      query: params.get('q') || '',
      maxResults: parseInt(params.get('max') || config.defaultMaxResults.toString()),
      isHybridSearch: params.get('mode') === 'hybrid',
      hybridFunction: parseInt(params.get('func') || '1')
    };
  }, []);

  const updateUrlParams = useCallback((params: { query?: string; maxResults?: number; isHybridSearch?: boolean; hybridFunction?: number }) => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (params.query !== undefined) {
      if (params.query.trim()) {
        urlParams.set('q', params.query.trim());
      } else {
        urlParams.delete('q');
      }
    }
    
    if (params.maxResults !== undefined) {
      if (params.maxResults !== config.defaultMaxResults) {
        urlParams.set('max', params.maxResults.toString());
      } else {
        urlParams.delete('max');
      }
    }
    
    if (params.isHybridSearch !== undefined) {
      if (params.isHybridSearch) {
        urlParams.set('mode', 'hybrid');
      } else {
        urlParams.delete('mode');
      }
    }
    
    if (params.hybridFunction !== undefined) {
      if (params.hybridFunction !== 1) {
        urlParams.set('func', params.hybridFunction.toString());
      } else {
        urlParams.delete('func');
      }
    }

    const newUrl = urlParams.toString() ? `${window.location.pathname}?${urlParams.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Initialize state from URL parameters only once
  const [initialParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      query: params.get('q') || '',
      maxResults: parseInt(params.get('max') || config.defaultMaxResults.toString()),
      isHybridSearch: params.get('mode') === 'hybrid',
      hybridFunction: parseInt(params.get('func') || '1')
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isHybridSearch, setIsHybridSearch] = useState(initialParams.isHybridSearch);
  const [maxResults, setMaxResults] = useState(initialParams.maxResults);
  const [hybridFunction, setHybridFunction] = useState(initialParams.hybridFunction);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [currentQuery, setCurrentQuery] = useState(initialParams.query); 

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = getUrlParams();
      setIsHybridSearch(params.isHybridSearch);
      setMaxResults(params.maxResults);
      setHybridFunction(params.hybridFunction);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getUrlParams]);

  // Check model loading status on mount and poll if needed
  useEffect(() => {
    let pollInterval: number | null = null;

    const checkModelStatus = async () => {
      try {
        const statusResponse = await fetch(apiEndpoints.searchStatus, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.model_status === 'loading') {
            setIsLoading(true);
            setLoadingMessage(`Model '${statusData.model_alias || 'AI model'}' is currently loading`);
            
            if (!pollInterval) {
              pollInterval = setInterval(async () => {
                try {
                  const response = await fetch(apiEndpoints.searchStatus, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });

                  if (response.ok) {
                    const data = await response.json();
                    
                    if (data.ready_for_search) {
                      setIsLoading(false);
                      setLoadingMessage('');
                      if (pollInterval) {
                        clearInterval(pollInterval);
                        pollInterval = null;
                      }
                    } else if (data.model_status === 'loading') {
                      // Update loading message
                      setLoadingMessage(`Model '${data.model_alias || 'AI model'}' is loading...`);
                    }
                  }
                } catch (error) {
                  console.warn('Model status polling failed:', error);
                }
              }, 2000);

              setTimeout(() => {
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
                setIsLoading(false);
                setLoadingMessage('');
              }, 60000);
            }
          } else if (statusData.ready_for_search) {
            setIsLoading(false);
            setLoadingMessage('');
          }
        }
      } catch (error) {
        console.warn('Initial model status check failed:', error);
      }
    };

    checkModelStatus();

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  const performSearch = useCallback(async (
    query: string,
    onError: (message: string) => void,
    onWarning: (message: string) => void
  ) => {
    if (!query.trim()) {
      onError('Please enter a search query');
      return;
    }

    setCurrentQuery(query.trim());
    updateUrlParams({ 
      query: query.trim(), 
      maxResults, 
      isHybridSearch, 
      hybridFunction 
    });

    setIsLoading(true);
    setLoadingMessage('Searching...');
    
    let statusPollInterval: number | null = null;
    let searchCompleted = false;
    
    const startStatusPolling = () => {
      statusPollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(apiEndpoints.searchStatus, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();

            if (statusData.model_status === 'loading' && !searchCompleted) {
              setLoadingMessage(`Model '${statusData.model_alias || 'AI model'}' is loading...`);
            }
          }
        } catch (error) {
          console.warn('Status polling failed:', error);
        }
      }, 500); // 500ms
    };

    startStatusPolling();
    
    try {
      const endpoint = isHybridSearch ? apiEndpoints.searchComplex : apiEndpoints.search;
      const bodyData: any = {
        query: query.trim(),
        max_results: maxResults,
      };

      if (isHybridSearch) {
        bodyData.hybrid_function = hybridFunction;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      const data: SearchData = await response.json();

      searchCompleted = true;
      if (statusPollInterval) {
        clearInterval(statusPollInterval);
      }

      // 202 is loading status
      if (response.status === 202 && data.status === 'model_loading') {
        setLoadingMessage(data.message || 'Model is loading...');
        setResults([]);
        
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(apiEndpoints.searchStatus, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              
              if (statusData.ready_for_search) {
                clearInterval(pollInterval);
                setIsLoading(false);
                setLoadingMessage('');
                
                // Retry the original search
                performSearch(query, onError, onWarning);
              } else if (statusData.model_status === 'loading') {
                // Update loading message
                setLoadingMessage(`Model '${statusData.model_alias || 'AI model'}' is loading...`);
              }
            }
          } catch (error) {
            console.warn('Model status polling failed:', error);
          }
        }, 2000);

        // Clear polling after 60 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsLoading(false);
          setLoadingMessage('');
          onError('Model loading timeout. Please try again.');
        }, 60000);
        
        return;
      }

      if (!response.ok) {
        throw new Error(data.warning?.message || `HTTP error! status: ${response.status}`);
      }

      if (data.warning) {
        let message = data.warning.message;
        if (data.warning.reason) {
          message += ` (${data.warning.reason})`;
        }
        onWarning(message);
      }

      setResults(data.results || []);
    } catch (error) {
      // Mark search as completed
      searchCompleted = true;
      
      // Stop status polling
      if (statusPollInterval) {
        clearInterval(statusPollInterval);
      }
      
      console.error('Search failed:', error);
      onError(`Search failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [isHybridSearch, maxResults, hybridFunction, updateUrlParams]);

  const fetchModelInfo = useCallback(async () => {
    try {
      const response = await fetch(apiEndpoints.modelStatus, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setModelInfo(data);
      }
    } catch (error) {
      console.warn('Error fetching model info:', error);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setCurrentQuery('');
    
    // Clear all URL parameters when going back to welcome
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleMaxResultsChange = useCallback((newMaxResults: number) => {
    setMaxResults(newMaxResults);
    updateUrlParams({ maxResults: newMaxResults });
    
    // Removed auto-search - user must click search button
  }, [updateUrlParams]);

  const handleHybridFunctionChange = useCallback((newHybridFunction: number) => {
    setHybridFunction(newHybridFunction);
    updateUrlParams({ hybridFunction: newHybridFunction });
    
    // Removed auto-search - user must click search button
  }, [updateUrlParams]);

  const toggleSearchModeWithSearch = useCallback(() => {
    const newIsHybridSearch = !isHybridSearch;
    setIsHybridSearch(newIsHybridSearch);
    updateUrlParams({ isHybridSearch: newIsHybridSearch });

    // Removed auto-search - user must click search button
  }, [isHybridSearch, updateUrlParams]);

  // Check for initial search query in URL on mount
  useEffect(() => {
    if (initialParams.query.trim()) {
      setTimeout(() => {
      }, 100);
    }
  }, [initialParams.query]);

  const openGoogleComparison = useCallback((query: string, onError: (message: string) => void) => {
    if (!query.trim()) {
      onError('Please enter a search query first');
      return;
    }

    const encodedQuery = encodeURIComponent(query);
    const googleUrl = `https://www.google.com/search?q=${encodedQuery}+site%3A${config.googleSearchSite}&udm=2&hl=en`;
    window.open(googleUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const openArquivoComparison = useCallback((query: string, onError: (message: string) => void) => {
    if (!query.trim()) {
      onError('Please enter a search query first');
      return;
    }

    const encodedQuery = encodeURIComponent(query);
    const arquivoUrl = `https://arquivo.pt/image/search?query=${encodedQuery}+site%3A${config.googleSearchSite}`;
    window.open(arquivoUrl, '_blank', 'noopener,noreferrer');
  }, []);

  return {
    isLoading,
    loadingMessage,
    results,
    isHybridSearch,
    maxResults,
    hybridFunction,
    modelInfo,
    currentQuery, 
    initialQuery: initialParams.query,
    setMaxResults: handleMaxResultsChange,
    setHybridFunction: handleHybridFunctionChange,
    performSearch,
    fetchModelInfo,
    clearResults,
    toggleSearchMode: toggleSearchModeWithSearch,
    openGoogleComparison,
    openArquivoComparison,
  };
};