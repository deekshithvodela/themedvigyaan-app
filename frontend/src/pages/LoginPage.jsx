import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ExternalLink, ShieldCheck, Scale, FileText } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LEGAL_DOCS = {
  license: {
    title: 'MIT License',
    icon: Scale,
    content: (
      <div className="space-y-3 font-mono text-xs text-gray-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p className="font-semibold text-gray-900">MIT License</p>
        <p>Copyright (c) 2026 Deekshith Vodela</p>
        <p>
          Permission is hereby granted, free of charge, to any person obtaining a copy
          of this software and associated documentation files (the &quot;Software&quot;), to deal
          in the Software without restriction, including without limitation the rights
          to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
          copies of the Software, and to permit persons to whom the Software is
          furnished to do so, subject to the following conditions:
        </p>
        <p>
          The above copyright notice and this permission notice shall be included in all
          copies or substantial portions of the Software.
        </p>
        <p className="text-[11px] text-gray-500 uppercase">
          THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
          AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
          LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
          OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
          SOFTWARE.
        </p>
      </div>
    )
  },
  privacy: {
    title: 'Privacy Policy',
    icon: ShieldCheck,
    content: (
      <div className="space-y-4 text-xs text-gray-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-1">1. Authentication & Google OAuth</h4>
          <p>
            The MedVigyaan uses Google OAuth 2.0 for secure authentication. We receive your verified email address, full name, and avatar picture. We never request, access, or store your Google account password. Access is restricted to authorized members verified against our administrative whitelist.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-1">2. Profile & Educational Data</h4>
          <p>
            Users may provide their academic department, biography, and professional interests. Your email visibility is protected: disabling &quot;Show my email to others&quot; in settings strictly prevents peer members from viewing your email address across profile cards and chat interactions.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-1">3. Soft-Delete & 30-Day Retention</h4>
          <p>
            When an account is deleted, it is immediately deactivated and user attribution is masked as <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-gray-800">[Deleted User]</span> to preserve academic discussion context. Accounts can be fully restored within 30 days simply by signing back in. After 30 days, un-restored accounts are permanently purged.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-1">4. Zero Commercial Sharing</h4>
          <p>
            We do not sell, license, or monetize your personal data. All data is processed exclusively for platform functionality, academic collaboration, and role-based permissions.
          </p>
        </div>
      </div>
    )
  },
  disclosure: {
    title: 'Responsible Disclosure & Academic Disclaimers',
    icon: FileText,
    content: (
      <div className="space-y-4 text-xs text-gray-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900">
          <h4 className="font-bold text-sm mb-1">Academic & Educational Platform Notice</h4>
          <p>
            The MedVigyaan is an educational and peer collaboration platform designed exclusively for medical students, educators, and doctors. It is <strong>NOT</strong> an Electronic Health Record (EHR) system and does <strong>NOT</strong> provide direct clinical patient advice or emergency medical services. In any medical emergency, contact emergency medical authorities immediately.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-1">De-Identification of Patient Data</h4>
          <p>
            Members discussing case studies or medical literature must strictly ensure that all personal patient health identifiers (PHI) are thoroughly de-identified and anonymized in strict compliance with medical confidentiality standards.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-1">Responsible Security Disclosure</h4>
          <p>
            Security researchers who identify potential vulnerabilities are encouraged to disclose them responsibly. Please report potential security issues directly to Maintainer <a href="https://www.linkedin.com/in/deekshithvodela/" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Deekshith Vodela on LinkedIn</a> with reasonable coordination time prior to public disclosure.
          </p>
        </div>
      </div>
    )
  }
};

