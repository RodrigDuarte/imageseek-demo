import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Notification } from '../hooks/useNotifications';

interface NotificationsProps {
  notifications: Notification[];
  onRemove: (id: number) => void;
}

const getNotificationIcon = (type: Notification['type']) => {
  const icons = {
    error: '⚠',
    warning: '⚠',
    success: '✓',
    info: 'ℹ',
  };
  return icons[type] || 'ℹ';
};

const Notifications: React.FC<NotificationsProps> = ({ notifications, onRemove }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ 
              duration: 0.3,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className={`
              max-w-sm bg-white dark:bg-gray-800 rounded-e-md shadow-lg border-l-4
              ${notification.type === 'error' ? 'border-red-500' : ''}
              ${notification.type === 'warning' ? 'border-yellow-500' : ''}
              ${notification.type === 'success' ? 'border-green-500' : ''}
              ${notification.type === 'info' ? 'border-blue-500' : ''}
            `}
          >
            <div className="p-4 flex items-start space-x-3">
              <div className="flex-shrink-0 text-lg">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {notification.title}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {notification.message}
                </div>
              </div>
              <button
                onClick={() => onRemove(notification.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Close"
              >
                ×
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;