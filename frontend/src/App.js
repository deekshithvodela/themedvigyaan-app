import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import io from 'socket.io-client';
import axios from 'axios';
import '@/App.css';
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const GOOGLE_CLIENT_ID = '946733501616-m6a2vmmg9l1ejs185d6a0hqr8ds0bi1m.apps.googleusercontent.com';

// Default role permissions
const DEFAULT_PERMISSIONS = {
  member: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'messages'],
    actions: {
      feed: ['view'],
      chat: ['view', 'create', 'delete_own'],
      threads: ['view', 'create', 'delete_own'],
      assignments: ['view', 'submit'],
      blogs: ['view'],
      calendar: ['view'],
      tasks: [],
      messages: ['view', 'create', 'delete_own']
    }
  },
  core: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'tasks', 'messages'],
    actions: {
      feed: ['view', 'create', 'delete_own'],
      chat: ['view', 'create', 'delete_own'],
      threads: ['view', 'create', 'delete_own'],
      assignments: ['view', 'create', 'submit'],
      blogs: ['view', 'create', 'delete_own'],
      calendar: ['view', 'create', 'delete_own'],
      tasks: ['view', 'create', 'edit', 'delete_own'],
      messages: ['view', 'create', 'delete_own']
    }
  },
  admin: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'tasks', 'messages', 'admin'],
    actions: {
      feed: ['view', 'create', 'delete_any'],
      chat: ['view', 'create', 'delete_any'],
      threads: ['view', 'create', 'delete_any'],
      assignments: ['view', 'create', 'submit', 'delete_any'],
      blogs: ['view', 'create', 'edit', 'delete_any'],
      calendar: ['view', 'create', 'edit', 'delete_any'],
      tasks: ['view', 'create', 'edit', 'delete_any'],
      messages: ['view', 'create', 'delete_any'],
      admin: ['full_access']
    }
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
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

    // Check existing token
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
      fetchRolePermissions();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Initialize Socket.IO
      const newSocket = io(BACKEND_URL, {
        transports: ['websocket', 'polling']
      });
      
      newSocket.on('connect', () => {
        console.log('Socket connected');
        newSocket.emit('join_room', { user_id: user.id });
      });

      // Helper for push notifications
      const showPushNotification = (title, body) => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: 'https://customer-assets.emergentagent.com/job_teamchat-portal/artifacts/r1igb56v_logoo.jpg',
            tag: 'medvigyaan-notif'
          });
        }
      };

      newSocket.on('new_thread', (thread) => {
        toast.info('New discussion thread created');
        showPushNotification('New Thread', `${thread.author_name} started: ${thread.title}`);
      });

      newSocket.on('new_reply', (reply) => {
        toast.info('New reply posted');
        showPushNotification('New Reply', `${reply.author_name} replied to a thread`);
      });

      newSocket.on('new_message', (message) => {
        toast.info(`New message from ${message.sender_name}`);
        showPushNotification('New DM', `${message.sender_name}: ${message.content?.substring(0, 50) || 'sent a message'}`);
      });

      newSocket.on('new_task', (task) => {
        toast.info('New task created');
        showPushNotification('New Task', `Task assigned: ${task.title}`);
      });

      newSocket.on('new_group_message', (message) => {
        if (message.sender_id !== user.id) {
          toast.info(`${message.sender_name}: ${message.content.substring(0, 50)}...`);
          showPushNotification('General Chat', `${message.sender_name}: ${message.content.substring(0, 50)}`);
        }
      });

      newSocket.on('new_announcement', (announcement) => {
        toast.info('New announcement posted');
        showPushNotification('New Announcement', announcement.title);
      });

      newSocket.on('mention', (data) => {
        toast.info(`${data.by} mentioned you`);
        showPushNotification('You were mentioned', `${data.by} mentioned you in ${data.context}`);
      });

      newSocket.on('calendar_event', (event) => {
        toast.info(`Event today: ${event.title}`);
        showPushNotification('Calendar Event', `Today: ${event.title}`);
      });

      setSocket(newSocket);

      return () => newSocket.close();
    }
  }, [user]);

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
    if (socket) socket.close();
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
      <BrowserRouter>
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
              <Route path="profile" element={<EditProfile />} />
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
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
