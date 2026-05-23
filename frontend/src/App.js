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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

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
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    if (socket) socket.close();
    toast.success('Logged out successfully');
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
              element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
            >
              <Route path="feed" element={<Feed user={user} />} />
              <Route index element={<GroupChat user={user} />} />
              <Route path="threads" element={<Threads user={user} />} />
              <Route path="messages" element={<DirectMessages user={user} />} />
              <Route path="assignments" element={<Assignments user={user} />} />
              <Route path="blogs" element={<Blogs user={user} />} />
              {/* Tasks only for admin and core */}
              <Route 
                path="tasks" 
                element={
                  user?.role === 'admin' || user?.role === 'core' 
                    ? <Tasks user={user} /> 
                    : <Navigate to="/" />
                } 
              />
              <Route path="calendar" element={<Calendar user={user} />} />
              <Route path="profile" element={<EditProfile />} />
              {user?.role === 'admin' && (
                <Route path="admin" element={<AdminPanel user={user} />} />
              )}
            </Route>
          </Routes>
          <Toaster position="top-right" richColors />
        </div>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
