import { useState, useCallback } from 'react';
import { config } from '../config/env';

export interface Notification {
  id: number;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const maxNotifications = config.maxNotifications;
  const defaultDuration = config.notificationDuration;

  const addNotification = useCallback((
    type: Notification['type'],
    title: string,
    message: string,
    options: { duration?: number; persistent?: boolean } = {}
  ) => {
    const { duration = defaultDuration, persistent = false } = options;
    const id = Date.now() + Math.random();

    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
    };

    setNotifications(prev => {
      let updated = [...prev, notification];
      if (updated.length > maxNotifications) {
        updated = updated.slice(-maxNotifications);
      }
      return updated;
    });

    // Log to console
    const logMessage = `${title}: ${message}`;
    switch (type) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warning':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'success':
        console.log(logMessage);
        break;
    }

    // Auto-remove if not persistent
    if (!persistent && duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showError = useCallback((title: string, message: string, options = {}) => {
    return addNotification('error', title, message, options);
  }, [addNotification]);

  const showWarning = useCallback((title: string, message: string, options = {}) => {
    return addNotification('warning', title, message, options);
  }, [addNotification]);

  const showSuccess = useCallback((title: string, message: string, options = {}) => {
    return addNotification('success', title, message, options);
  }, [addNotification]);

  const showInfo = useCallback((title: string, message: string, options = {}) => {
    return addNotification('info', title, message, options);
  }, [addNotification]);

  return {
    notifications,
    showError,
    showWarning,
    showSuccess,
    showInfo,
    removeNotification,
    clearAllNotifications,
  };
};