const LoginPage = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState(null);
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
      const detail = error.response?.data?.detail || '';
      if (detail.toLowerCase().includes('not registered') || detail.toLowerCase().includes('register first')) {
        toast.info('Account not registered yet. Redirecting to registration...');
        navigate('/register');
      } else {
        toast.error(detail || 'Login failed. Please register first.');
      }
    } finally {
      setLoading(false);
    }
  };

  const activeLegalDoc = legalModal ? LEGAL_DOCS[legalModal] : null;
  const ActiveIcon = activeLegalDoc?.icon || Scale;

  return (
    <div className="auth-container min-h-[100dvh] flex flex-col items-center justify-center py-6 px-4">
      {/* Centered Auth Card & Footer Container */}
      <div className="w-full max-w-[440px] flex flex-col items-center gap-5 sm:gap-6 my-auto">
        <div className="auth-card">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/images/logo.jpg"
              alt="MedVigyaan Logo"
              width="96"
              height="96"
              className="w-24 h-24 object-cover rounded-2xl mb-4 border-4 border-primary"
            />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">The MedVigyaan</h1>
            <p className="text-gray-600 text-center">Medical Education & Collaboration</p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google login failed')}
                  useOneTap={false}
                  data-testid="google-login-button"
                />
              </div>
              
              {(process.env.NODE_ENV === 'development' || process.env.REACT_APP_ALLOW_AUTH_BYPASS === 'true') && (
                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                  <p className="text-center text-xs text-slate-400 font-medium">Local Development Bypass</p>
                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const res = await axios.post(`${API}/auth/bypass`, { role: 'admin' });
                          onLogin(res.data.token, res.data.user);
                          toast.success('Bypass login (Admin) successful!');
                          navigate('/');
                        } catch (error) {
                          toast.error('Bypass login failed');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      variant="default"
                      size="sm"
                      className="w-full text-xs font-semibold"
                      data-testid="dev-login-admin-quick"
                    >
                      Quick Login: Admin (Dev)
                    </Button>
                    <Button 
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const res = await axios.post(`${API}/auth/bypass`, { role: 'member' });
                          onLogin(res.data.token, res.data.user);
                          toast.success('Bypass login (Member) successful!');
                          navigate('/');
                        } catch (error) {
                          toast.error('Bypass login failed');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      data-testid="dev-login-member"
                    >
                      Login as Member
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{' '}
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

        {/* Exclusive Login Page Footer */}
        <footer className="text-center text-xs text-white/80 space-y-2 z-10 w-full" data-testid="login-legal-footer">
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs">
            <button 
              type="button" 
              onClick={() => setLegalModal('license')} 
              className="text-white/85 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
              data-testid="legal-btn-license"
            >
              MIT License
            </button>
            <span className="text-white/40">•</span>
            <button 
              type="button" 
              onClick={() => setLegalModal('privacy')} 
              className="text-white/85 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
              data-testid="legal-btn-privacy"
            >
              Privacy Policy
            </button>
            <span className="text-white/40">•</span>
            <button 
              type="button" 
              onClick={() => setLegalModal('disclosure')} 
              className="text-white/85 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
              data-testid="legal-btn-disclosure"
            >
              Responsible Disclosure
            </button>
          </div>
          <p className="text-[11px] text-white/70">
            © {new Date().getFullYear()}{' '}
            <a
              href="https://www.linkedin.com/in/deekshithvodela/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-medium hover:underline inline-flex items-center gap-1"
              data-testid="legal-copyright-link"
            >
              Deekshith Vodela
              <ExternalLink className="w-3 h-3 inline opacity-70" />
            </a>
            . All rights reserved.
          </p>
        </footer>
      </div>

      {/* Legal & Policies Modal Dialog */}
      <Dialog open={!!legalModal} onOpenChange={() => setLegalModal(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85dvh] flex flex-col p-5 sm:p-6 rounded-xl">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ActiveIcon className="w-5 h-5 text-primary shrink-0" />
              <DialogTitle className="text-base sm:text-lg font-bold text-gray-900" data-testid="legal-dialog-title">
                {activeLegalDoc?.title}
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              {activeLegalDoc?.title} legal terms and governance information
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 overflow-y-auto">
            {activeLegalDoc?.content}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLegalModal(null)}
              className="text-xs"
              data-testid="close-legal-modal-btn"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;