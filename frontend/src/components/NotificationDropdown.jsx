import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function NotificationDropdown({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/api/notifications');
      setNotifications(data.slice(0, 5)); // Only show top 5 in dropdown
      const unread = data.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { data } = await api.get('/api/notifications/unread-count');
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Failed to fetch unread count', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    
    // Refresh unread count every minute
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!isOpen) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
    setIsOpen(!isOpen);
  };

  const markAsRead = async (notification) => {
    if (notification.read) return;
    try {
      await api.patch(`/api/notifications/${notification._id}/read`);
      setNotifications(prev => 
        prev.map(n => n._id === notification._id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const handleAction = async (e, notification, action) => {
    e.stopPropagation();
    if (processingId) return;
    
    setProcessingId(notification._id);
    const loadingToast = toast.loading(`${action === 'accept' ? 'Confirming' : 'Rejecting'} completion...`);
    
    try {
      const { data } = await api.put(`/api/notifications/${notification._id}/${action}`);
      setNotifications(prev => 
        prev.map(n => n._id === notification._id ? data : n)
      );
      
      toast.success(
        action === 'accept' 
          ? 'Session confirmed! Points awarded to mentor.' 
          : 'Completion request rejected.',
        { id: loadingToast }
      );
    } catch (error) {
      console.error(`Failed to ${action} notification`, error);
      toast.error(error.response?.data?.error || "Action failed", { id: loadingToast });
    } finally {
      setProcessingId(null);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (notification.actionRequired && notification.status === 'pending') {
      return;
    }
    await markAsRead(notification);
    setIsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read', error);
      toast.error('Failed to update notifications');
    }
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-600';
      case 'warning': return 'bg-yellow-100 text-yellow-600';
      case 'error': return 'bg-red-100 text-red-600';
      case 'request': return 'bg-blue-100 text-blue-600';
      case 'completion_request': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'request': return '📅';
      case 'completion_request': return '🏁';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none"
      >
        <span className="text-2xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary font-semibold hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No new notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors flex flex-col gap-2 ${
                      !n.read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeStyles(n.type)}`}>
                        {getTypeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>
                          {n.title}
                        </p>
                        <p className={`text-xs mt-1 line-clamp-2 ${!n.read ? 'text-gray-700' : 'text-gray-500'}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      )}
                    </div>

                    {n.actionRequired && (
                      <div className="mt-2 pl-13">
                        {n.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleAction(e, n, 'accept')}
                              disabled={!!processingId}
                              className={`flex-1 py-1.5 px-3 bg-primary text-white text-xs font-bold rounded-lg transition-colors ${
                                processingId === n._id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-dark'
                              }`}
                            >
                              {processingId === n._id ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={(e) => handleAction(e, n, 'reject')}
                              disabled={!!processingId}
                              className={`flex-1 py-1.5 px-3 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg transition-colors ${
                                processingId === n._id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'
                              }`}
                            >
                              {processingId === n._id ? '...' : 'No'}
                            </button>
                          </div>
                        ) : (
                          <div className={`text-xs font-bold py-1 px-2 rounded-md inline-block ${
                            n.status === 'accepted' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {n.status === 'accepted' ? 'Completed ✅' : 'Rejected ❌'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <NavLink
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="block p-3 text-center text-sm font-bold text-primary bg-gray-50 hover:bg-gray-100 border-t border-gray-100 transition-colors"
          >
            View all notifications
          </NavLink>
        </div>
      )}
    </div>
  );
}
