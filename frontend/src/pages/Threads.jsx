import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { MessageSquare, Plus, Clock, User, Trash2, Reply, ChevronDown, ChevronUp } from 'lucide-react';
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

const safeFormatDistanceToNow = (dateStr) => {
  if (!dateStr) return 'recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'recently';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch (e) {
    return 'recently';
  }
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Nested Reply Component for Reddit-style threading
const NestedReply = ({ reply, user, allReplies, onReply, onDelete, depth = 0 }) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const childReplies = allReplies.filter(r => r.parent_reply_id === reply.id);
  const maxDepth = 5;

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setLoading(true);
    try {
      await onReply(reply.thread_id, replyContent, reply.id);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      toast.error('Failed to post reply');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`relative ${
        depth > 0 
          ? 'ml-2 sm:ml-4 pl-3 sm:pl-4 border-l-2 border-slate-200 hover:border-slate-300 transition-colors' 
          : 'py-2 first:pt-0 last:pb-0'
      }`}
      data-testid={`nested-reply-${reply.id}`}
    >
      <div className="py-2.5">
        <div className="flex items-start gap-2.5">
          {/* Consistent left slot for collapse toggle or alignment dot */}
          <div className="w-5 flex-shrink-0 pt-0.5 flex justify-center">
            {childReplies.length > 0 ? (
              <button 
                onClick={() => setCollapsed(!collapsed)}
                className="text-gray-400 hover:text-gray-700 transition-colors focus:outline-none p-0.5 rounded hover:bg-slate-100"
                aria-label={collapsed ? "Expand replies" : "Collapse replies"}
                aria-expanded={!collapsed}
                title={collapsed ? "Expand replies" : "Collapse replies"}
              >
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            ) : (
              <span className="block w-1.5 h-1.5 rounded-full bg-slate-300 mt-2" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-sm ${reply.author_name === '[Deleted User]' ? 'italic text-gray-400 font-normal' : 'font-semibold text-gray-800'}`}>
                {reply.author_name}
              </span>
              <span className="text-xs text-gray-500">
                {safeFormatDistanceToNow(reply.created_at)}
              </span>
            </div>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{reply.content}</p>
            <div className="flex items-center gap-3 mt-2">
              {depth < maxDepth && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-xs text-gray-500 hover:text-primary flex items-center gap-1"
                  aria-label="Reply to comment"
                >
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
              )}
              {(reply.author_id === user.id || user.role === 'admin') && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1" aria-label="Delete comment">
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Reply?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this reply.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(reply.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {showReplyForm && (
              <form onSubmit={handleReply} className="mt-3">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write your reply..."
                  rows={2}
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={!replyContent.trim() || loading}>
                    {loading ? 'Posting...' : 'Reply'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowReplyForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Nested child replies */}
      {!collapsed && childReplies.length > 0 && (
        <div className="mt-1 space-y-1">
          {childReplies.map((childReply) => (
            <NestedReply
              key={childReply.id}
              reply={childReply}
              user={user}
              allReplies={allReplies}
              onReply={onReply}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Threads = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [newThread, setNewThread] = useState({ title: '', content: '' });
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      fetchReplies(selectedThread.id);
    }
  }, [selectedThread]);

  const fetchThreads = async () => {
    try {
      const res = await axios.get(`${API}/threads`);
      setThreads(res.data);
    } catch (error) {
      toast.error('Failed to fetch threads');
    }
  };

  const fetchReplies = async (threadId) => {
    try {
      const res = await axios.get(`${API}/threads/${threadId}/replies`);
      setReplies(res.data);
    } catch (error) {
      toast.error('Failed to fetch replies');
    }
  };

  const createThread = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/threads`, newThread);
      setThreads(prev => [res.data, ...prev]);
      setNewThread({ title: '', content: '' });
      setShowDialog(false);
      toast.success('Thread created!');
    } catch (error) {
      toast.error('Failed to create thread');
    } finally {
      setLoading(false);
    }
  };

  const postReply = async (threadId, content, parentReplyId = null) => {
    const res = await axios.post(`${API}/threads/${threadId}/replies`, {
      content,
      parent_reply_id: parentReplyId
    });
    setReplies(prev => [...prev, res.data]);
    await fetchThreads();
    return res.data;
  };

  const handleRootReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    try {
      await postReply(selectedThread.id, replyContent, null);
      setReplyContent('');
    } catch (error) {
      toast.error('Failed to post reply');
    }
  };

  const deleteThread = async (threadId) => {
    try {
      await axios.delete(`${API}/threads/${threadId}`);
      toast.success('Thread deleted');
      setThreads(prev => prev.filter(t => t.id !== threadId));
      setSelectedThread(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete thread');
    }
  };

  const deleteReply = async (replyId) => {
    try {
      await axios.delete(`${API}/replies/${replyId}`);
      toast.success('Reply deleted');
      setReplies(prev => prev.filter(r => r.id !== replyId));
      await fetchThreads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete reply');
    }
  };

  // Get root-level replies (no parent)
  const rootReplies = replies.filter(r => !r.parent_reply_id);

  if (selectedThread) {
    return (
      <div className="space-y-6" data-testid="thread-detail-view">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedThread(null)} data-testid="back-to-threads-button">
            ← Back to Threads
          </Button>
          {user.role === 'admin' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" data-testid="delete-thread-button">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Thread
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Thread?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this thread and all its replies. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteThread(selectedThread.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{selectedThread.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span className={`flex items-center gap-1 ${selectedThread.author_name === '[Deleted User]' ? 'italic text-gray-400' : ''}`}>
              <User className="w-4 h-4" /> {selectedThread.author_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {safeFormatDistanceToNow(selectedThread.created_at)}
            </span>
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{selectedThread.content}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Replies ({replies.length})
          </h2>

          {/* Root reply form */}
          <form onSubmit={handleRootReply} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4" data-testid="reply-form">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your reply..."
              rows={3}
              className="mb-3"
              data-testid="reply-content-input"
            />
            <Button type="submit" disabled={!replyContent.trim()} data-testid="post-reply-button">
              Post Reply
            </Button>
          </form>

          {/* Nested replies */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 divide-y divide-slate-100 p-4 sm:p-5">
            {rootReplies.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No replies yet. Be the first to comment!</p>
              </div>
            ) : (
              rootReplies.map((reply) => (
                <NestedReply
                  key={reply.id}
                  reply={reply}
                  user={user}
                  allReplies={replies}
                  onReply={postReply}
                  onDelete={deleteReply}
                  depth={0}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="threads-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Threads</h1>
          <p className="text-gray-600 text-sm mt-1">Join discussions and share knowledge</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button data-testid="new-thread-button" className="w-full sm:w-auto h-9 text-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Thread
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="new-thread-dialog">
            <DialogHeader>
              <DialogTitle>Create New Thread</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Start a clinical discussion or ask questions to the community.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createThread} className="space-y-4">
              <div>
                <Label htmlFor="thread-title">Title</Label>
                <Input
                  id="thread-title"
                  value={newThread.title}
                  onChange={(e) => setNewThread(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Thread title..."
                  required
                  data-testid="thread-title-input"
                />
              </div>
              <div>
                <Label htmlFor="thread-content">Content</Label>
                <Textarea
                  id="thread-content"
                  value={newThread.content}
                  onChange={(e) => setNewThread(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="What would you like to discuss?"
                  rows={4}
                  required
                  data-testid="thread-content-input"
                />
              </div>
              <Button type="submit" disabled={loading} data-testid="create-thread-button">
                {loading ? 'Creating...' : 'Create Thread'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {threads
          .filter(thread => 
            searchQuery === '' ||
            thread.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            thread.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((thread) => (
          <div
            key={thread.id}
            className="thread-card"
            onClick={() => setSelectedThread(thread)}
            data-testid={`thread-${thread.id}`}
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">{thread.title}</h2>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{thread.content}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className={`flex items-center gap-1 ${thread.author_name === '[Deleted User]' ? 'italic text-gray-400' : ''}`}>
                <User className="w-3 h-3" /> {thread.author_name}
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> {thread.replies_count} replies
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {safeFormatDistanceToNow(thread.last_activity || thread.created_at)}
                </span>
              </span>
            </div>
          </div>
        ))}

        {threads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No threads yet. Start a discussion!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Threads;
