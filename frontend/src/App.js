import React, { useState, useEffect, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import '@/App.css';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import Feed from './pages/Feed';
import GroupChat from './pages/GroupChat';
import Threads from './pages/Threads';
import DirectMessages from './pages/DirectMessages';
import Assignments from './pages/Assignments';
import Blogs from './pages/Blogs';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import EditProfile from './pages/EditProfile';
import AdminPanel from './pages/AdminPanel';
import NotificationsPage from './pages/NotificationsPage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '946733501616-m6a2vmmg9l1ejs185d6a0hqr8ds0bi1m.apps.googleusercontent.com';

import { DEFAULT_PERMISSIONS } from '@/constants/permissions';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md w-full shadow-xs">
            <h2 className="text-lg font-bold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-red-600 mb-5">
              An unexpected error occurred while rendering this page.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function GlobalNotifications({ user, onUpdateUser }) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !user) return;

    const showPushNotification = (title, body) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/images/logo.jpg',
          tag: 'medvigyaan-notif'
        });
      }
    };

    const handleNewThread = (thread) => {
      toast.info('New discussion thread created');
      showPushNotification('New Thread', `${thread.author_name} started: ${thread.title}`);
    };

    const handleNewReply = (reply) => {
      toast.info('New reply posted');
      showPushNotification('New Reply', `${reply.author_name} replied to a thread`);
    };

    const handleNewMessage = (message) => {
      toast.info(`New message from ${message.sender_name}`);
      showPushNotification('New DM', `${message.sender_name}: ${message.content?.substring(0, 50) || 'sent a message'}`);
    };

    const handleNewTask = (task) => {
      toast.info('New task created');
      showPushNotification('New Task', `Task assigned: ${task.title}`);
    };

    const handleNewGroupMessage = (message) => {
      if (message.sender_id !== user.id) {
        toast.info(`${message.sender_name}: ${message.content.substring(0, 50)}...`);
        showPushNotification('General Chat', `${message.sender_name}: ${message.content.substring(0, 50)}`);
      }
    };

    const handleNewAnnouncement = (announcement) => {
      toast.info('New announcement posted');
      showPushNotification('New Announcement', announcement.title);
    };

    const handleMention = (data) => {
      toast.info(`${data.by} mentioned you`);
      showPushNotification('You were mentioned', `${data.by} mentioned you in ${data.context}`);
    };

    const handleCalendarEvent = (event) => {
      toast.info(`Event today: ${event.title}`);
      showPushNotification('Calendar Event', `Today: ${event.title}`);
    };

    const handleUserProfileUpdated = (data) => {
      if (data?.user_id === user?.id && data?.user) {
        onUpdateUser(data.user);
      }
    };

    const handleNewMessageRequest = (req) => {
      if (req?.receiver_id === user?.id || (req?.receiver_email && req.receiver_email.toLowerCase() === user?.email?.toLowerCase())) {
        toast.info(`New message request from ${req.sender_name}`);
        showPushNotification('Message Request', `${req.sender_name}: ${req.initial_content?.substring(0, 50) || 'sent a request'}`);
      }
    };

    socket.on('new_thread', handleNewThread);
    socket.on('new_reply', handleNewReply);
    socket.on('new_message', handleNewMessage);
    socket.on('new_message_request', handleNewMessageRequest);
    socket.on('new_task', handleNewTask);
    socket.on('new_group_message', handleNewGroupMessage);
    socket.on('new_announcement', handleNewAnnouncement);
    socket.on('mention', handleMention);
    socket.on('calendar_event', handleCalendarEvent);
    socket.on('user_profile_updated', handleUserProfileUpdated);

    return () => {
      socket.off('new_thread', handleNewThread);
      socket.off('new_reply', handleNewReply);
      socket.off('new_message', handleNewMessage);
      socket.off('new_message_request', handleNewMessageRequest);
      socket.off('new_task', handleNewTask);
      socket.off('new_group_message', handleNewGroupMessage);
      socket.off('new_announcement', handleNewAnnouncement);
      socket.off('mention', handleMention);
      socket.off('calendar_event', handleCalendarEvent);
      socket.off('user_profile_updated', handleUserProfileUpdated);
    };
  }, [socket, user?.id, onUpdateUser]);

  return null;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_PERMISSIONS);

  const fetchRolePermissions = async () => {
    try {
      const res = await axios.get(`${API}/admin/role-permissions`);
      if (res.data && Object.keys(res.data).length > 0) {
        setRolePermissions(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch role permissions, using defaults');
    }
  };

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .catch(err => console.log('Service worker registration failed:', err));
    }

    // Axios 401 response interceptor
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          const url = error.config?.url || '';
          if (!url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/google') && !url.includes('/auth/bypass')) {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
            toast.error('Session expired. Please log in again.');
          }
        }
        return Promise.reject(error);
      }
    );

    // Check existing token
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
      fetchRolePermissions();
    } else {
      setLoading(false);
    }

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    fetchRolePermissions();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Logged out successfully');
  };

  const hasPageAccess = (pageId) => {
    if (!user) return false;
    const role = user.role || 'member';
    const permissions = rolePermissions?.[role] || DEFAULT_PERMISSIONS[role];
    return permissions?.pages?.includes(pageId) || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Role-based route protection
  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!user) return <Navigate to="/login" />;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/" />;
    }
    return children;
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <SocketProvider user={user} backendUrl={BACKEND_URL}>
        <GlobalNotifications user={user} onUpdateUser={(updated) => setUser(prev => ({ ...prev, ...updated }))} />
        <BrowserRouter>
          <ErrorBoundary>
            <div className="App">
              <Routes>
                <Route
                  path="/login"
                  element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />}
                />
                <Route
                  path="/register"
                  element={!user ? <RegisterPage onLogin={handleLogin} /> : <Navigate to="/" />}
                />
                <Route
                  path="/"
                  element={user ? <Dashboard user={user} rolePermissions={rolePermissions} onLogout={handleLogout} /> : <Navigate to="/login" />}
                >
                  <Route path="feed" element={hasPageAccess('feed') ? <Feed user={user} /> : <Navigate to="/" />} />
                  <Route index element={hasPageAccess('chat') ? <GroupChat user={user} /> : <Navigate to="/feed" />} />
                  <Route path="threads" element={hasPageAccess('threads') ? <Threads user={user} /> : <Navigate to="/" />} />
                  <Route path="messages" element={hasPageAccess('messages') ? <DirectMessages user={user} /> : <Navigate to="/" />} />
                  <Route path="assignments" element={hasPageAccess('assignments') ? <Assignments user={user} /> : <Navigate to="/" />} />
                  <Route path="blogs" element={hasPageAccess('blogs') ? <Blogs user={user} /> : <Navigate to="/" />} />
                  <Route 
                    path="tasks" 
                    element={
                      hasPageAccess('tasks') 
                        ? <Tasks user={user} /> 
                        : <Navigate to="/" />
                    } 
                  />
                  <Route path="calendar" element={hasPageAccess('calendar') ? <Calendar user={user} /> : <Navigate to="/" />} />
                  <Route path="profile" element={<EditProfile onUpdateUser={(updated) => setUser(prev => ({ ...prev, ...updated }))} />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route 
                    path="admin" 
                    element={
                      hasPageAccess('admin') 
                        ? <AdminPanel user={user} /> 
                        : <Navigate to="/" />
                    } 
                  />
                </Route>
              </Routes>
              <Toaster position="top-right" richColors />
            </div>
          </ErrorBoundary>
        </BrowserRouter>
      </SocketProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
