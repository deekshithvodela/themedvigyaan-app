import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EditProfile = ({ onUpdateUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    phone: '',
    bio: '',
    show_email: true
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
      setFormData({
        name: res.data.name || '',
        department: res.data.department || '',
        phone: res.data.phone || '',
        bio: res.data.bio || '',
        show_email: res.data.show_email !== false
      });
    } catch (error) {
      toast.error('Failed to fetch profile');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put(`${API}/profile`, formData);
      toast.success('Profile updated successfully!');
      if (onUpdateUser) {
        onUpdateUser(res.data?.user || formData);
      }
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/profile`);
      toast.success('Your profile has been deactivated. You can restore it by logging in within 30 days.');
      setDeleteDialogOpen(false);
      localStorage.removeItem('token');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete profile');
      setDeleting(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="edit-profile-page">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/')} data-testid="back-button">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h1>

        <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.picture} alt={user.name} />
            <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-gray-800">{user.email}</p>
            <p className="text-sm text-gray-600">Signed in with Google</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="edit-profile-form">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your name"
              required
              data-testid="name-input"
            />
          </div>

          <div>
            <Label htmlFor="department">Department/Specialization</Label>
            <Input
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              placeholder="e.g., Cardiology, Neurology"
              data-testid="department-input"
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 1234567890"
              data-testid="phone-input"
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell us about yourself..."
              rows={4}
              data-testid="bio-input"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="show-email" className="font-semibold text-gray-800 cursor-pointer">Show Email to Others</Label>
              <p className="text-xs text-gray-500">
                When turned on, your email address is visible on your profile card. When turned off, other members will see your email as hidden.
              </p>
            </div>
            <Switch
              id="show-email"
              data-testid="show-email-toggle"
              checked={formData.show_email}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_email: checked }))}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              data-testid="save-profile-button"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/')}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50/50 rounded-lg shadow-sm border border-red-200 p-6 max-w-2xl">
        <h2 className="text-lg font-bold text-red-900 mb-1">Danger Zone</h2>
        <p className="text-xs text-red-700 mb-4 leading-relaxed">
          Deactivate your profile. All your profile information, assignments, and messages will be preserved for 30 days before permanent removal. If you sign in or register again within 30 days, your account and name will be fully restored.
        </p>

        {user.is_main_admin ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>The Primary Admin account cannot be deactivated.</span>
          </div>
        ) : (
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                data-testid="delete-profile-button"
              >
                <Trash2 className="w-4 h-4" />
                Delete My Profile
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Deactivate Your Profile?
                </DialogTitle>
                <DialogDescription className="text-gray-600 pt-2 space-y-2 text-left">
                  <span>
                    Your profile will be deactivated immediately and will no longer appear in the member directory.
                  </span>
                  <span className="block font-medium text-gray-800">
                    30-Day Data Preservation: Your email, bio, and chat history are safely preserved for 30 days. If you log in again with your Google account within 30 days, your account will be instantly restored with your full name and details.
                  </span>
                  <span className="block text-xs text-gray-500">
                    Until restored, your previous messages in group chat will be attributed to "[Deleted User]".
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteProfile}
                  disabled={deleting}
                  data-testid="confirm-delete-profile-button"
                >
                  {deleting ? 'Deactivating...' : 'Confirm Deactivation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default EditProfile;