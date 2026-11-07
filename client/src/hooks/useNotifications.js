import { useCallback, useEffect, useState } from 'react';
import { notificationApi } from '../api/notificationApi.js';

export default function useNotifications(token, user) {
  const [notifications, setNotifications] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  const loadNotifications = useCallback(async () => {
    if (!token) return;

    setIsLoadingNotifications(true);
    setNotificationsError('');
    try {
      const data = await notificationApi.list(token);
      setNotifications(data.notifications || []);
    } catch (error) {
      setNotificationsError(error.message);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) loadNotifications();
    else setNotifications([]);
  }, [user, token, loadNotifications]);

  const receiveNotification = useCallback((notification) => {
    if (!notification) return;
    setNotifications((current) => [
      notification,
      ...current.filter((item) => item.id !== notification.id)
    ].slice(0, 50));
  }, []);

  const markNotificationRead = useCallback(async (notificationId) => {
    setNotifications((current) => current.map((item) =>
      item.id === notificationId ? { ...item, isRead: 1 } : item
    ));
    try {
      await notificationApi.markRead(notificationId, token);
    } catch (error) {
      setNotificationsError(error.message);
      loadNotifications();
    }
  }, [token, loadNotifications]);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: 1 })));
    try {
      await notificationApi.markAllRead(token);
    } catch (error) {
      setNotificationsError(error.message);
      loadNotifications();
    }
  }, [token, loadNotifications]);

  return {
    notifications,
    unreadNotificationsCount: notifications.filter((item) => !item.isRead).length,
    isLoadingNotifications,
    notificationsError,
    receiveNotification,
    markNotificationRead,
    markAllNotificationsRead
  };
}
