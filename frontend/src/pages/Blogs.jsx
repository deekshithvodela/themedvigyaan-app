import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { BookOpen, Plus, User, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

const Blogs = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [newBlog, setNewBlog] = useState({ title: '', content: '', tags: '' });
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only admin and core can create blogs
  const canCreateBlog = user.role === 'admin' || user.role === 'core';

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    try {
      const res = await axios.get(`${API}/blogs`);
      setBlogs(res.data);
    } catch (error) {
      toast.error('Failed to fetch blogs');
    }
  };

  const createBlog = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const blogData = {
        ...newBlog,
        tags: newBlog.tags.split(',').map(t => t.trim()).filter(Boolean)
      };
      const res = await axios.post(`${API}/blogs`, blogData);
      setBlogs(prev => [res.data, ...prev]);
      setNewBlog({ title: '', content: '', tags: '' });
      setShowDialog(false);
      toast.success('Blog published!');
    } catch (error) {
      toast.error('Failed to create blog');
    } finally {
      setLoading(false);
    }
  };

  const deleteBlog = async (blogId) => {
    try {
      await axios.delete(`${API}/blogs/${blogId}`);
      toast.success('Blog deleted');
      setBlogs(prev => prev.filter(b => b.id !== blogId));
      setSelectedBlog(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete blog');
    }
  };

  if (selectedBlog) {
    return (
      <div className="space-y-6" data-testid="blog-detail-view">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setSelectedBlog(null)} data-testid="back-to-blogs-button">
            ← Back to Blogs
          </Button>
          {user.role === 'admin' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" data-testid="delete-blog-button">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Blog
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Blog?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this blog post. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteBlog(selectedBlog.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <article className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">{selectedBlog.title}</h1>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-6 pb-6 border-b border-slate-200">
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" /> {selectedBlog.author_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDistanceToNow(new Date(selectedBlog.created_at), { addSuffix: true })}
            </span>
            {selectedBlog.tags?.length > 0 && (
              <div className="flex gap-2">
                {selectedBlog.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="blog-content prose max-w-none">
            {selectedBlog.content.split('\n').map((paragraph, idx) => (
              <p key={idx} className="mb-4">{paragraph}</p>
            ))}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="blogs-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Blogs & Articles</h2>
          <p className="text-gray-600 text-sm mt-1">Share insights and learn from the community</p>
        </div>
        {canCreateBlog && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="new-blog-button">
                <Plus className="w-4 h-4 mr-2" />
                Write Blog
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl" data-testid="new-blog-dialog">
            <DialogHeader>
              <DialogTitle>Write New Blog</DialogTitle>
            </DialogHeader>
            <form onSubmit={createBlog} className="space-y-4">
              <div>
                <Label htmlFor="blog-title">Title</Label>
                <Input
                  id="blog-title"
                  value={newBlog.title}
                  onChange={(e) => setNewBlog(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Blog title..."
                  required
                  data-testid="blog-title-input"
                />
              </div>
              <div>
                <Label htmlFor="blog-content">Content</Label>
                <Textarea
                  id="blog-content"
                  value={newBlog.content}
                  onChange={(e) => setNewBlog(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your blog content..."
                  rows={12}
                  required
                  data-testid="blog-content-input"
                />
              </div>
              <div>
                <Label htmlFor="blog-tags">Tags (comma-separated)</Label>
                <Input
                  id="blog-tags"
                  value={newBlog.tags}
                  onChange={(e) => setNewBlog(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="e.g., cardiology, research, education"
                  data-testid="blog-tags-input"
                />
              </div>
              <Button type="submit" disabled={loading} data-testid="publish-blog-button">
                {loading ? 'Publishing...' : 'Publish Blog'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid gap-6">
        {blogs
          .filter(blog =>
            searchQuery === '' ||
            blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            blog.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            blog.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
          )
          .map((blog) => (
          <article
            key={blog.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedBlog(blog)}
            data-testid={`blog-${blog.id}`}
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-3 hover:text-primary transition-colors">
              {blog.title}
            </h3>
            <p className="text-gray-600 mb-4 line-clamp-3">
              {blog.content.substring(0, 200)}...
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" /> {blog.author_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDistanceToNow(new Date(blog.created_at), { addSuffix: true })}
              </span>
              {blog.tags?.length > 0 && (
                <div className="flex gap-2">
                  {blog.tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}

        {blogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No blogs yet. Be the first to write!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Blogs;