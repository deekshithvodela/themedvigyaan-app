import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, FileText, BookOpen, ListTodo, Calendar, Settings, LogOut, Bell, Menu, X, Search, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEFAULT_PERMISSIONS = {
  member: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'messages'],
  },
  core: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'tasks', 'messages'],
  },
  admin: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'tasks', 'messages', 'admin'],
  }
};

const Dashboard = ({ user, rolePermissions, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadDMCount, setUnreadDMCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [linkConfig, setLinkConfig] = useState({ url: '', label: 'External Link' });

  // Role-based navigation items
  const getNavItems = () => {
    const role = user?.role || 'member';
    const permissions = rolePermissions?.[role] || DEFAULT_PERMISSIONS[role];
    const allowedPages = permissions?.pages || [];

    const allItems = [
      { id: 'feed', path: '/feed', icon: Bell, label: 'Feed', exact: false },
      { id: 'chat', path: '/', icon: MessageSquare, label: 'General Chat', exact: true },
      { id: 'threads', path: '/threads', icon: MessageSquare, label: 'Threads' },
      { id: 'assignments', path: '/assignments', icon: FileText, label: 'Assignments' },
      { id: 'blogs', path: '/blogs', icon: BookOpen, label: 'Blogs' },
      { id: 'calendar', path: '/calendar', icon: Calendar, label: 'Calendar' },
      { id: 'tasks', path: '/tasks', icon: ListTodo, label: 'Tasks' },
      { id: 'admin', path: '/admin', icon: Settings, label: 'Admin Panel' }
    ];

    return allItems.filter(item => allowedPages.includes(item.id));
  };

  const navItems = getNavItems();

  useEffect(() => {
    fetchNotifications();
    fetchLinkConfig();
    fetchUnreadDMs();
    requestNotificationPermission();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadDMs();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const showPushNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'https://customer-assets.emergentagent.com/job_teamchat-portal/artifacts/r1igb56v_logoo.jpg',
        tag: 'medvigyaan-dm'
      });
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/notifications`);
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications');
    }
  };

  const fetchUnreadDMs = async () => {
    try {
      const res = await axios.get(`${API}/messages/unread-count`);
      const prevCount = unreadDMCount;
      const newCount = res.data.count;
      setUnreadDMCount(newCount);
      
      // Show push notification if new messages arrived
      if (newCount > prevCount && prevCount > 0) {
        showPushNotification('New Message', 'You have new direct messages');
      }
    } catch (error) {
      console.error('Failed to fetch unread DMs');
    }
  };

  const fetchLinkConfig = async () => {
    try {
      const res = await axios.get(`${API}/link-config`);
      setLinkConfig(res.data);
    } catch (error) {
      console.error('Failed to fetch link config');
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`);
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/mark-all-read`);
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  // Sidebar Content Component
  const SidebarContent = () => (
    <>
      {/* Logo Section */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <img
            src="https://customer-assets.emergentagent.com/job_teamchat-portal/artifacts/r1igb56v_logoo.jpg"
            alt="MedVigyaan"
            className="w-10 h-10 rounded-lg"
          />
          <div>
            <h1 className="font-bold text-sm">The MedVigyaan</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2" data-testid="sidebar-navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}

          {/* External Link - at the end */}
          {linkConfig.url && (
            <a
              href={linkConfig.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-slate-300 hover:bg-slate-700 hover:text-white"
              data-testid="nav-external-link"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="text-sm font-medium">{linkConfig.label || 'External Link'}</span>
            </a>
          )}
        </nav>
      </ScrollArea>

      {/* User Profile Section */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
             onClick={() => {
               navigate('/profile');
               setSidebarOpen(false);
             }}>
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.picture} alt={user.name} />
            <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {user.role === 'core' ? 'Core' : user.role}
              </Badge>
              {user.department && (
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-500">
                  {user.department}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-100" data-testid="dashboard-container">
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden lg:flex w-64 bg-slate-800 text-white flex-col">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar - Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-slate-800 text-white border-slate-700">
          <div className="flex flex-col h-full">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-button"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Mobile Logo/Title */}
            <div className="flex items-center gap-2 lg:hidden">
              <img
                src="https://customer-assets.emergentagent.com/job_teamchat-portal/artifacts/r1igb56v_logoo.jpg"
                alt="MedVigyaan"
                className="w-7 h-7 rounded-lg object-cover"
              />
              <span className="font-bold text-sm text-slate-800">MedVigyaan</span>
            </div>
          </div>

          {/* Spacer for desktop */}
          <div className="hidden lg:block flex-1"></div>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSearch(!showSearch)}
                data-testid="search-button"
              >
                <Search className="w-5 h-5" />
              </Button>
              {showSearch && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50">
                  <Input
                    type="text"
                    placeholder="Search this page..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    data-testid="search-input"
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Direct Messages Button */}
            {((rolePermissions?.[user?.role || 'member'] || DEFAULT_PERMISSIONS[user?.role || 'member'])?.pages?.includes('messages')) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigate('/messages');
                  setUnreadDMCount(0);
                }}
                data-testid="dm-button"
                className="relative"
              >
                <Mail className="w-5 h-5" />
                {unreadDMCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 animate-pulse" />
                )}
              </Button>
            )}
            
            {/* Notification Bell */}
            <Popover open={showNotifications} onOpenChange={setShowNotifications}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={markAllAsRead} data-testid="mark-all-read">
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">No notifications</p>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              notif.read ? 'bg-slate-50' : 'bg-blue-50 border border-blue-200'
                            }`}
                            onClick={() => {
                              markAsRead(notif.id);
                              if (notif.link) navigate(notif.link);
                              setShowNotifications(false);
                            }}
                            data-testid={`notification-${notif.id}`}
                          >
                            <p className="text-sm font-medium text-gray-800">{notif.title}</p>
                            <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet context={{ searchQuery }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
