import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Send, Mail, Trash2, Search, Reply, X, Plus, Check, UserX, MessageSquare, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useSocket } from '@/context/SocketContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DirectMessages = ({ user }) => {
  const location = useLocation();
  const socket = useSocket();
  const { searchQuery = '', onMessagesRead } = useOutletContext() || {};
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [requestsSubTab, setRequestsSubTab] = useState('incoming'); // 'incoming' | 'sent'
  const [acceptedContacts, setAcceptedContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'requests'
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messageContent, setMessageContent] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [viewingUserProfile, setViewingUserProfile] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToMessage = (targetId) => {
    if (!targetId) return;
    const element = document.getElementById(`message-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetId);
      setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === targetId ? null : prev));
      }, 2000);
    } else {
      toast.info('Original message is not visible in current view or was deleted');
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    fetchRequests();
    fetchAcceptedContacts();
  }, []);

  // Handle auto-selection when navigated from user profile popup
  useEffect(() => {
    if (location.state?.selectedUser) {
      setSelectedUser(location.state.selectedUser);
    }
  }, [location.state]);

  // Socket.IO real-time event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
    };

    const handleNewRequest = (req) => {
      if (req.receiver_id === user.id || req.receiver_email === user.email) {
        setRequests((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [req, ...prev];
        });
        toast.info(`New message request from ${req.sender_name}`);
      } else if (req.sender_id === user.id) {
        setSentRequests((prev) => {
          if (prev.some((r) => r.id === req.id)) return prev;
          return [req, ...prev];
        });
      }
    };

    const handleRequestAccepted = (data) => {
      fetchRequests();
      fetchMessages();
      fetchAcceptedContacts();
      if (data.user_name) {
        toast.success(`${data.user_name} accepted your message request!`);
      }
    };

    const handleMessagesMarkedRead = ({ reader_id, sender_id }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.sender_id === sender_id && (msg.receiver_id === reader_id || msg.receiver_email === user.email)
            ? { ...msg, read: true }
            : msg
        )
      );
    };

    const handleDeletedMessage = ({ message_id, content, deleted_by }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message_id ? { ...msg, content: content || 'This message was deleted', deleted: true, deleted_by } : msg
        )
      );
    };

    const handleProfileUpdate = ({ user_id, user: updatedUser }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === user_id ? { ...u, ...updatedUser } : u))
      );
      setSelectedUser((prev) =>
        prev && prev.id === user_id ? { ...prev, ...updatedUser } : prev
      );
      setViewingUserProfile((prev) =>
        prev && prev.id === user_id ? { ...prev, ...updatedUser } : prev
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('new_message_request', handleNewRequest);
    socket.on('message_request_accepted', handleRequestAccepted);
    socket.on('messages_marked_read', handleMessagesMarkedRead);
    socket.on('message_deleted', handleDeletedMessage);
    socket.on('user_profile_updated', handleProfileUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('new_message_request', handleNewRequest);
      socket.off('message_request_accepted', handleRequestAccepted);
      socket.off('messages_marked_read', handleMessagesMarkedRead);
      socket.off('message_deleted', handleDeletedMessage);
      socket.off('user_profile_updated', handleProfileUpdate);
    };
  }, [socket, user.id, user.email]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedUser) {
      markMessagesAsRead(selectedUser.id);
    }
  }, [selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const markMessagesAsRead = async (senderId) => {
    if (!senderId) return;
    // Optimistically mark messages as read immediately in React state so unread dot vanishes instantly
    setMessages((prev) =>
      prev.map((m) => {
        if (
          m.sender_id === senderId &&
          (m.receiver_id === user.id || m.receiver_email === user.email) &&
          !m.read
        ) {
          return { ...m, read: true };
        }
        return m;
      })
    );

    try {
      await axios.post(`${API}/messages/mark-read`, { sender_id: senderId });
      onMessagesRead?.();
      window.dispatchEvent(new CustomEvent('messages_read'));
    } catch (error) {
      console.error('Failed to mark messages as read');
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/messages`);
      setMessages(res.data);
    } catch (error) {
      console.error('Failed to fetch messages');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const fetchRequests = async () => {
    try {
      const [incomingRes, sentRes] = await Promise.all([
        axios.get(`${API}/messages/requests`),
        axios.get(`${API}/messages/requests/sent`)
      ]);
      setRequests(incomingRes.data || []);
      setSentRequests(sentRes.data || []);
    } catch (error) {
      console.error('Failed to fetch message requests');
    }
  };

  const fetchAcceptedContacts = async () => {
    try {
      const res = await axios.get(`${API}/messages/accepted-contacts`);
      setAcceptedContacts(res.data?.accepted_contacts || []);
    } catch (error) {
      console.error('Failed to fetch accepted contacts');
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
      // Deduplicate before state append
      setMessages(prev => prev.some(m => m.id === res.data.id) ? prev : [res.data, ...prev]);
      setMessageContent('');
      setReplyingTo(null);
      fetchRequests();
      fetchAcceptedContacts();
      toast.success('Message sent!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (requestId, req) => {
    try {
      await axios.post(`${API}/messages/requests/${requestId}/accept`);
      toast.success(`Accepted message request from ${req.sender_name}`);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setAcceptedContacts(prev => [...prev, req.sender_id]);
      setMessages(prev => prev.map(m => m.sender_id === req.sender_id ? { ...m, is_accepted: true } : m));
      setSelectedUser({
        id: req.sender_id,
        name: req.sender_name,
        email: req.sender_email,
        picture: req.sender_picture
      });
      setActiveTab('chats');
      setSelectedRequest(null);
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const declineRequest = async (requestId) => {
    try {
      await axios.post(`${API}/messages/requests/${requestId}/decline`);
      toast.info('Message request declined');
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setSelectedRequest(null);
    } catch (error) {
      toast.error('Failed to decline request');
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const res = await axios.delete(`${API}/messages/${messageId}`);
      toast.success('Message deleted');
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: res.data?.message?.content || 'This message was deleted', deleted: true, deleted_by: res.data?.message?.deleted_by } : m));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete message');
    }
  };

  const getConversation = (targetUser) => {
    if (!targetUser) return [];
    return messages
      .filter(msg =>
        (msg.sender_id === user.id && (msg.receiver_email === targetUser.email || (targetUser.id && msg.receiver_id === targetUser.id))) ||
        (msg.receiver_email === user.email && (msg.sender_id === targetUser.id || msg.sender_name === targetUser.name))
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  const getReplyMessage = (replyToId) => {
    return messages.find(m => m.id === replyToId);
  };

  // Derive unique active conversations from messages
  const getUniqueConversations = () => {
    const userMap = new Map();
    messages.forEach(msg => {
      const isSentByMe = msg.sender_id === user.id;
      let otherUser = null;

      if (isSentByMe) {
        if (msg.receiver_id) {
          otherUser = users.find(u => u.id === msg.receiver_id);
        }
        if (!otherUser && msg.receiver_email) {
          otherUser = users.find(u => u.email?.toLowerCase() === msg.receiver_email.toLowerCase()) || {
            id: msg.receiver_id || `user-${msg.receiver_email}`,
            name: msg.receiver_email.split('@')[0],
            email: msg.receiver_email,
            picture: null
          };
        }
      } else {
        otherUser = users.find(u => u.id === msg.sender_id) || {
          id: msg.sender_id,
          name: msg.sender_name,
          email: msg.sender_email || '',
          picture: null
        };
      }

      if (otherUser && otherUser.id !== user.id) {
        // Only include in "Chats" if:
        // 1) The current user sent at least one message in this conversation, OR
        // 2) The contact is in acceptedContacts, OR
        // 3) The conversation is explicitly selected
        const hasSentToThem = messages.some(
          m => m.sender_id === user.id && (
            m.receiver_id === otherUser.id ||
            (otherUser.email && m.receiver_email?.toLowerCase() === otherUser.email?.toLowerCase())
          )
        );
        const isAccepted = acceptedContacts.includes(otherUser.id) || hasSentToThem || selectedUser?.id === otherUser.id;

        if (isAccepted) {
          const key = otherUser.id || otherUser.email;
          const userUnread = messages.some(
            m => !m.read &&
                 (m.sender_id === otherUser.id || (otherUser.email && m.sender_email === otherUser.email)) &&
                 (m.receiver_id === user.id || (user.email && m.receiver_email === user.email))
          );
          if (!userMap.has(key)) {
            userMap.set(key, {
              ...otherUser,
              lastMessage: msg,
              unread: userUnread
            });
          } else {
            const existing = userMap.get(key);
            if (new Date(msg.created_at) > new Date(existing.lastMessage.created_at)) {
              existing.lastMessage = msg;
            }
            existing.unread = userUnread;
          }
        }
      }
    });

    return Array.from(userMap.values());
  };

  const conversations = getUniqueConversations();
  const currentConversation = getConversation(selectedUser);

  const filteredConversations = conversations.filter(c =>
    c.name?.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(localSearchQuery.toLowerCase())
  );

  const filteredMembersForNewChat = users.filter(u =>
    u.id !== user.id &&
    (u.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
     u.email?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
     (u.department && u.department.toLowerCase().includes(memberSearchQuery.toLowerCase())))
  );

  return (
    <div 
      className="flex h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-7rem)] min-h-0 bg-white rounded-none lg:rounded-lg shadow-none lg:shadow-sm border-0 lg:border lg:border-slate-200 overflow-hidden w-full"
      data-testid="direct-messages-page"
    >
      {/* Left Column - Chats & Requests Tabs */}
      <div className={`${selectedUser ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r-0 lg:border-r border-slate-200 flex-col min-h-0 bg-white`}>
        {/* Header with New Chat Button */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-gray-800">Messages</h1>
          <Button
            size="sm"
            onClick={() => setShowNewChatDialog(true)}
            className="flex items-center gap-1.5 min-h-[38px] text-xs px-2.5"
            data-testid="new-message-button"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Tab Switcher: Chats vs Requests */}
        <div className="px-3 pt-2 pb-1 flex gap-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors text-center ${
              activeTab === 'chats'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-slate-100'
            }`}
          >
            Chats ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors text-center relative ${
              activeTab === 'requests'
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-600 hover:bg-slate-100'
            }`}
            data-testid="requests-tab-button"
          >
            Requests
            {requests.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {requests.length}
              </span>
            )}
          </button>
        </div>

        {/* Requests Sub-tabs */}
        {activeTab === 'requests' && (
          <div className="p-2 border-b border-slate-100 bg-slate-50/60 flex gap-1">
            <button
              type="button"
              onClick={() => setRequestsSubTab('incoming')}
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                requestsSubTab === 'incoming'
                  ? 'bg-white text-gray-800 shadow-xs font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid="requests-incoming-tab"
            >
              Incoming ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestsSubTab('sent')}
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                requestsSubTab === 'sent'
                  ? 'bg-white text-gray-800 shadow-xs font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid="requests-sent-tab"
            >
              Sent ({sentRequests.length})
            </button>
          </div>
        )}

        {/* Search */}
        {activeTab === 'chats' && (
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                aria-label="Search conversations"
                className="pl-9 min-h-[40px] text-xs"
                data-testid="search-conversations-input"
              />
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {activeTab === 'chats' ? (
            filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Mail className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No active chats</p>
                <p className="text-xs mt-1">Click "New Chat" to message a member</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setSelectedUser(conv);
                      markMessagesAsRead(conv.id);
                    }}
                    className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors ${
                      selectedUser?.id === conv.id ? 'bg-primary/10' : ''
                    }`}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <Avatar className="w-10 h-10 border border-slate-200">
                      <AvatarImage src={conv.picture} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {conv.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm truncate text-gray-800">{conv.name}</p>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-gray-400">
                            {format(new Date(conv.lastMessage.created_at), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.lastMessage?.content || 'Started conversation'}
                      </p>
                    </div>
                    {conv.unread && (
                      <div className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0" data-testid={`unread-dot-${conv.id}`}></div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Requests Tab */
            requestsSubTab === 'incoming' ? (
              requests.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Check className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No incoming message requests</p>
                  <p className="text-xs mt-1">Incoming invitations will appear here</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => {
                        setSelectedUser({
                          id: req.sender_id,
                          name: req.sender_name,
                          email: req.sender_email,
                          picture: req.sender_picture,
                          isPendingRequest: true,
                          requestId: req.id
                        });
                      }}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      data-testid={`request-${req.id}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={req.sender_picture} />
                          <AvatarFallback className="bg-primary text-white font-bold text-xs">
                            {req.sender_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs text-gray-800 truncate">{req.sender_name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{req.sender_email}</p>
                        </div>
                      </div>
                      {req.initial_content && (
                        <p className="text-xs text-gray-600 bg-white p-2 rounded border border-slate-100 mb-2 italic line-clamp-2">
                          "{req.initial_content}"
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs bg-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptRequest(req.id, req);
                          }}
                          data-testid={`accept-request-${req.id}`}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            declineRequest(req.id);
                          }}
                          data-testid={`decline-request-${req.id}`}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Sent Requests Tab */
              sentRequests.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Check className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No sent message requests</p>
                  <p className="text-xs mt-1">Pending invitations you send will appear here</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {sentRequests.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => {
                        setSelectedUser({
                          id: req.receiver_id,
                          name: req.receiver_name || req.receiver_email,
                          email: req.receiver_email,
                          picture: req.receiver_picture
                        });
                      }}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      data-testid={`sent-request-${req.id}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={req.receiver_picture} />
                          <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                            {(req.receiver_name || req.receiver_email)?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold text-xs text-gray-800 truncate">{req.receiver_name || req.receiver_email}</p>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                              Pending
                            </Badge>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">{req.receiver_email}</p>
                        </div>
                      </div>
                      {req.initial_content && (
                        <p className="text-xs text-gray-600 bg-white p-2 rounded border border-slate-100 italic line-clamp-2">
                          "{req.initial_content}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </div>
      </div>

      {/* Right Column - Chat Area */}
      <div className={`${selectedUser ? 'flex' : 'hidden lg:flex'} flex-1 min-h-0 flex-col bg-white`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-shrink-0">
              <div 
                className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setViewingUserProfile(selectedUser)}
                data-testid="dm-header-profile-trigger"
                title="Click to view member profile"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden min-h-[44px] min-w-[44px] px-2 -ml-1 mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedUser(null);
                  }}
                  aria-label="Back to conversations list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10 border border-slate-200">
                  <AvatarImage src={selectedUser.picture} referrerPolicy="no-referrer" />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {selectedUser.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{selectedUser.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0 font-medium">
                      {selectedUser.role || 'Member'}
                    </Badge>
                    {selectedUser.department && (
                      <Badge variant="outline" className="text-primary border-primary/30 text-[10px] px-1.5 py-0">
                        {selectedUser.department}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Request Banners */}
            {(() => {
              const pendingIncomingReq = requests.find(
                (r) => r.sender_id === selectedUser.id || (selectedUser.email && r.sender_email === selectedUser.email)
              );
              const pendingSentReq = sentRequests.find(
                (r) => r.receiver_id === selectedUser.id || (selectedUser.email && r.receiver_email === selectedUser.email)
              );

              if (pendingIncomingReq) {
                return (
                  <div
                    className="bg-amber-50 border-b border-amber-200 p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900 flex-shrink-0"
                    data-testid="pending-request-banner"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="truncate">
                        <strong>{pendingIncomingReq.sender_name}</strong> sent you a message request.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-primary text-white hover:bg-primary/90 px-3"
                        onClick={() => acceptRequest(pendingIncomingReq.id, pendingIncomingReq)}
                        data-testid="banner-accept-request-button"
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 px-3"
                        onClick={() => declineRequest(pendingIncomingReq.id)}
                        data-testid="banner-decline-request-button"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                );
              }

              if (pendingSentReq) {
                return (
                  <div
                    className="bg-blue-50 border-b border-blue-200 p-2.5 sm:p-3 flex items-center gap-2 text-xs text-blue-900 flex-shrink-0"
                    data-testid="sent-request-banner"
                  >
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Your message request to <strong>{selectedUser.name}</strong> is awaiting approval.</span>
                  </div>
                );
              }

              return null;
            })()}

            {/* Messages Area */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 bg-slate-50">
              {currentConversation.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <Mail className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No messages yet</p>
                    <p className="text-xs text-gray-500 mt-1">Send a message to start chatting</p>
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
                      id={`message-${msg.id}`}
                      className={`flex ${isSent ? 'justify-end' : 'justify-start'} group transition-all duration-300 rounded-lg ${
                        highlightedMessageId === msg.id ? 'ring-2 ring-primary ring-offset-2 bg-primary/10 p-1' : ''
                      }`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[70%] min-w-0 ${isSent ? 'order-2' : 'order-1'}`}>
                        {replyMsg && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => scrollToMessage(msg.reply_to_id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') scrollToMessage(msg.reply_to_id); }}
                            className={`text-xs mb-1 px-3 py-1.5 rounded-t-lg border-l-2 cursor-pointer transition-all hover:opacity-90 active:scale-[0.99] select-none ${
                              isSent ? 'bg-primary/20 border-white/50 text-white/90 hover:bg-primary/30' : 'bg-slate-100 border-primary text-gray-700 hover:bg-slate-200'
                            }`}
                            title="Click to jump to original message"
                            aria-label={`Jump to message from ${replyMsg.sender_name}`}
                            data-testid={`dm-reply-jump-${msg.id}`}
                          >
                            <div className="flex items-center gap-1 font-medium">
                              <Reply className="w-3 h-3 rotate-180 inline" />
                              <span>{replyMsg.sender_name}</span>
                            </div>
                            <p className="truncate text-[11px] opacity-90">{replyMsg.content}</p>
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 break-words break-all [overflow-wrap:anywhere] min-w-0 max-w-full ${
                            isSent
                              ? 'bg-primary text-white rounded-tr-none'
                              : 'bg-white border border-slate-200 text-gray-800 rounded-tl-none'
                          } ${isDeleted ? 'italic opacity-80' : ''}`}
                        >
                          <p className={`text-sm break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap ${isDeleted ? 'italic text-xs py-0.5' : ''}`}>
                            {msg.content}
                          </p>
                          <div className={`flex items-center justify-between gap-3 mt-1 ${isSent ? 'text-white/70' : 'text-gray-500'}`}>
                            <p className="text-[11px]">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                            <div className="flex items-center gap-2">
                              {!isDeleted && (
                                <button
                                  onClick={() => setReplyingTo(msg)}
                                  className={`text-xs py-1 px-1.5 rounded flex items-center gap-1 ${
                                    isSent ? 'hover:text-white' : 'hover:text-primary'
                                  }`}
                                  aria-label="Reply to message"
                                >
                                  <Reply className="w-3 h-3" />
                                  Reply
                                </button>
                              )}
                              {(isSent || user.role === 'admin') && !isDeleted && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button
                                      className={`text-xs py-1 px-1.5 rounded flex items-center gap-1 ${
                                        isSent ? 'hover:text-red-200' : 'hover:text-red-500'
                                      }`}
                                      aria-label="Delete message"
                                      data-testid={`delete-message-${msg.id}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Delete
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This message will be marked as deleted for both participants.
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
              <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs text-gray-500">Replying to {replyingTo.sender_name}</p>
                  <p className="text-sm text-gray-700 truncate">{replyingTo.content}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Input Form, Pending Request Note, or Deactivated Notice */}
            {selectedUser.is_deleted || selectedUser.name === '[Deleted User]' ? (
              <div className="p-4 border-t border-slate-200 bg-slate-50 text-center text-xs text-gray-500 italic flex-shrink-0">
                This user's profile is deactivated. You cannot send new messages to this conversation.
              </div>
            ) : requests.some((r) => r.sender_id === selectedUser.id || (selectedUser.email && r.sender_email === selectedUser.email)) ? (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-gray-600 flex-shrink-0">
                Accept {selectedUser.name}'s message request above to reply to this conversation.
              </div>
            ) : (
              <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder={`Message ${selectedUser.name}...`}
                    rows={1}
                    aria-label={`Type message to ${selectedUser.name}`}
                    className="flex-1 resize-none min-h-[44px] py-2.5"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    data-testid="direct-message-input"
                  />
                  <Button
                    type="submit"
                    disabled={!messageContent.trim() || loading}
                    aria-label="Send direct message"
                    className="min-h-[44px] min-w-[44px] px-3"
                    data-testid="send-direct-message-button"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : (
          /* Empty placeholder */
          <div className="flex-1 flex items-center justify-center text-gray-400 p-8">
            <div className="text-center max-w-sm">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-base font-semibold text-gray-700">Your Messages</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Select a conversation from the left or click "New Chat" to connect with a team member.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal (Replaces flat ALL USERS dump) */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md w-full p-4 sm:p-6 overflow-hidden rounded-xl" data-testid="new-chat-dialog">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base sm:text-lg">New Conversation</DialogTitle>
            <DialogDescription className="text-xs">Search for a team member to start chatting</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Search name, email, department..."
                className="pl-9 min-h-[40px] text-xs sm:text-sm"
                autoFocus
                data-testid="new-chat-search-input"
              />
            </div>
            <div className="max-h-64 sm:max-h-72 overflow-y-auto space-y-1 pr-1 overscroll-contain">
              {filteredMembersForNewChat.length === 0 ? (
                <p className="text-center py-6 text-xs text-gray-500">No members found</p>
              ) : (
                filteredMembersForNewChat.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSelectedUser(member);
                      setShowNewChatDialog(false);
                      setMemberSearchQuery('');
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100 min-w-0"
                    data-testid={`member-select-${member.id}`}
                  >
                    <Avatar className="w-9 h-9 border border-slate-200 shrink-0">
                      <AvatarImage src={member.picture} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {member.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-gray-800 truncate">{member.name}</p>
                        {member.department && (
                          <Badge variant="outline" className="text-[9px] sm:text-[10px] text-primary border-primary/30 max-w-[110px] sm:max-w-[140px] truncate shrink-0">
                            {member.department}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Profile Modal */}
      <Dialog open={!!viewingUserProfile} onOpenChange={(open) => !open && setViewingUserProfile(null)}>
        <DialogContent className="max-w-md" data-testid="user-profile-dialog">
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              View member details, department tag, and role information.
            </DialogDescription>
          </DialogHeader>
          {viewingUserProfile && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border border-slate-200">
                  <AvatarImage src={viewingUserProfile.picture} referrerPolicy="no-referrer" />
                  <AvatarFallback className="text-xl font-bold bg-primary text-white">
                    {viewingUserProfile.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-800 truncate">{viewingUserProfile.name}</h3>
                  {(!viewingUserProfile.show_email && viewingUserProfile.id !== user.id) ? (
                    <p className="text-xs text-gray-400 italic">Email hidden</p>
                  ) : viewingUserProfile.email ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs text-gray-500 truncate">{viewingUserProfile.email}</p>
                      {!viewingUserProfile.show_email && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Only visible to you</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Email hidden</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className="capitalize text-[11px]">
                      {viewingUserProfile.role || 'Member'}
                    </Badge>
                    {viewingUserProfile.department && (
                      <Badge variant="outline" className="text-primary border-primary/30 text-[11px]">
                        {viewingUserProfile.department}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {viewingUserProfile.bio && (
                <div className="bg-slate-50 p-3 rounded-lg text-xs text-gray-700 leading-relaxed border border-slate-100">
                  {viewingUserProfile.bio}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DirectMessages;
