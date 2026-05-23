import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EditProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    phone: '',
    bio: ''
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
        bio: res.data.bio || ''
      });
    } catch (error) {
      toast.error('Failed to fetch profile');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API}/profile`, formData);
      toast.success('Profile updated successfully!');
      navigate('/');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
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
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h2>

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
    </div>
  );
};

export default EditProfile;