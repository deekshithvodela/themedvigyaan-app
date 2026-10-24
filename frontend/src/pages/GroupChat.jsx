import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Send, MessageSquare, Reply, X, Trash2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

import { useSocket } from '@/context/SocketContext';

const GroupChat = ({ user }) => {
  const navigate = useNavigate();
  const { searchQuery = '' } = useOutletContext() || {};
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [messageContent, setMessageContent] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const socket = useSocket();

  const scrollToMessage = (targetId) => {
    if (!targetId) return;
    const element = document.getElementById(`group-message-${targetId}`);
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
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleDeletedMessage = ({ message_id, content, deleted_by }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message_id
            ? { ...msg, content: content || 'This message was deleted', deleted: true, deleted_by }
            : msg
        )
      );
    };

    const handleProfileUpdate = ({ user_id, user: updatedUser }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === user_id ? { ...u, ...updatedUser } : u))
      );
      setSelectedUserProfile((prev) =>
        prev && prev.id === user_id ? { ...prev, ...updatedUser } : prev
      );
    };

    socket.on('new_group_message', handleNewMessage);
    socket.on('group_message_deleted', handleDeletedMessage);
    socket.on('user_profile_updated', handleProfileUpdate);

    return () => {
      socket.off('new_group_message', handleNewMessage);
      socket.off('group_message_deleted', handleDeletedMessage);
      socket.off('user_profile_updated', handleProfileUpdate);
    };
  }, [socket]);

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

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const handleOpenProfile = (senderId, senderName, isDeleted) => {
    if (isDeleted || senderName === '[Deleted User]') return;
    const found = users.find(u => u.id === senderId);
    if (found) {
      setSelectedUserProfile(found);
    } else {
      setSelectedUserProfile({
        id: senderId,
        name: senderName,
        email: '',
        role: 'member',
        department: ''
      });
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
      // Strict deduplication against concurrent socket broadcast
      setMessages(prev => prev.some(m => m.id === res.data.id) ? prev : [...prev, res.data]);
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
    <div 
      className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-7rem)] min-h-0 bg-white rounded-none lg:rounded-lg shadow-none lg:shadow-sm border-0 lg:border lg:border-slate-200 overflow-hidden w-full"
      data-testid="group-chat-page"
    >
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-800 text-base">General Chat</h1>
            <p className="text-xs text-gray-500">{messages.length} messages</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 bg-slate-50">
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
                id={`group-message-${msg.id}`}
                className={`flex ${isSent ? 'justify-end' : 'justify-start'} group transition-all duration-300 rounded-lg ${
                  highlightedMessageId === msg.id ? 'ring-2 ring-primary ring-offset-2 bg-primary/10 p-1' : ''
                }`}
                data-testid={`group-message-${msg.id}`}
              >
                <div className={`max-w-[85%] sm:max-w-[75%] min-w-0 ${isSent ? 'order-2' : 'order-1'}`}>
                  {/* Reply Preview */}
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
                      data-testid={`reply-jump-${msg.id}`}
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
                    } ${msg.deleted ? 'italic opacity-80' : ''}`}
                  >
                    {!isSent && (
                      msg.sender_is_deleted || msg.sender_name === '[Deleted User]' ? (
                        <span className="text-xs font-semibold text-gray-400 mb-1 block italic" data-testid="deleted-user-label">
                          {msg.sender_name || '[Deleted User]'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(msg.sender_id, msg.sender_name, msg.sender_is_deleted)}
                          className="text-xs font-semibold text-primary mb-1 hover:underline text-left block cursor-pointer transition-colors"
                          aria-label={`View profile of ${msg.sender_name}`}
                          data-testid={`chat-sender-${msg.id}`}
                        >
                          {msg.sender_name}
                        </button>
                      )
                    )}
                    <p className={`text-sm break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap ${msg.deleted ? 'italic text-xs py-0.5' : ''}`}>
                      {msg.content}
                    </p>
                    <div className={`flex items-center justify-between gap-3 mt-1 ${isSent ? 'text-white/70' : 'text-gray-500'}`}>
                      <p className="text-xs">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {!msg.deleted && (
                          <button
                            onClick={() => setReplyingTo(msg)}
                            aria-label={`Reply to message from ${msg.sender_name}`}
                            className={`text-xs py-1 px-1.5 rounded flex items-center gap-1 ${
                              isSent ? 'hover:text-white' : 'hover:text-primary'
                            }`}
                          >
                            <Reply className="w-3.5 h-3.5" />
                            Reply
                          </button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                aria-label="Delete this message"
                                className={`text-xs py-1 px-1.5 rounded flex items-center gap-1 ${
                                  isSent ? 'hover:text-red-200' : 'hover:text-red-500'
                                }`}
                                data-testid={`delete-group-message-${msg.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Type a message..."
            rows={1}
            aria-label="Type your group message"
            className="flex-1 resize-none min-h-[44px] py-2.5"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            data-testid="group-message-input"
          />
          <Button
            type="submit"
            disabled={!messageContent.trim() || loading}
            aria-label="Send message"
            className="min-h-[44px] min-w-[44px] px-3"
            data-testid="send-group-message-button"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {/* User Profile Dialog */}
      <Dialog open={!!selectedUserProfile} onOpenChange={(open) => !open && setSelectedUserProfile(null)}>
        <DialogContent className="max-w-sm sm:max-w-md" data-testid="user-profile-dialog">
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
            <DialogDescription>View profile details and start a private conversation</DialogDescription>
          </DialogHeader>
          {selectedUserProfile && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border border-slate-200">
                  <AvatarImage src={selectedUserProfile.picture} referrerPolicy="no-referrer" />
                  <AvatarFallback className="text-xl font-bold bg-primary text-white">
                    {selectedUserProfile.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-800 truncate">{selectedUserProfile.name}</h3>
                  {(!selectedUserProfile.show_email && selectedUserProfile.id !== user.id) ? (
                    <p className="text-xs text-gray-400 italic">Email hidden</p>
                  ) : selectedUserProfile.email ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs text-gray-500 truncate">{selectedUserProfile.email}</p>
                      {!selectedUserProfile.show_email && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Only visible to you</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Email hidden</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="secondary" className="capitalize text-[11px]">
                      {selectedUserProfile.role || 'Member'}
                    </Badge>
                    {selectedUserProfile.department && (
                      <Badge variant="outline" className="text-primary border-primary/30 text-[11px]">
                        {selectedUserProfile.department}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {selectedUserProfile.bio && (
                <div className="bg-slate-50 p-3 rounded-lg text-xs text-gray-700 leading-relaxed border border-slate-100">
                  {selectedUserProfile.bio}
                </div>
              )}

              {selectedUserProfile.id !== user.id && (
                <div className="pt-2">
                  <Button
                    className="w-full flex items-center justify-center gap-2 min-h-[44px]"
                    onClick={() => {
                      const target = selectedUserProfile;
                      setSelectedUserProfile(null);
                      navigate('/messages', { state: { selectedUser: target } });
                    }}
                    data-testid="personal-message-button"
                  >
                    <Mail className="w-4 h-4" />
                    Personal Message
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupChat;
