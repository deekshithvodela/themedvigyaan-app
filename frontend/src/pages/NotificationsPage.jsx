import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, ArrowLeft, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { onNotificationsUpdated } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/notifications`);
      setNotifications(res.data);
      onNotificationsUpdated?.();
    } catch (error) {
      console.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      onNotificationsUpdated?.();
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (error) {
      console.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/mark-all-read`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onNotificationsUpdated?.();
      window.dispatchEvent(new CustomEvent('notifications_updated'));
      toast.success('All marked as read');
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-testid="notifications-page">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            aria-label="Mark all notifications as read"
            className="flex items-center gap-1.5 min-h-[40px]"
            data-testid="mark-all-read-btn"
          >
            <CheckCheck className="w-4 h-4" />
            <span className="text-xs">Mark all read</span>
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">No notifications yet</p>
            <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                markAsRead(notif.id);
                if (notif.link) navigate(notif.link);
              }}
              className={`p-4 rounded-xl cursor-pointer transition-all border ${
                notif.read
                  ? 'bg-white border-slate-200 hover:bg-slate-50'
                  : 'bg-blue-50/70 border-blue-200 shadow-sm hover:bg-blue-50'
              }`}
              data-testid={`notification-item-${notif.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">{notif.title}</p>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{notif.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
