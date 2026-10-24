import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Settings, Users, Mail, BookOpen, Calendar, Edit, Trash2, Eye, EyeOff, Plus, Key, ExternalLink, Save, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

import { DEFAULT_PERMISSIONS, ALL_PAGES, ALL_ACTIONS } from '@/constants/permissions';
import { useSocket } from '@/context/SocketContext';

const AdminPanel = ({ user }) => {
  const socket = useSocket();
  const [users, setUsers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [calendarConfig, setCalendarConfig] = useState(null);
  const [whitelistedEmails, setWhitelistedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [editingBlog, setEditingBlog] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState({});
  const [linkConfig, setLinkConfig] = useState({ url: '', label: 'External Link' });
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_PERMISSIONS);
  const [selectedRole, setSelectedRole] = useState('member');

  useEffect(() => {
    fetchUsers();
    fetchBlogs();
    fetchCalendarConfig();
    fetchWhitelistedEmails();
    fetchIntegrations();
    fetchLinkConfig();
    fetchRolePermissions();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleProfileUpdate = (data) => {
      if (data?.user) {
        setUsers(prev => prev.map(u => u.id === data.user_id ? { ...u, ...data.user } : u));
      }
    };
    socket.on('user_profile_updated', handleProfileUpdate);
    return () => socket.off('user_profile_updated', handleProfileUpdate);
  }, [socket]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const fetchBlogs = async () => {
    try {
      const res = await axios.get(`${API}/admin/blogs`);
      setBlogs(res.data);
    } catch (error) {
      toast.error('Failed to fetch blogs');
    }
  };

  const fetchCalendarConfig = async () => {
    try {
      const res = await axios.get(`${API}/calendar/config`);
      setCalendarConfig(res.data);
    } catch (error) {
      console.error('Failed to fetch calendar config:', error);
    }
  };

  const fetchWhitelistedEmails = async () => {
    try {
      const res = await axios.get(`${API}/admin/whitelist`);
      setWhitelistedEmails(res.data);
    } catch (error) {
      toast.error('Failed to fetch whitelisted emails');
    }
  };

  const fetchIntegrations = async () => {
    try {
      const res = await axios.get(`${API}/admin/integrations`);
      setIntegrations(res.data);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
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

  const fetchRolePermissions = async () => {
    try {
      const res = await axios.get(`${API}/admin/role-permissions`);
      if (res.data && Object.keys(res.data).length > 0) {
        setRolePermissions(res.data);
      }
    } catch (error) {
      console.error('Using default permissions');
    }
  };

  const addWhitelistedEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter an email');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/admin/whitelist`, { email: newEmail });
      await fetchWhitelistedEmails();
      setNewEmail('');
      toast.success('Email added to whitelist');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add email');
    } finally {
      setLoading(false);
    }
  };

  const removeWhitelistedEmail = async (email) => {
    try {
      await axios.delete(`${API}/admin/whitelist/${encodeURIComponent(email)}`);
      await fetchWhitelistedEmails();
      toast.success('Email removed from whitelist');
    } catch (error) {
      toast.error('Failed to remove email');
    }
  };

  const updateUserRole = async (userId, role) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, { role });
      await fetchUsers();
      toast.success('Role updated!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleAdminUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await axios.put(`${API}/users/${editingUser.id}/profile`, {
        name: editingUser.name,
        department: editingUser.department,
        phone: editingUser.phone,
        bio: editingUser.bio,
        role: editingUser.role
      });
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...res.data.user } : u));
      toast.success('User profile updated successfully!');
      setEditingUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user profile');
    }
  };

  const updateBlog = async (blogId, data) => {
    try {
      await axios.put(`${API}/admin/blogs/${blogId}`, data);
      await fetchBlogs();
      toast.success('Blog updated!');
      setEditingBlog(null);
    } catch (error) {
      toast.error('Failed to update blog');
    }
  };

  const toggleBlogPublish = async (blogId, published) => {
    try {
      await axios.put(`${API}/admin/blogs/${blogId}/publish`, { published });
      await fetchBlogs();
      toast.success(`Blog ${published ? 'published' : 'unpublished'}!`);
    } catch (error) {
      toast.error('Failed to update blog status');
    }
  };

  const deleteBlog = async (blogId) => {
    try {
      await axios.delete(`${API}/blogs/${blogId}`);
      await fetchBlogs();
      toast.success('Blog deleted!');
    } catch (error) {
      toast.error('Failed to delete blog');
    }
  };

  const updateCalendarConfig = async (calendars) => {
    try {
      await axios.put(`${API}/calendar/config`, { calendar_ids: calendars });
      await fetchCalendarConfig();
      toast.success('Calendar config updated!');
    } catch (error) {
      toast.error('Failed to update calendar config');
    }
  };

  const addCalendar = () => {
    if (!calendarConfig) return;
    if (calendarConfig.calendar_ids.length >= 3) {
      toast.error('Maximum 3 calendars allowed');
      return;
    }
    
    const newCalendar = {
      id: '',
      label: 'New Calendar',
      color: '#2e7d96',
      enabled: true
    };
    
    updateCalendarConfig([...calendarConfig.calendar_ids, newCalendar]);
  };

  const updateCalendar = (index, field, value) => {
    if (!calendarConfig) return;
    const updated = [...calendarConfig.calendar_ids];
    updated[index] = { ...updated[index], [field]: value };
    setCalendarConfig({ ...calendarConfig, calendar_ids: updated });
  };

  const removeCalendar = (index) => {
    if (!calendarConfig) return;
    const updated = calendarConfig.calendar_ids.filter((_, i) => i !== index);
    updateCalendarConfig(updated);
  };

  const saveCalendarConfig = () => {
    if (!calendarConfig) return;
    updateCalendarConfig(calendarConfig.calendar_ids);
  };

  const saveIntegrations = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/admin/integrations`, integrations);
      toast.success('Integrations saved! Restart may be required for some changes.');
    } catch (error) {
      toast.error('Failed to save integrations');
    } finally {
      setLoading(false);
    }
  };

  const saveLinkConfig = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/link-config`, linkConfig);
      toast.success('Link configuration saved!');
    } catch (error) {
      toast.error('Failed to save link configuration');
    } finally {
      setLoading(false);
    }
  };

  const togglePageAccess = (role, pageId) => {
    const current = rolePermissions[role]?.pages || [];
    const updated = current.includes(pageId)
      ? current.filter(p => p !== pageId)
      : [...current, pageId];
    
    setRolePermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], pages: updated }
    }));
  };

  const toggleAction = (role, pageId, actionId) => {
    const current = rolePermissions[role]?.actions?.[pageId] || [];
    const updated = current.includes(actionId)
      ? current.filter(a => a !== actionId)
      : [...current, actionId];
    
    setRolePermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        actions: { ...prev[role]?.actions, [pageId]: updated }
      }
    }));
  };

  const saveRolePermissions = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/admin/role-permissions`, rolePermissions);
      toast.success('Role permissions saved!');
    } catch (error) {
      toast.error('Failed to save role permissions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-panel-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
        <p className="text-gray-600 text-sm mt-1">Manage users, roles, blogs, calendar, and integrations</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="flex overflow-x-auto no-scrollbar justify-start sm:justify-center h-auto gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
          <TabsTrigger value="users" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[40px]" data-testid="users-tab">
            <Users className="w-4 h-4 mr-1.5" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[40px]" data-testid="roles-tab">
            <Shield className="w-4 h-4 mr-1.5" />
            <span>Roles</span>
          </TabsTrigger>
          <TabsTrigger value="whitelist" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[40px]" data-testid="whitelist-tab">
            <Mail className="w-4 h-4 mr-1.5" />
            <span>Whitelist</span>
          </TabsTrigger>
          <TabsTrigger value="blogs" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[40px]" data-testid="blogs-tab">
            <BookOpen className="w-4 h-4 mr-1.5" />
            <span>Blogs</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[40px]" data-testid="calendar-tab">
            <Calendar className="w-4 h-4 mr-1.5" />
            <span>Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[40px]" data-testid="integrations-tab">
            <Key className="w-4 h-4 mr-1.5" />
            <span>APIs</span>
          </TabsTrigger>
          <TabsTrigger value="links" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[40px]" data-testid="links-tab">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            <span>Links</span>
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="task-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department / User Tag</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} data-testid={`user-row-${u.id}`}>
                      <td className="font-medium">{u.name}</td>
                      <td className="text-sm text-gray-600">{u.email}</td>
                      <td>
                        {u.is_main_admin ? (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs font-semibold"
                            data-testid={`role-locked-${u.id}`}
                            title="Primary Administrator (Configured via FIRST_ADMIN_EMAIL)"
                          >
                            <Shield className="w-3.5 h-3.5 text-amber-600" />
                            <span>Admin (Primary)</span>
                          </div>
                        ) : (
                          <Select value={u.role} onValueChange={(value) => updateUserRole(u.id, value)}>
                            <SelectTrigger className="w-28" data-testid={`role-select-${u.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="core">Core</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td>
                        {u.department ? (
                          <Badge variant="outline" className="text-xs font-semibold text-slate-700 border-slate-300 bg-slate-50">
                            {u.department}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No tag</span>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser({ ...u })}
                          className="h-8 text-xs flex items-center gap-1"
                          data-testid={`edit-user-${u.id}`}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-slate-100 p-2">
              {users.map((u) => (
                <div key={u.id} className="p-3 space-y-2.5 bg-white rounded-lg border border-slate-100 my-1.5 shadow-2xs" data-testid={`mobile-user-card-${u.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUser({ ...u })}
                      className="h-7 text-xs px-2.5 flex items-center gap-1 shrink-0"
                      data-testid={`mobile-edit-user-${u.id}`}
                    >
                      <Edit className="w-3 h-3" />
                      <span>Edit</span>
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
                    <div>
                      {u.is_main_admin ? (
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-[11px] font-semibold"
                          data-testid={`mobile-role-locked-${u.id}`}
                        >
                          <Shield className="w-3 h-3 text-amber-600" />
                          <span>Admin (Primary)</span>
                        </div>
                      ) : (
                        <Select value={u.role} onValueChange={(value) => updateUserRole(u.id, value)}>
                          <SelectTrigger className="w-28 h-7 text-xs" data-testid={`mobile-role-select-${u.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="core">Core</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div>
                      {u.department ? (
                        <Badge variant="outline" className="text-[11px] font-semibold text-slate-700 border-slate-300 bg-slate-50">
                          {u.department}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-[11px] italic">No tag</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Edit User Modal */}
          {editingUser && (
            <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
              <DialogContent className="max-w-md" data-testid="edit-user-dialog">
                <DialogHeader>
                  <DialogTitle>Edit User Profile & Tags</DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Modify user details, role assignments, and member tags.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAdminUpdateUser} className="space-y-4">
                  <div>
                    <Label htmlFor="admin-user-email">Email (Account ID)</Label>
                    <Input
                      id="admin-user-email"
                      value={editingUser.email}
                      disabled
                      className="bg-slate-100 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-user-name">Full Name</Label>
                    <Input
                      id="admin-user-name"
                      value={editingUser.name || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-user-dept">Department / User Tag</Label>
                    <Input
                      id="admin-user-dept"
                      placeholder="e.g. Cardiology, Neurology, Research"
                      value={editingUser.department || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, department: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">This appears as the user tag badge in the sidebar and across the app.</p>
                  </div>
                  <div>
                    <Label htmlFor="admin-user-phone">Phone Number</Label>
                    <Input
                      id="admin-user-phone"
                      placeholder="+91 1234567890"
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-user-bio">Bio</Label>
                    <Textarea
                      id="admin-user-bio"
                      placeholder="User bio..."
                      value={editingUser.bio || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, bio: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-user-role">Role</Label>
                    {editingUser.is_main_admin ? (
                      <div className="mt-1.5 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                        <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>Role locked for Primary Admin (configured via system environment)</span>
                      </div>
                    ) : (
                      <Select
                        value={editingUser.role}
                        onValueChange={(val) => setEditingUser(prev => ({ ...prev, role: val }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="core">Core</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Save Changes
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        {/* Role Permissions Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Role Permissions</h3>
            <p className="text-sm text-gray-600 mb-6">
              Configure which pages each role can access and what actions they can perform.
            </p>

            <div className="mb-4">
              <Label>Select Role to Configure</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-48 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="core">Core</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Page Access</h4>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ALL_PAGES.map(page => {
                    const isChecked = rolePermissions[selectedRole]?.pages?.includes(page.id);
                    return (
                      <label 
                        key={page.id} 
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer select-none ${
                          isChecked
                            ? 'bg-primary/5 border-primary/30 text-gray-900 font-medium'
                            : 'bg-white border-slate-200 text-gray-600 hover:bg-slate-50'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => togglePageAccess(selectedRole, page.id)}
                          disabled={selectedRole === 'admin' && page.id === 'admin'}
                        />
                        <span className="text-sm">{page.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-3">Actions per Page</h4>
                <div className="space-y-3">
                  {ALL_PAGES.filter(p => rolePermissions[selectedRole]?.pages?.includes(p.id)).map(page => (
                    <div key={page.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                      <h5 className="font-medium text-sm text-gray-800 mb-2">{page.label}</h5>
                      <div className="flex flex-wrap gap-2">
                        {ALL_ACTIONS.map(action => {
                          const isActionChecked = rolePermissions[selectedRole]?.actions?.[page.id]?.includes(action.id);
                          return (
                            <label 
                              key={action.id} 
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                                isActionChecked
                                  ? 'bg-white border-primary/40 text-primary font-medium shadow-2xs'
                                  : 'bg-white border-slate-200 text-gray-600 hover:bg-slate-50'
                              }`}
                            >
                              <Checkbox
                                checked={isActionChecked}
                                onCheckedChange={() => toggleAction(selectedRole, page.id, action.id)}
                                disabled={selectedRole === 'admin'}
                              />
                              <span>{action.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={saveRolePermissions} disabled={loading} className="mt-6 w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Role Permissions'}
            </Button>
          </div>
        </TabsContent>

        {/* Whitelist Tab */}
        <TabsContent value="whitelist" className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Manage Whitelisted Emails</h3>
            <p className="text-sm text-gray-600 mb-4">
              Only whitelisted email addresses can register and access the platform.
            </p>
            
            <div className="flex gap-2 mb-6">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                data-testid="new-email-input"
              />
              <Button onClick={addWhitelistedEmail} disabled={loading} data-testid="add-email-button">
                <Mail className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Whitelisted Emails ({whitelistedEmails.length})</Label>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-96 overflow-y-auto">
                {whitelistedEmails.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No whitelisted emails yet</div>
                ) : (
                  whitelistedEmails.map((item) => (
                    <div key={item.email} className="flex items-center justify-between p-3 hover:bg-slate-50">
                      <div>
                        <p className="font-medium text-sm">{item.email}</p>
                        <p className="text-xs text-gray-500">
                          Added {format(new Date(item.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeWhitelistedEmail(item.email)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Blog CMS Tab */}
        <TabsContent value="blogs" className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-gray-800">All Blogs ({blogs.length})</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {blogs.map((blog) => (
                <div key={blog.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="font-semibold text-gray-800 truncate">{blog.title}</h4>
                        <Badge variant={blog.published ? 'default' : 'secondary'}>
                          {blog.published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{blog.content.substring(0, 150)}...</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>By {blog.author_name}</span>
                        <span>{format(new Date(blog.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => toggleBlogPublish(blog.id, !blog.published)}>
                        {blog.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Dialog open={editingBlog?.id === blog.id} onOpenChange={(open) => { if (!open) setEditingBlog(null); }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setEditingBlog(blog)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Blog</DialogTitle>
                            <DialogDescription className="text-sm text-gray-500">
                              Update article title, content, or publication tags.
                            </DialogDescription>
                          </DialogHeader>
                          {editingBlog && editingBlog.id === blog.id && (
                            <div className="space-y-4">
                              <div>
                                <Label>Title</Label>
                                <Input
                                  value={editingBlog.title}
                                  onChange={(e) => setEditingBlog({...editingBlog, title: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label>Content</Label>
                                <Textarea
                                  value={editingBlog.content}
                                  onChange={(e) => setEditingBlog({...editingBlog, content: e.target.value})}
                                  rows={10}
                                />
                              </div>
                              <Button onClick={() => updateBlog(blog.id, editingBlog)}>Save Changes</Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm" onClick={() => deleteBlog(blog.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Calendar Sources (Max 3)</h3>
              <Button onClick={addCalendar} disabled={calendarConfig?.calendar_ids?.length >= 3} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            <div className="space-y-4">
              {calendarConfig?.calendar_ids?.map((cal, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={cal.enabled} onCheckedChange={(checked) => updateCalendar(index, 'enabled', checked)} />
                      <Label>Enabled</Label>
                    </div>
                    <div>
                      <Label>Calendar ID</Label>
                      <Input value={cal.id} onChange={(e) => updateCalendar(index, 'id', e.target.value)} placeholder="calendar-id@group.calendar.google.com" />
                    </div>
                    <div>
                      <Label>Label</Label>
                      <Input value={cal.label} onChange={(e) => updateCalendar(index, 'label', e.target.value)} />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label>Color</Label>
                        <Input type="color" value={cal.color} onChange={(e) => updateCalendar(index, 'color', e.target.value)} />
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => removeCalendar(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={saveCalendarConfig} className="mt-4">Save Calendar Config</Button>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Manage Integrations</h3>
            <p className="text-sm text-gray-600 mb-6">Configure API keys and credentials. Changes may require server restart.</p>

            <form onSubmit={(e) => { e.preventDefault(); saveIntegrations(); }} className="space-y-6">
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-3">Google OAuth</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Client ID</Label>
                    <Input value={integrations.GOOGLE_CLIENT_ID || ''} onChange={(e) => setIntegrations({...integrations, GOOGLE_CLIENT_ID: e.target.value})} />
                  </div>
                  <div>
                    <Label>Client Secret</Label>
                    <Input type="password" autoComplete="new-password" value={integrations.GOOGLE_CLIENT_SECRET || ''} onChange={(e) => setIntegrations({...integrations, GOOGLE_CLIENT_SECRET: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-3">Cloudinary</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Cloud Name</Label>
                    <Input value={integrations.CLOUDINARY_CLOUD_NAME || ''} onChange={(e) => setIntegrations({...integrations, CLOUDINARY_CLOUD_NAME: e.target.value})} />
                  </div>
                  <div>
                    <Label>API Key</Label>
                    <Input value={integrations.CLOUDINARY_API_KEY || ''} onChange={(e) => setIntegrations({...integrations, CLOUDINARY_API_KEY: e.target.value})} />
                  </div>
                  <div>
                    <Label>API Secret</Label>
                    <Input type="password" autoComplete="new-password" value={integrations.CLOUDINARY_API_SECRET || ''} onChange={(e) => setIntegrations({...integrations, CLOUDINARY_API_SECRET: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-3">Gmail SMTP</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Gmail Address</Label>
                    <Input type="email" value={integrations.GMAIL_USER || ''} onChange={(e) => setIntegrations({...integrations, GMAIL_USER: e.target.value})} />
                  </div>
                  <div>
                    <Label>App Password</Label>
                    <Input type="password" autoComplete="new-password" value={integrations.GMAIL_APP_PASSWORD || ''} onChange={(e) => setIntegrations({...integrations, GMAIL_APP_PASSWORD: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-3">Google Calendar API</h4>
                <div>
                  <Label>API Key</Label>
                  <Input value={integrations.GOOGLE_CALENDAR_API_KEY || ''} onChange={(e) => setIntegrations({...integrations, GOOGLE_CALENDAR_API_KEY: e.target.value})} />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save All Integrations'}
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links" className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">External Link Configuration</h3>
            <p className="text-sm text-gray-600 mb-6">Configure an external link that appears at the bottom of the navigation sidebar.</p>

            <div className="space-y-4">
              <div>
                <Label>Link Label</Label>
                <Input value={linkConfig.label} onChange={(e) => setLinkConfig({...linkConfig, label: e.target.value})} placeholder="e.g., Visit Website" />
              </div>
              <div>
                <Label>Link URL</Label>
                <Input type="url" value={linkConfig.url} onChange={(e) => setLinkConfig({...linkConfig, url: e.target.value})} placeholder="https://example.com" />
              </div>
              <Button onClick={saveLinkConfig} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Link Configuration'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
