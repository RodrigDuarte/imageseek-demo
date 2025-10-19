import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from '../config/env';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServerStatus {
  status: string;
  app_name: string;
  version: string;
  redis_connected: boolean;
  model: {
    alias: string;
    status: string;
  };
  dynamic_loading: {
    enabled: boolean;
    unload_timeout_minutes: number;
    is_model_loaded: boolean;
    last_query_time: number | null;
  };
  statistics: {
    total_images: number;
    visible_images: number;
    hidden_images: number;
    total_documents: number;
    visible_documents: number;
    hidden_documents: number;
    watched_folders: string[];
  };
  embedding_schedule: {
    schedule_type: string;
    start_hour: number;
    interval_hours: number;
    scheduler_running: boolean;
  };
}

interface EmbeddingProgress {
  active: boolean;
  current: number;
  total: number;
  percentage: number;
  errors: number;
  skipped: number;
  stage: string;
  elapsed_time: number;
}

const DebugModal = ({ isOpen, onClose }: DebugModalProps) => {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [embeddingProgress, setEmbeddingProgress] = useState<EmbeddingProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchServerStatus();
      fetchEmbeddingProgress();

      // Poll server status every 5 seconds
      const statusInterval = setInterval(fetchServerStatus, 5000);
      // Poll embedding progress every 2 seconds
      const progressInterval = setInterval(fetchEmbeddingProgress, 2000);

      return () => {
        clearInterval(statusInterval);
        clearInterval(progressInterval);
      };
    }
  }, [isOpen]);

  const fetchServerStatus = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/status`);
      if (response.ok) {
        const data = await response.json();
        setServerStatus(data);
        setError(null);
      } else {
        setError('Unable to fetch server status');
      }
    } catch (err) {
      setError('Server is not responding');
    }
  };

  const fetchEmbeddingProgress = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/embeddings/progress`);
      if (response.ok) {
        const data = await response.json();
        setEmbeddingProgress(data);
      }
    } catch (err) {
      // Silently fail for progress updates
    }
  };

  const handleGenerateEmbeddings = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/embeddings/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Start polling progress immediately
          fetchEmbeddingProgress();
        }
      }
    } catch (err) {
      setError('Failed to start embedding generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getProgressBarColor = () => {
    if (!embeddingProgress?.active) return 'bg-gray-300';
    if (embeddingProgress.errors > 0) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getProgressStatus = () => {
    if (!embeddingProgress) return 'Ready';
    if (embeddingProgress.active) return embeddingProgress.stage;
    if (embeddingProgress.total > 0) return 'Completed';
    return 'Ready';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-8 lg:inset-16 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Debug Panel
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">D</kbd> to toggle
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Close (Press D)"
              >
                <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Server Statistics */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Server Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatItem label="Total Images" value={serverStatus?.statistics.total_images ?? '...'} />
                  <StatItem label="Visible Images" value={serverStatus?.statistics.visible_images ?? '...'} />
                  <StatItem label="Hidden Images" value={serverStatus?.statistics.hidden_images ?? '...'} />
                  <StatItem label="Total Documents" value={serverStatus?.statistics.total_documents ?? '...'} />
                  <StatItem label="Visible Documents" value={serverStatus?.statistics.visible_documents ?? '...'} />
                  <StatItem label="Hidden Documents" value={serverStatus?.statistics.hidden_documents ?? '...'} />
                  <StatItem 
                    label="Watched Folders" 
                    value={serverStatus?.statistics.watched_folders.length ?? '...'} 
                  />
                  <StatItem 
                    label="Redis" 
                    value={serverStatus?.redis_connected ? '✓ Connected' : '✗ Disconnected'} 
                    valueClassName={serverStatus?.redis_connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                  />
                </div>
              </section>

              {/* System Information */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  System Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoItem label="Application" value={`${serverStatus?.app_name ?? '...'} v${serverStatus?.version ?? '...'}`} />
                  <InfoItem label="Current Model" value={serverStatus?.model.alias ?? '...'} />
                  <InfoItem 
                    label="Model Status" 
                    value={serverStatus?.model.status ?? '...'} 
                    valueClassName={
                      serverStatus?.model.status === 'LOADED' 
                        ? 'text-green-600 dark:text-green-400' 
                        : serverStatus?.model.status === 'LOADING'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-600 dark:text-gray-400'
                    }
                  />
                  <InfoItem label="Screen Resolution" value={`${window.screen.width} × ${window.screen.height}`} />
                  <InfoItem label="Viewport Size" value={`${window.innerWidth} × ${window.innerHeight}`} />
                  <InfoItem 
                    label="Dynamic Loading" 
                    value={serverStatus?.dynamic_loading.enabled ? `Enabled (${serverStatus.dynamic_loading.unload_timeout_minutes}min)` : 'Disabled'} 
                  />
                  {serverStatus?.statistics.watched_folders && serverStatus.statistics.watched_folders.length > 0 && (
                    <InfoItem 
                      label="Watched Path" 
                      value={serverStatus.statistics.watched_folders[0]} 
                      className="md:col-span-2"
                    />
                  )}
                </div>
              </section>

              {/* Embedding Generation */}
              <section>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Embedding Generation
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <InfoItem 
                    label="Schedule Type" 
                    value={serverStatus?.embedding_schedule.schedule_type ?? '...'} 
                  />
                  <InfoItem 
                    label="Start Hour" 
                    value={serverStatus?.embedding_schedule.start_hour?.toString() ?? '...'} 
                  />
                  <InfoItem 
                    label="Interval" 
                    value={serverStatus?.embedding_schedule.interval_hours ? `${serverStatus.embedding_schedule.interval_hours}h` : '...'} 
                  />
                  <InfoItem 
                    label="Scheduler" 
                    value={serverStatus?.embedding_schedule.scheduler_running ? 'Running' : 'Stopped'} 
                    valueClassName={
                      serverStatus?.embedding_schedule.scheduler_running 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }
                  />
                </div>

                {/* Progress Bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {getProgressStatus()}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {embeddingProgress?.active 
                        ? `${embeddingProgress.percentage.toFixed(1)}%` 
                        : (embeddingProgress?.total ?? 0) > 0 ? '100%' : '0%'}
                    </span>
                  </div>
                  
                  <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${getProgressBarColor()} transition-colors duration-300`}
                      initial={{ width: 0 }}
                      animate={{ 
                        width: embeddingProgress?.active 
                          ? `${embeddingProgress.percentage}%` 
                          : (embeddingProgress?.total ?? 0) > 0 ? '100%' : '0%'
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  {embeddingProgress && (
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {embeddingProgress.active 
                          ? `${embeddingProgress.current.toLocaleString()} / ${embeddingProgress.total.toLocaleString()} images`
                          : embeddingProgress.total > 0
                          ? `${embeddingProgress.total.toLocaleString()} images indexed`
                          : 'No images processed'}
                      </span>
                      {embeddingProgress.active && (
                        <span>
                          Time: {formatTime(embeddingProgress.elapsed_time)}
                        </span>
                      )}
                    </div>
                  )}

                  {embeddingProgress && (embeddingProgress.errors > 0 || embeddingProgress.skipped > 0) && (
                    <div className="flex gap-4 text-xs">
                      {embeddingProgress.errors > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          Errors: {embeddingProgress.errors}
                        </span>
                      )}
                      {embeddingProgress.skipped > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          Skipped: {embeddingProgress.skipped}
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleGenerateEmbeddings}
                    disabled={isGenerating || embeddingProgress?.active}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Starting...
                      </>
                    ) : embeddingProgress?.active ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      'Generate Embeddings'
                    )}
                  </button>
                </div>
              </section>

              {/* Help Section */}
              <section className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Debug Panel Controls
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Press <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-xs">D</kbd> to toggle this panel</li>
                  <li>• Statistics refresh automatically every 5 seconds</li>
                  <li>• Embedding progress updates every 2 seconds</li>
                  <li>• Generate Embeddings: Create vector embeddings for image search</li>
                </ul>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const StatItem = ({ 
  label, 
  value, 
  valueClassName = 'text-gray-900 dark:text-white' 
}: { 
  label: string; 
  value: string | number; 
  valueClassName?: string;
}) => (
  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
    <p className={`text-lg font-semibold ${valueClassName}`}>{value}</p>
  </div>
);

const InfoItem = ({ 
  label, 
  value, 
  valueClassName = 'text-gray-700 dark:text-gray-300',
  className = ''
}: { 
  label: string; 
  value: string; 
  valueClassName?: string;
  className?: string;
}) => (
  <div className={`flex flex-col ${className}`}>
    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</span>
    <span className={`text-sm font-medium ${valueClassName} break-all`}>{value}</span>
  </div>
);

export default DebugModal;
