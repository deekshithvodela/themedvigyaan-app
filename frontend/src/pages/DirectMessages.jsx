import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Send, Mail, Trash2, Search, Reply, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

const DirectMessages = ({ user }) => {
  const { searchQuery = '' } = useOutletContext() || {};
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageContent, setMessageContent] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
  }, []);

  useEffect(() => {
    scrollToBottom();
    // Mark messages as read when viewing conversation
    if (selectedUser) {
      markMessagesAsRead(selectedUser.id);
    }
  }, [messages, selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const markMessagesAsRead = async (senderId) => {
    try {
      await axios.post(`${API}/messages/mark-read`, { sender_id: senderId });
    } catch (error) {
      console.error('Failed to mark messages as read');
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/messages`);
      setMessages(res.data);
    } catch (error) {
      toast.error('Failed to fetch messages');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim() || !selectedUser) return;

    setLoading(true);
    try {
      const res = await axios.post(`${API}/messages`, {
        receiver_email: selectedUser.email,
        content: messageContent,
        reply_to_id: replyingTo?.id || null
      });
      setMessages(prev => [res.data, ...prev]);
      setMessageContent('');
      setReplyingTo(null);
      toast.success('Message sent!');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await axios.delete(`${API}/messages/${messageId}`);
      toast.success('Message deleted');
      await fetchMessages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete message');
    }
  };

  const getConversation = (targetUser) => {
    if (!targetUser) return [];
    return messages
      .filter(msg =>
        (msg.sender_id === user.id && msg.receiver_email === targetUser.email) ||
        (msg.receiver_email === user.email && msg.sender_id === targetUser.id)
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  const getReplyMessage = (replyToId) => {
    return messages.find(m => m.id === replyToId);
  };

  const getUniqueConversations = () => {
    const userMap = new Map();
    messages.forEach(msg => {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const otherUserEmail = msg.sender_id === user.id ? msg.receiver_email : msg.sender_name;
      
      if (otherUserId && !userMap.has(otherUserId)) {
        const otherUser = users.find(u => u.id === otherUserId);
        if (otherUser) {
          userMap.set(otherUserId, {
            ...otherUser,
            lastMessage: msg,
            unread: !msg.read && msg.receiver_id === user.id
          });
        }
      }
    });
    return Array.from(userMap.values());
  };

  const filteredUsers = users.filter(u =>
    u.id !== user.id &&
    (u.name.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(localSearchQuery.toLowerCase()))
  );

  const conversations = getUniqueConversations();
  const currentConversation = selectedUser ? getConversation(selectedUser) : [];

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden" data-testid="direct-messages-page">
      {/* Left Sidebar - Conversations List */}
      <div className={`${selectedUser ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r border-slate-200 flex-col`}>
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-gray-800 mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="pl-10"
              data-testid="search-users-input"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Recent Conversations */}
          {conversations.length > 0 && !localSearchQuery && (
            <div className="p-2">
              <p className="text-xs text-gray-500 uppercase font-semibold px-2 mb-2">Recent</p>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedUser(conv)}
                  className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors ${
                    selectedUser?.id === conv.id ? 'bg-primary/10' : ''
                  }`}
                  data-testid={`conversation-${conv.id}`}
                >
                  <Avatar>
                    <AvatarImage src={conv.picture} />
                    <AvatarFallback>{conv.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{conv.name}</p>
                    <p className="text-xs text-gray-500 truncate">{conv.lastMessage?.content}</p>
                  </div>
                  {conv.unread && (
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* All Users */}
          <div className="p-2">
            {!localSearchQuery && conversations.length > 0 && (
              <p className="text-xs text-gray-500 uppercase font-semibold px-2 mb-2 mt-4">All Users</p>
            )}
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => {
                  setSelectedUser(u);
                  setLocalSearchQuery('');
                }}
                className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors ${
                  selectedUser?.id === u.id ? 'bg-primary/10' : ''
                }`}
                data-testid={`user-${u.id}`}
              >
                <Avatar>
                  <AvatarImage src={u.picture} />
                  <AvatarFallback>{u.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Chat Area */}
      <div className={`${selectedUser ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSelectedUser(null)}
                >
                  ← Back
                </Button>
                <Avatar>
                  <AvatarImage src={selectedUser.picture} />
                  <AvatarFallback>{selectedUser.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-gray-800">{selectedUser.name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {currentConversation.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                </div>
              ) : (
                currentConversation.map((msg) => {
                  const isSent = msg.sender_id === user.id;
                  const isDeleted = msg.deleted;
                  const replyMsg = msg.reply_to_id ? getReplyMessage(msg.reply_to_id) : null;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isSent ? 'justify-end' : 'justify-start'} group`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className={`max-w-[70%] ${isSent ? 'order-2' : 'order-1'}`}>
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
                              ? 'bg-primary text-white'
                              : 'bg-white border border-slate-200 text-gray-800'
                          } ${isDeleted ? 'italic opacity-75' : ''}`}
                        >
                          <p className="text-sm break-words">{msg.content}</p>
                          <div className={`flex items-center justify-between mt-1 ${isSent ? 'text-white/70' : 'text-gray-500'}`}>
                            <p className="text-xs">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                            {!isDeleted && (
                              <button
                                onClick={() => setReplyingTo(msg)}
                                className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
                                  isSent ? 'hover:text-white' : 'hover:text-primary'
                                }`}
                              >
                                <Reply className="w-3 h-3" />
                                Reply
                              </button>
                            )}
                          </div>
                        </div>
                        {isSent && !isDeleted && (user.role === 'admin' || msg.sender_id === user.id) && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" data-testid={`delete-message-${msg.id}`}>
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
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
                          </div>
                        )}
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
                  data-testid="message-input"
                />
                <Button type="submit" disabled={!messageContent.trim() || loading} data-testid="send-message-button">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">Select a conversation</p>
              <p className="text-sm">Choose a user from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectMessages;
