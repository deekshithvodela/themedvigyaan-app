import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, Plus, Trash2, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Feed = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    link: '',
    image: null
  });
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await axios.get(`${API}/announcements`);
      setAnnouncements(res.data);
    } catch (error) {
      toast.error('Failed to fetch announcements');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewAnnouncement(prev => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const createAnnouncement = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('title', newAnnouncement.title);
      formData.append('content', newAnnouncement.content);
      if (newAnnouncement.link) formData.append('link', newAnnouncement.link);
      if (newAnnouncement.image) formData.append('image', newAnnouncement.image);

      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/announcements`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      
      setAnnouncements(prev => [res.data, ...prev]);
      setNewAnnouncement({ title: '', content: '', link: '', image: null });
      setImagePreview(null);
      setShowDialog(false);
      toast.success('Announcement posted!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create announcement');
    } finally {
      setLoading(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      await axios.delete(`${API}/announcements/${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Announcement deleted');
    } catch (error) {
      toast.error('Failed to delete announcement');
    }
  };

  return (
    <div className="space-y-6" data-testid="feed-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Feed</h1>
          <p className="text-gray-600 text-sm mt-1">Latest announcements and updates</p>
        </div>
        {(user.role === 'admin' || user.role === 'core') && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="new-announcement-button" className="w-full sm:w-auto h-9 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" data-testid="new-announcement-dialog">
              <DialogHeader>
                <DialogTitle>Create Announcement</DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Broadcast notices, reminders, and departmental updates.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createAnnouncement} className="space-y-4">
                <div>
                  <Label htmlFor="announcement-title">Title</Label>
                  <Input
                    id="announcement-title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Announcement title..."
                    required
                    data-testid="announcement-title-input"
                  />
                </div>
                <div>
                  <Label htmlFor="announcement-content">Content</Label>
                  <Textarea
                    id="announcement-content"
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your announcement..."
                    rows={6}
                    required
                    data-testid="announcement-content-input"
                  />
                </div>
                <div>
                  <Label htmlFor="announcement-link">Link (optional)</Label>
                  <Input
                    id="announcement-link"
                    type="url"
                    value={newAnnouncement.link}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, link: e.target.value }))}
                    placeholder="https://example.com"
                    data-testid="announcement-link-input"
                  />
                </div>
                <div>
                  <Label htmlFor="announcement-image">Image (optional)</Label>
                  <Input
                    id="announcement-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    data-testid="announcement-image-input"
                  />
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="mt-2 max-h-48 rounded" />
                  )}
                </div>
                <Button type="submit" disabled={loading} data-testid="post-announcement-button">
                  {loading ? 'Posting...' : 'Post Announcement'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {announcements
          .filter(announcement =>
            searchQuery === '' ||
            announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            announcement.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((announcement) => (
          <div
            key={announcement.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
            data-testid={`announcement-${announcement.id}`}
          >
            {announcement.image_url && (
              <img
                src={announcement.image_url}
                alt={announcement.title}
                loading="lazy"
                width={800}
                height={256}
                className="w-full h-64 object-cover"
              />
            )}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{announcement.title}</h3>
                  <p className="text-sm text-gray-500">
                    Posted {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                  </p>
                </div>
                {(user.role === 'admin' || user.role === 'core') && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label="Delete announcement" data-testid={`delete-announcement-${announcement.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this announcement.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAnnouncement(announcement.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <p className="text-gray-700 whitespace-pre-wrap mb-4">{announcement.content}</p>
              {announcement.link && (
                <a
                  href={announcement.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <LinkIcon className="w-4 h-4" />
                  View Link
                </a>
              )}
            </div>
          </div>
        ))}

        {announcements.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No announcements yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;