import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoginPage = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/google`, {
        token: credentialResponse.credential
      });
      
      onLogin(res.data.token, res.data.user);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.detail || 'Login failed. Please register first.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://customer-assets.emergentagent.com/job_teamchat-portal/artifacts/r1igb56v_logoo.jpg"
            alt="MedVigyaan Logo"
            className="w-24 h-24 object-cover rounded-2xl mb-4 border-4 border-primary"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">The MedVigyaan</h1>
          <p className="text-gray-600 text-center">Medical Education & Collaboration</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google login failed')}
              useOneTap={false}
              data-testid="google-login-button"
            />
          </div>

          <div className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-semibold" data-testid="register-link">
              Register here
            </Link>
          </div>
        </div>

        {loading && (
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;