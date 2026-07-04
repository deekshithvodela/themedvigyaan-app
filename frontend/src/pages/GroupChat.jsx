import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Send, MessageSquare, Reply, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GroupChat = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [messages, setMessages] = useState([]);
  const [messageContent, setMessageContent] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/group-chat`);
      setMessages(res.data);
    } catch (error) {
      console.error('Failed to fetch messages');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim()) return;

    setLoading(true);
    try {
      const res = await axios.post(`${API}/group-chat`, {
        content: messageContent,
        reply_to_id: replyingTo?.id || null
      });
      setMessages(prev => [...prev, res.data]);
      setMessageContent('');
      setReplyingTo(null);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await axios.delete(`${API}/group-chat/${messageId}`);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content: 'This message was deleted', deleted: true } : msg
      ));
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const filteredMessages = messages.filter(msg =>
    searchQuery === '' ||
    msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.sender_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getReplyMessage = (replyToId) => {
    return messages.find(m => m.id === replyToId);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden" data-testid="group-chat-page">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">General Chat</h2>
            <p className="text-xs text-gray-500">{messages.length} messages</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSent = msg.sender_id === user.id;
            const replyMsg = msg.reply_to_id ? getReplyMessage(msg.reply_to_id) : null;
            const canDelete = (msg.sender_id === user.id || user.role === 'admin') && !msg.deleted;
            
            return (
              <div
                key={msg.id}
                className={`flex ${isSent ? 'justify-end' : 'justify-start'} group`}
                data-testid={`group-message-${msg.id}`}
              >
                <div className={`max-w-[75%] ${isSent ? 'order-2' : 'order-1'}`}>
                  {/* Reply Preview */}
                  {replyMsg && (
                    <div className={`text-xs mb-1 px-3 py-1 rounded-t-lg border-l-2 ${
                      isSent ? 'bg-primary/20 border-white/50 text-white/80' : 'bg-slate-100 border-primary text-gray-600'
                    }`}>
                      <span className="font-medium">{replyMsg.sender_name}</span>
                      <p className="truncate">{replyMsg.content}</p>
                    </div>
                  )}
                  
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      isSent
                        ? 'bg-primary text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 text-gray-800 rounded-tl-none'
                    } ${msg.deleted ? 'italic opacity-75' : ''}`}
                  >
                    {!isSent && (
                      <p className="text-xs font-semibold text-primary mb-1">{msg.sender_name}</p>
                    )}
                    <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                    <div className={`flex items-center justify-between mt-1 ${isSent ? 'text-white/70' : 'text-gray-500'}`}>
                      <p className="text-xs">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                      <div className="flex items-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        {!msg.deleted && (
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className={`text-xs flex items-center gap-1 ${
                              isSent ? 'hover:text-white' : 'hover:text-primary'
                            }`}
                          >
                            <Reply className="w-3 h-3" />
                            Reply
                          </button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className={`text-xs flex items-center gap-1 ${
                                  isSent ? 'hover:text-red-200' : 'hover:text-red-500'
                                }`}
                                data-testid={`delete-group-message-${msg.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This message will be marked as deleted for everyone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMessage(msg.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs text-gray-500">Replying to {replyingTo.sender_name}</p>
            <p className="text-sm text-gray-700 truncate">{replyingTo.content}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <Textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            data-testid="group-message-input"
          />
          <Button type="submit" disabled={!messageContent.trim() || loading} data-testid="send-group-message-button">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default GroupChat;
