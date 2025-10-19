// Environment configuration
export const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  
  // App Configuration
  appTitle: import.meta.env.VITE_APP_TITLE || 'Image Search',
  maxNotifications: parseInt(import.meta.env.VITE_MAX_NOTIFICATIONS || '5'),
  notificationDuration: parseInt(import.meta.env.VITE_NOTIFICATION_DURATION || '5000'),
  
  // Search Configuration
  defaultMaxResults: parseInt(import.meta.env.VITE_DEFAULT_MAX_RESULTS || '8'),
  modelInfoRefreshInterval: parseInt(import.meta.env.VITE_MODEL_INFO_REFRESH_INTERVAL || '30000'),
  
  // Google Search Configuration
  googleSearchSite: import.meta.env.VITE_GOOGLE_SEARCH_SITE || 'presidencia.pt',
} as const;

// API endpoints
export const apiEndpoints = {
  search: `${config.apiBaseUrl}/search`,
  searchComplex: `${config.apiBaseUrl}/search_complex`,
  searchPaginated: `${config.apiBaseUrl}/search_paginated`,
  searchStatus: `${config.apiBaseUrl}/api/search/status`,
  modelStatus: `${config.apiBaseUrl}/api/model/status`,
  imageDetails: (hash: string) => `${config.apiBaseUrl}/api/image/${hash}/details`,
  image: (hash: string) => `${config.apiBaseUrl}/image/${hash}`,
  embeddingsProgress: `${config.apiBaseUrl}/api/embeddings/progress`,
} as const;

// Development helpers
export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;