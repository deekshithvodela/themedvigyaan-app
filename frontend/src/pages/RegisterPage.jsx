import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { jwtDecode } from 'jwt-decode';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RegisterPage = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [googleData, setGoogleData] = useState(null);
  const [formData, setFormData] = useState({
    department: '',
    phone: '',
    bio: ''
  });
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      setGoogleData({
        token: credentialResponse.credential,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      });

      // Quick check: If user already has an active registered account, redirect to login
      try {
        const loginCheck = await axios.post(`${API}/auth/google`, {
          token: credentialResponse.credential
        });
        if (loginCheck.data?.token) {
          toast.info('You are already registered! Redirecting to login...');
          navigate('/login', { state: { email: decoded.email } });
        }
      } catch (checkErr) {
        // If not registered (403), user remains on register page to fill out details
      }
    } catch (error) {
      console.error('Failed to decode Google token:', error);
      toast.error('Failed to process Google login');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!googleData) {
      toast.error('Please sign in with Google first');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register`, {
        email: googleData.email,
        name: googleData.name,
        picture: googleData.picture,
        ...formData
      });
      
      onLogin(res.data.token, res.data.user);
      toast.success('Registration successful!');
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      const detail = error.response?.data?.detail || '';
      if (detail.toLowerCase().includes('already registered')) {
        toast.info('You are already registered! Taking you to the login page...');
        navigate('/login', { state: { email: googleData?.email } });
      } else {
        toast.error(detail || 'Registration failed');
      }
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

  return (
    <div className="auth-container min-h-[100dvh] flex flex-col items-center justify-center py-6 px-4">
      <div className="w-full max-w-[440px] my-auto">
        <div className="auth-card">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/images/logo.jpg"
            alt="MedVigyaan Logo"
            width="80"
            height="80"
            className="w-20 h-20 object-cover rounded-2xl mb-3 border-4 border-primary"
          />
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Register</h1>
          <p className="text-sm text-gray-600 text-center">Join The MedVigyaan Community</p>
        </div>

        {!googleData ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Google login failed')}
                text="signup_with"
                data-testid="google-signup-button"
              />
            </div>
            <p className="text-xs text-center text-gray-500">
              Sign in with Google to continue registration
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="registration-form">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <img src={googleData.picture} alt={googleData.name} className="w-10 h-10 rounded-full" />
              <div>
                <p className="font-semibold text-sm">{googleData.name}</p>
                <p className="text-xs text-gray-600">{googleData.email}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="department">Department/Specialization</Label>
              <Input
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g., Cardiology, Neurology"
                required
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
                rows={3}
                data-testid="bio-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="submit-registration-button"
            >
              {loading ? 'Registering...' : 'Complete Registration'}
            </Button>
          </form>
        )}

        <div className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-semibold" data-testid="login-link">
            Login here
          </Link>
        </div>
      </div>
    </div>
  </div>
);
};

export default RegisterPage;