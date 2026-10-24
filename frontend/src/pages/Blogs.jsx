import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { BookOpen, Plus, User, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [selectedTag, setSelectedTag] = useState(null);
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
        tags: newBlog.tags.split(',').map(t => t.trim().replace(/^#+/, '')).filter(Boolean)
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
            <span className={`flex items-center gap-1 ${selectedBlog.author_name === '[Deleted User]' ? 'italic text-gray-400' : ''}`}>
              <User className="w-4 h-4" /> {selectedBlog.author_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDistanceToNow(new Date(selectedBlog.created_at), { addSuffix: true })}
            </span>
            {selectedBlog.tags?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Tags:</span>
                {selectedBlog.tags.map((rawTag, idx) => {
                  const tag = rawTag.replace(/^#+/, '');
                  return (
                    <Badge 
                      key={idx} 
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-white transition-all text-xs"
                      onClick={() => {
                        setSelectedTag(tag);
                        setSelectedBlog(null);
                      }}
                      title={`View all articles tagged ${tag}`}
                    >
                      {tag}
                    </Badge>
                  );
                })}
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Blogs & Articles</h2>
          <p className="text-gray-600 text-sm mt-1">Share insights and learn from the community</p>
        </div>
        {canCreateBlog && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="new-blog-button" className="w-full sm:w-auto h-9 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                Write Blog
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl" data-testid="new-blog-dialog">
            <DialogHeader>
              <DialogTitle>Write New Blog</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Share medical research, case studies, and insights with the community.
              </DialogDescription>
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

      {/* Active tag filter pill */}
      {selectedTag && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 text-primary px-4 py-2.5 rounded-lg text-sm" data-testid="active-tag-filter">
          <div className="flex items-center gap-2">
            <span className="font-medium">Filtered by tag:</span>
            <Badge variant="default" className="text-xs font-semibold">{selectedTag.replace(/^#+/, '')}</Badge>
          </div>
          <button
            onClick={() => setSelectedTag(null)}
            className="px-2.5 py-1 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 rounded border border-gray-200 text-xs font-semibold shadow-xs transition-colors"
            data-testid="clear-tag-filter-button"
          >
            ✕ Clear Filter
          </button>
        </div>
      )}

      <div className="grid gap-6">
        {blogs
          .filter(blog => {
            const matchesSearch = searchQuery === '' ||
              blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              blog.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
              blog.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesTag = !selectedTag || (blog.tags && blog.tags.includes(selectedTag));
            return matchesSearch && matchesTag;
          })
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
            <div className="flex items-center justify-between flex-wrap gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-4">
                <span className={`flex items-center gap-1 ${blog.author_name === '[Deleted User]' ? 'italic text-gray-400' : ''}`}>
                  <User className="w-4 h-4" /> {blog.author_name}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDistanceToNow(new Date(blog.created_at), { addSuffix: true })}
                </span>
              </div>
              {blog.tags?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {blog.tags.map((rawTag, idx) => {
                    const tag = rawTag.replace(/^#+/, '');
                    return (
                      <Badge 
                        key={idx} 
                        variant={selectedTag === tag ? "default" : "secondary"} 
                        className={`text-xs cursor-pointer transition-colors ${
                          selectedTag === tag
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'hover:bg-primary hover:text-white'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(prev => prev === tag ? null : tag);
                        }}
                        title={`Filter articles by ${tag}`}
                        data-testid={`blog-tag-${tag}`}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </article>
        ))}

        {blogs.filter(blog => {
          const matchesSearch = searchQuery === '' ||
            blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            blog.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            blog.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchesTag = !selectedTag || (blog.tags && blog.tags.includes(selectedTag));
          return matchesSearch && matchesTag;
        }).length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-slate-200">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-base font-medium">
              {selectedTag 
                ? `No blogs found with tag "#${selectedTag}".` 
                : 'No blogs yet. Be the first to write!'}
            </p>
            {selectedTag && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedTag(null)}>
                Clear tag filter
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blogs;