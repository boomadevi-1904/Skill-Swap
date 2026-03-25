import React, { useState, useEffect } from "react";
import { api } from "../api";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get("/api/notifications");
      setNotifications(response.data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/api/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read", error);
      toast.error("Failed to update notifications");
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
    if (!notification.read) {
      await markAsRead(notification._id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      await api.delete(`/api/notifications/${id}`);
      toast.success("Notification deleted");
    } catch (error) {
      console.error("Failed to delete notification", error);
      toast.error("Failed to delete notification");
      fetchNotifications();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Notifications</h1>
          <p className="text-gray-500 mt-2">Stay updated with your learning requests and activity</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="text-sm font-bold text-primary hover:underline px-4 py-2 rounded-xl hover:bg-primary/5 transition-all"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card-elevated py-16 text-center">
          <div className="text-6xl mb-4 text-gray-200">🔔</div>
          <h3 className="text-xl font-bold text-gray-800">All caught up!</h3>
          <p className="text-gray-500 mt-2">No notifications found at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification._id}
              onClick={() => handleNotificationClick(notification)}
              className={`group relative card-elevated p-5 flex flex-col gap-4 cursor-pointer transition-all hover:scale-[1.01] ${
                !notification.read ? 'ring-2 ring-primary/20 bg-primary/5' : 'bg-white opacity-80'
              }`}
            >
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl shadow-sm ${getTypeStyles(notification.type)}`}>
                  {getTypeIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-bold text-lg truncate ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className={`text-base leading-relaxed ${!notification.read ? 'text-gray-700' : 'text-gray-500'}`}>
                    {notification.message}
                  </p>
                </div>

                <button
                  onClick={(e) => handleDelete(e, notification._id)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg transition-all"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {notification.actionRequired && (
                <div className="pl-17 flex items-center gap-4">
                  {notification.status === 'pending' ? (
                    <>
                      <button
                        onClick={(e) => handleAction(e, notification, 'accept')}
                        disabled={!!processingId}
                        className={`px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 ${
                          processingId === notification._id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-dark'
                        }`}
                      >
                        {processingId === notification._id ? 'Confirming...' : 'Yes, Completed'}
                      </button>
                      <button
                        onClick={(e) => handleAction(e, notification, 'reject')}
                        disabled={!!processingId}
                        className={`px-6 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl transition-all active:scale-95 ${
                          processingId === notification._id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'
                        }`}
                      >
                        {processingId === notification._id ? 'Rejecting...' : 'No'}
                      </button>
                    </>
                  ) : (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-inner ${
                      notification.status === 'accepted' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {notification.status === 'accepted' ? (
                        <><span>✅</span> Session Completed & Points Awarded</>
                      ) : (
                        <><span>❌</span> Completion Rejected</>
                      )}
                    </div>
                  )}
                </div>
              )}

              {notification.link && !notification.actionRequired && (
                <div className="pl-17">
                  <div className="inline-flex items-center text-sm font-bold text-primary group-hover:underline">
                    View Details →
                  </div>
                </div>
              )}

              {!notification.read && (
                <div className="absolute top-1/2 -right-1 transform -translate-y-1/2 w-1.5 h-10 bg-primary rounded-l-full shadow-lg"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
