import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Paperclip, Smile, Mic, Image, FileText, Music, MapPin, Copy, Reply, Pin, Trash2, X, Play, Pause, Search, Users, MoreVertical, ShieldAlert, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import io from 'socket.io-client';

const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `https://vortex-1-r5ty.onrender.com`
  : 'http://localhost:5000';

const socket = io(SOCKET_URL);

export default function ChatWindow({ chat, currentUser, themeMode = 'dark', blockedUsers = [], onToggleBlock, onBack }) {
  const isDark = themeMode === 'dark';
  const cleanNumber = (num) => {
    if (!num) return '';
    const digits = String(num).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  const getMyNumber = () => {
    if (currentUser?.phone) return cleanNumber(currentUser.phone);
    if (currentUser?.phoneNumber) return cleanNumber(currentUser.phoneNumber);
    if (chat.senderNumber) return cleanNumber(chat.senderNumber);
    try {
      const stored = localStorage.getItem('user') || localStorage.getItem('currentUser') || localStorage.getItem('vortex_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return cleanNumber(parsed.phone || parsed.phoneNumber || parsed.number);
      }
      return cleanNumber(localStorage.getItem('userPhone') || localStorage.getItem('phoneNumber'));
    } catch (e) {
      return '';
    }
  };

  const myPhone = getMyNumber() || '9044076898';
  const targetPhone = cleanNumber(chat.phoneNumber || chat.phone || (chat.room && !isNaN(chat.room) ? chat.room : ''));

  const isBlocked = blockedUsers.includes(targetPhone);

  const roomName = (chat.isGroup || chat.name === 'Vortex Community')
    ? (chat.room || `group_${chat.id || 'community'}`)
    : (myPhone && targetPhone && myPhone !== targetPhone
        ? [myPhone, targetPhone].sort().join('_')
        : (targetPhone ? `room_${targetPhone}` : (chat.room || 'vortex_general_room')));

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const [messages, setMessages] = useState(() => {
    return [
      { id: 1, text: 'Hello! Welcome to Vortex secure chat.', type: 'text', sender: 'them', time: 'Just now', pinned: false, reaction: null },
    ];
  });

  const [groupMembers, setGroupMembers] = useState(chat.members || []);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const isUserGroupAdmin = chat.createdBy === myPhone;

  const getSavedContacts = () => {
    try {
      const saved = localStorage.getItem('vortex_contacts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  };

  const handleAddMemberToGroup = (contactPhone) => {
    const cleanNum = cleanNumber(contactPhone);
    if (groupMembers.includes(cleanNum)) {
      alert('This user is already in the group.');
      return;
    }
    const updatedMembers = [...groupMembers, cleanNum];
    setGroupMembers(updatedMembers);
    setShowAddMemberModal(false);

    const systemMsgId = Date.now().toString();
    const notificationText = `Number ${cleanNum} was added to the group`;
    const sysMsg = {
      id: systemMsgId,
      text: notificationText,
      type: 'system',
      sender: 'system',
      time: 'Just now'
    };
    setMessages(prev => [...prev, sysMsg]);
  };

  const handleRemoveMember = (memberPhone) => {
    if (!isUserGroupAdmin) {
      alert('Only the group admin can remove members.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove ${memberPhone} from this group?`)) {
      setGroupMembers(prev => prev.filter(m => m !== memberPhone));
      const systemMsgId = Date.now().toString();
      const notificationText = `Number ${memberPhone} was removed from the group`;
      const sysMsg = {
        id: systemMsgId,
        text: notificationText,
        type: 'system',
        sender: 'system',
        time: 'Just now'
      };
      setMessages(prev => [...prev, sysMsg]);
    }
  };

  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [replyingTo, setReplyingTo] = useState(null);
  const [contextMenuMsgId, setContextMenuMsgId] = useState(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  
  const audioElementRef = useRef(null);
  const videoElementRefs = useRef({});
  const messagesEndRef = useRef(null);

  const fileInputRef = useRef(null);
  const [selectedFileType, setSelectedFileType] = useState('');
  const emojis = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '✨', '🚀', '😍', '😎', '🙏', '💯'];
  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const updateChatListLastMessage = (lastMsgText) => {
    try {
      const savedChats = localStorage.getItem('vortex_chats');
      if (savedChats) {
        let chatsArr = JSON.parse(savedChats);
        let found = false;
        chatsArr = chatsArr.map(c => {
          const cTarget = cleanNumber(c.phoneNumber || c.phone);
          if (c.room === roomName || cTarget === targetPhone) {
            found = true;
            return { ...c, message: lastMsgText, time: 'Just now' };
          }
          return c;
        });

        if (!found) {
          chatsArr.unshift({
            id: targetPhone || roomName,
            name: chat.name,
            phoneNumber: targetPhone,
            phone: targetPhone,
            room: roomName,
            message: lastMsgText,
            time: 'Just now',
            unread: 0,
            avatar: chat.avatar,
            isGroup: chat.isGroup || false,
            pinned: false
          });
        }

        localStorage.setItem('vortex_chats', JSON.stringify(chatsArr));
      }
    } catch (e) {}
  };

  useEffect(() => {
    const joinRoom = () => {
      socket.emit('join_room', roomName);
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on('connect', joinRoom);

    const loadHistory = async () => {
      try {
        const res = await fetch(`https://vortex-1-r5ty.onrender.com/api/messages/${roomName}`);
        if (res.ok) {
          const history = await res.json();
          if (history && history.length > 0) {
            const formatted = history.map(m => {
              const senderClean = cleanNumber(m.sender);
              const isMe = (senderClean === myPhone) || (m.sender === 'me');
              return {
                id: m._id || m.id,
                text: m.message,
                type: m.type || 'text',
                sender: isMe ? 'me' : 'them',
                senderNumber: senderClean,
                senderName: m.senderName || `User ${senderClean.slice(-4)}`,
                time: formatMessageTime(m.timestamp || m.time),
                replyTo: m.replyTo,
                pinned: false,
                reaction: null,
                fileUrl: m.fileUrl,
                fileName: m.fileName,
                fileSize: m.fileSize,
                mapUrl: m.mapUrl,
                duration: m.duration
              };
            });
            setMessages(formatted);
          }
        }
      } catch (e) {}
    };
    loadHistory();

    const handleReceiveMessage = (newMessage) => {
      if (newMessage.room !== roomName) return;

      setMessages((prev) => {
        const msgId = newMessage._id || newMessage.id;
        if (prev.some(m => String(m.id) === String(msgId))) return prev;
        
        const senderClean = cleanNumber(newMessage.sender);
        const isMe = (senderClean === myPhone);

        const displayTxt = newMessage.message || newMessage.text || (newMessage.type === 'image' ? '📷 Photo' : newMessage.type === 'video' ? '🎥 Video' : newMessage.type === 'audio' ? '🎵 Voice Note' : newMessage.type === 'location' ? '📍 Location' : '📎 File');

        const updated = [...prev, {
          id: msgId,
          text: newMessage.message || newMessage.text,
          type: newMessage.type || 'text',
          sender: isMe ? 'me' : 'them',
          senderNumber: senderClean,
          senderName: newMessage.senderName || `User ${senderClean.slice(-4)}`,
          time: formatMessageTime(newMessage.timestamp || newMessage.time),
          replyTo: newMessage.replyTo,
          pinned: false,
          reaction: null,
          fileUrl: newMessage.fileUrl,
          fileName: newMessage.fileName,
          fileSize: newMessage.fileSize,
          mapUrl: newMessage.mapUrl,
          duration: newMessage.duration
        }];
        updateChatListLastMessage(displayTxt);
        return updated;
      });
    };

    const handleDeleteMessage = (deletedId) => {
      setMessages((prev) => prev.filter(m => String(m.id) !== String(deletedId)));
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_deleted', handleDeleteMessage);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_deleted', handleDeleteMessage);
    };
  }, [roomName, myPhone]);

  const handleSend = () => {
    if (isBlocked) return;
    if (inputText.trim()) {
      const msgText = inputText.trim();
      const localMsgId = Date.now().toString();
      const timeLabel = 'Just now';

      const localMsg = {
        id: localMsgId,
        text: msgText,
        type: 'text',
        sender: 'me',
        senderNumber: myPhone,
        senderName: currentUser?.name || 'Nikhil Gupta',
        time: timeLabel,
        replyTo: replyingTo ? replyingTo.text : null,
        pinned: false,
        reaction: null
      };

      setMessages(prev => {
        const updated = [...prev, localMsg];
        updateChatListLastMessage(msgText);
        return updated;
      });

      socket.emit('send_message', { 
        id: localMsgId,
        room: roomName, 
        sender: myPhone,
        senderName: currentUser?.name || 'Nikhil Gupta',
        recipient: targetPhone,
        message: msgText,
        type: 'text',
        time: new Date().toISOString(),
        replyTo: replyingTo ? replyingTo.text : null
      });

      setInputText('');
      setReplyingTo(null);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setContextMenuMsgId(null);
  };

  const handleDeleteMsg = (id) => {
    socket.emit('delete_message', { messageId: id, room: roomName });
    setMessages(prev => prev.filter(m => String(m.id) !== String(id)));
    setContextMenuMsgId(null);
  };

  const handlePinMsg = (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, pinned: !m.pinned } : m));
    setContextMenuMsgId(null);
  };

  const handleAddReaction = (id, emoji) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, reaction: emoji } : m));
    setContextMenuMsgId(null);
  };

  const handleFileSelect = (type) => {
    setShowAttachMenu(false);
    if (type === 'location') {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
          const msgId = Date.now().toString();
          const timeLabel = 'Just now';

          const locationMsg = {
            id: msgId,
            type: 'location',
            mapUrl: mapUrl,
            sender: 'me',
            senderNumber: myPhone,
            senderName: currentUser?.name || 'Nikhil Gupta',
            time: timeLabel,
            pinned: false,
            reaction: null
          };

          setMessages(prev => {
            const updated = [...prev, locationMsg];
            updateChatListLastMessage('📍 Shared Location');
            return updated;
          });

          socket.emit('send_message', {
            id: msgId,
            room: roomName,
            sender: myPhone,
            senderName: currentUser?.name || 'Nikhil Gupta',
            recipient: targetPhone,
            type: 'location',
            mapUrl: mapUrl,
            time: new Date().toISOString()
          });
        }, () => {});
      }
    } else {
      setSelectedFileType(type);
      if (fileInputRef.current) {
        if (type === 'image') fileInputRef.current.accept = 'image/*,video/*';
        else if (type === 'audio') fileInputRef.current.accept = 'audio/*';
        else if (type === 'document') fileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
        fileInputRef.current.click();
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      const fileSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const msgId = Date.now().toString();
      const timeLabel = 'Just now';

      const isVideoFile = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|mkv)$/i);
      const actualType = isVideoFile ? 'video' : selectedFileType;

      reader.onload = () => {
        const fileUrl = reader.result;
        const fileMsg = { 
          id: msgId, 
          type: actualType, 
          fileName: file.name,
          fileSize: fileSize,
          fileUrl: fileUrl,
          sender: 'me', 
          senderNumber: myPhone,
          senderName: currentUser?.name || 'Nikhil Gupta',
          time: timeLabel, 
          pinned: false,
          reaction: null
        };

        const previewText = actualType === 'video' ? '🎥 Video' : '📷 Photo';

        setMessages(prev => {
          const updated = [...prev, fileMsg];
          updateChatListLastMessage(previewText);
          return updated;
        });

        socket.emit('send_message', {
          id: msgId,
          room: roomName,
          sender: myPhone,
          senderName: currentUser?.name || 'Nikhil Gupta',
          recipient: targetPhone,
          type: actualType,
          fileName: file.name,
          fileSize: fileSize,
          fileUrl: fileUrl,
          message: previewText,
          time: new Date().toISOString()
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleRecording = async () => {
    if (isBlocked) return;
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const audioUrl = reader.result;
            const msgId = Date.now().toString();
            const timeLabel = 'Just now';

            const audioMsg = {
              id: msgId,
              type: 'audio',
              audioUrl: audioUrl,
              duration: '0:05',
              sender: 'me',
              senderNumber: myPhone,
              senderName: currentUser?.name || 'Nikhil Gupta',
              time: timeLabel,
              pinned: false,
              reaction: null
            };

            setMessages(prev => {
              const updated = [...prev, audioMsg];
              updateChatListLastMessage('🎵 Voice Note');
              return updated;
            });

            socket.emit('send_message', {
              id: msgId,
              room: roomName,
              sender: myPhone,
              senderName: currentUser?.name || 'Nikhil Gupta',
              recipient: targetPhone,
              type: 'audio',
              audioUrl: audioUrl,
              duration: '0:05',
              message: '🎵 Voice Note',
              time: new Date().toISOString()
            });
          };
          reader.readAsDataURL(audioBlob);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (err) {}
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    }
  };

  const renderHeaderAvatar = (name, avatar, size = '40px') => {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)' }}>
        {avatar && !avatar.includes('unsplash') ? (
          <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', color: isDark ? '#ffffff' : '#000000', fontFamily: '"SF Pro Display", -apple-system, sans-serif', fontWeight: '600', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', letterSpacing: '0.5px' }}>
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
      </div>
    );
  };

  const displayedMessages = isSearchingChat && chatSearchQuery.trim() 
    ? messages.filter(m => m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase())) 
    : messages;

  if (showGroupInfo && chat.isGroup) {
    const savedContacts = getSavedContacts();
    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        style={{
          width: '100vw',
          height: '100dvh',
          background: isDark ? '#000000' : '#f5f5f7',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 2000,
          color: isDark ? '#fff' : '#000',
          overflow: 'hidden'
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          maxWidth: '480px',
          background: isDark ? '#000000' : '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)' }}>
            <div onClick={() => setShowGroupInfo(false)} style={{ cursor: 'pointer', padding: '4px' }}>
              <ArrowLeft size={20} color={isDark ? '#fff' : '#000'} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: isDark ? '#fff' : '#000' }}>Group Info</h2>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', boxSizing: 'border-box', scrollbarWidth: 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)', color: isDark ? '#fff' : '#000', fontSize: '36px', fontWeight: '800', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 12px' }}>
                {chat.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: isDark ? '#fff' : '#000' }}>{chat.name}</div>
              <div style={{ fontSize: '13px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: '4px' }}>{groupMembers.length} members</div>
            </div>

            {isUserGroupAdmin && (
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '16px',
                    background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)',
                    color: isDark ? '#fff' : '#000',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <UserPlus size={16} /> Add Member from Contacts
                </button>
              </div>
            )}

            <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: '10px', textTransform: 'uppercase' }}>Participants</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groupMembers.map((mNum, idx) => {
                const isAdmin = chat.createdBy === mNum;
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '600', fontSize: '14px', color: isDark ? '#fff' : '#000' }}>
                        {mNum.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>{mNum}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isAdmin && (
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '10px', background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', color: isDark ? '#fff' : '#000', border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)' }}>
                          Group Admin
                        </span>
                      )}
                      {isUserGroupAdmin && !isAdmin && (
                        <div 
                          onClick={() => handleRemoveMember(mNum)}
                          style={{ padding: '6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', cursor: 'pointer' }}
                          title="Remove Member"
                        >
                          <UserMinus size={16} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {showAddMemberModal && (
            <div 
              onClick={() => setShowAddMemberModal(false)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={e => e.stopPropagation()}
                style={{ background: isDark ? '#121212' : '#ffffff', border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)', borderRadius: '22px', padding: '20px', width: '100%', maxWidth: '340px', maxHeight: '70vh', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: isDark ? '#fff' : '#000' }}>Select Contact to Add</h3>
                  <X size={20} color={isDark ? '#fff' : '#000'} style={{ cursor: 'pointer' }} onClick={() => setShowAddMemberModal(false)} />
                </div>
                {savedContacts.length === 0 ? (
                  <div style={{ fontSize: '13px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', textAlign: 'center', padding: '20px 0' }}>
                    No saved contacts found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {savedContacts.map(c => {
                      const cPhone = cleanNumber(c.phone || c.phoneNumber);
                      const isAlreadyMember = groupMembers.includes(cPhone);
                      return (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '13px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>
                              {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>{c.name}</div>
                              <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>{cPhone}</div>
                            </div>
                          </div>
                          <button
                            disabled={isAlreadyMember}
                            onClick={() => handleAddMemberToGroup(cPhone)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '10px',
                              background: isAlreadyMember ? 'transparent' : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'),
                              border: isAlreadyMember ? 'none' : (isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.15)'),
                              color: isAlreadyMember ? 'rgba(150,150,150,0.5)' : (isDark ? '#fff' : '#000'),
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: isAlreadyMember ? 'default' : 'pointer'
                            }}
                          >
                            {isAlreadyMember ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      style={{
        width: '100vw',
        height: '100dvh',
        background: isDark ? '#000000' : '#f5f5f7',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
        color: isDark ? '#fff' : '#000',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        maxWidth: '480px',
        background: isDark ? '#000000' : '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent'
      }}>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)', background: isDark ? '#000000' : '#ffffff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div onClick={onBack} style={{ cursor: 'pointer', padding: '4px', WebkitTapHighlightColor: 'transparent' }}>
              <ArrowLeft size={20} color={isDark ? '#fff' : '#000'} />
            </div>
            {chat.isGroup ? (
              <div 
                onClick={() => setShowGroupInfo(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: isDark ? 'rgba(18, 18, 18, 0.85)' : 'rgba(230, 230, 230, 0.85)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                  color: isDark ? '#ffffff' : '#000000',
                  fontWeight: '800',
                  fontSize: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexShrink: '0'
                }}>
                  {chat.name ? chat.name.charAt(0).toUpperCase() : 'G'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>{chat.name}</span>
                  <span style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Tap for group info</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderHeaderAvatar(chat.name, chat.avatar, '40px')}
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>{chat.name}</span>
                </div>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <div 
              onClick={() => setShowChatMenu(!showChatMenu)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <MoreVertical size={16} color={isDark ? '#fff' : '#000'} />
            </div>

            {showChatMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '40px',
                  background: isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(245, 245, 247, 0.95)',
                  backdropFilter: 'blur(25px)',
                  WebkitBackdropFilter: 'blur(25px)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '14px',
                  padding: '6px',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
                  zIndex: 100,
                  minWidth: '150px',
                  textAlign: 'left'
                }}
              >
                <div
                  onClick={() => { setIsSearchingChat(!isSearchingChat); setShowChatMenu(false); }}
                  style={{ padding: '9px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                >
                  <Search size={14} /> {isSearchingChat ? 'Close Search' : 'Search Messages'}
                </div>
                {!chat.isGroup && targetPhone && (
                  <div
                    onClick={() => { onToggleBlock(targetPhone); setShowChatMenu(false); }}
                    style={{ padding: '9px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', cursor: 'pointer', color: isBlocked ? '#22c55e' : '#ff5c5c' }}
                  >
                    {isBlocked ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {isSearchingChat && (
          <div style={{ padding: '8px 16px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
            <input
              type="text"
              placeholder="Search in chat..."
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: isDark ? '#fff' : '#000', fontSize: '13px' }}
            />
            {chatSearchQuery && (
              <X size={14} color={isDark ? '#fff' : '#000'} style={{ cursor: 'pointer' }} onClick={() => setChatSearchQuery('')} />
            )}
          </div>
        )}

        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '16px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', 
          boxSizing: 'border-box',
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          background: isDark ? '#000000' : '#fafafa'
        }}>
          {displayedMessages.map((msg, index) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} style={{ alignSelf: 'center', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', margin: '4px 0' }}>
                  {msg.text}
                </div>
              );
            }
            return (
              <div
                key={msg.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenuMsgId(contextMenuMsgId === msg.id ? null : msg.id);
                }}
                style={{
                  alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  width: 'fit-content',
                  minWidth: '70px',
                  background: msg.sender === 'me' 
                    ? (isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 122, 255, 0.12)') 
                    : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: msg.sender === 'me'
                    ? (isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(0, 122, 255, 0.25)')
                    : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
                  padding: '10px 14px',
                  borderRadius: '18px',
                  boxSizing: 'border-box',
                  position: 'relative',
                  textAlign: 'left',
                  zIndex: messages.length - index
                }}
              >
                {chat.isGroup && msg.sender !== 'me' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#38bdf8', color: '#000', fontSize: '10px', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {(msg.senderName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8' }}>
                      {msg.senderName || 'User'}
                    </span>
                  </div>
                )}

                {msg.replyTo && (
                  <div style={{ fontSize: '11px', borderLeft: '2px solid #22c55e', paddingLeft: '6px', marginBottom: '4px', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: '4px', padding: '2px 6px' }}>
                    {msg.replyTo}
                  </div>
                )}

                {msg.type === 'text' && (
                  <div style={{ fontSize: '14px', color: isDark ? '#fff' : '#000', wordBreak: 'break-word', paddingRight: '25px' }}>{msg.text}</div>
                )}

                {msg.type === 'image' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '240px', maxWidth: '100%' }}>
                    <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#0a0a0a' }}>
                      <img src={msg.fileUrl} alt="shared" style={{ width: '100%', maxHeight: '280px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                    </div>
                    <a 
                      href={msg.fileUrl} 
                      download={msg.fileName || 'image.jpg'} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ 
                        display: 'block', 
                        width: '100%', 
                        padding: '9px', 
                        textAlign: 'center', 
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', 
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)', 
                        borderRadius: '10px', 
                        color: isDark ? '#ffffff' : '#000000', 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        textDecoration: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      Download Image
                    </a>
                  </div>
                )}

                {msg.type === 'video' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                      <video 
                        ref={el => videoElementRefs.current[msg.id] = el}
                        src={msg.fileUrl} 
                        style={{ width: '100%', maxHeight: '240px', borderRadius: '12px', objectFit: 'cover', display: 'block' }}
                        onEnded={() => setPlayingVideoId(null)}
                      />
                      <div 
                        onClick={() => {
                          const vid = videoElementRefs.current[msg.id];
                          if (vid) {
                            if (playingVideoId === msg.id) {
                              vid.pause();
                              setPlayingVideoId(null);
                            } else {
                              vid.play();
                              setPlayingVideoId(msg.id);
                            }
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          cursor: 'pointer',
                          color: '#fff'
                        }}
                      >
                        {playingVideoId === msg.id ? <Pause size={20} /> : <Play size={20} />}
                      </div>
                    </div>
                    <a 
                      href={msg.fileUrl} 
                      download={msg.fileName || 'video.mp4'} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ 
                        display: 'block', 
                        width: '100%', 
                        padding: '8px', 
                        textAlign: 'center', 
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', 
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)', 
                        borderRadius: '8px', 
                        color: isDark ? '#ffffff' : '#000000', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        textDecoration: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      Download Video
                    </a>
                  </div>
                )}

                {msg.type === 'document' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', padding: '10px 14px', borderRadius: '12px' }}>
                      <FileText size={30} color="#38bdf8" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isDark ? '#fff' : '#000' }}>{msg.fileName}</div>
                        <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: '2px' }}>{msg.fileSize || '2.1 MB'} • Document</div>
                      </div>
                    </div>
                    <a 
                      href={msg.fileUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ 
                        display: 'block', 
                        width: '100%', 
                        padding: '8px', 
                        textAlign: 'center', 
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', 
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)', 
                        borderRadius: '8px', 
                        color: isDark ? '#ffffff' : '#000000', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        textDecoration: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      Open Document
                    </a>
                  </div>
                )}

                {msg.type === 'audio' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px', padding: '4px 0' }}>
                    <div 
                      onClick={() => {
                        if (playingAudioId === msg.id) {
                          if (audioElementRef.current) audioElementRef.current.pause();
                          setPlayingAudioId(null);
                        } else {
                          setPlayingAudioId(msg.id);
                          if (audioElementRef.current && msg.audioUrl) {
                            audioElementRef.current.src = msg.audioUrl;
                            audioElementRef.current.play().catch(err => {});
                          }
                        }
                      }}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#22c55e', color: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {playingAudioId === msg.id ? <Pause size={16} /> : <Play size={16} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1, height: '22px' }}>
                      {[40, 75, 30, 95, 55, 85, 45, 100, 65, 35, 80, 50].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={playingAudioId === msg.id ? { height: [`${h}%`, '20%', `${h}%`] } : { height: '35%' }}
                          transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.05 }}
                          style={{ width: '3px', background: '#22c55e', borderRadius: '2px' }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', fontWeight: '500' }}>{msg.duration || '0:05'}</span>
                    <audio ref={audioElementRef} onEnded={() => setPlayingAudioId(null)} style={{ display: 'none' }} />
                  </div>
                )}

                {msg.type === 'location' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                    <div style={{ background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <MapPin size={24} color="#ef4444" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>Live GPS Location</div>
                        <div style={{ fontSize: '10px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Pinned via Google Maps</div>
                      </div>
                    </div>
                    <a 
                      href={msg.mapUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ 
                        display: 'block', 
                        width: '100%', 
                        padding: '8px', 
                        textAlign: 'center', 
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', 
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)', 
                        borderRadius: '8px', 
                        color: isDark ? '#ffffff' : '#000000', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        textDecoration: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      Open Map
                    </a>
                  </div>
                )}

                {msg.reaction && (
                  <div style={{ position: 'absolute', bottom: '-8px', right: '10px', background: isDark ? 'rgba(20,20,20,0.9)' : 'rgba(240,240,240,0.9)', border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1px 6px', fontSize: '12px' }}>
                    {msg.reaction}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '8px' }}>
                  <div 
                    onClick={() => setContextMenuMsgId(contextMenuMsgId === msg.id ? null : msg.id)}
                    style={{ fontSize: '10px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', cursor: 'pointer', fontWeight: '600' }}
                  >
                    •••
                  </div>
                  <div style={{ fontSize: '10px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textAlign: 'right' }}>{msg.time}</div>
                </div>

                {contextMenuMsgId === msg.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      [msg.sender === 'me' ? 'right' : 'left']: 0,
                      marginTop: '6px',
                      background: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(245, 245, 247, 0.95)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                      borderRadius: '14px',
                      padding: '8px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                      zIndex: 99999,
                      minWidth: '150px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', marginBottom: '6px', gap: '4px' }}>
                      {reactionEmojis.map((emoji, rIdx) => (
                        <span
                          key={rIdx}
                          onClick={(e) => { e.stopPropagation(); handleAddReaction(msg.id, emoji); }}
                          style={{ fontSize: '16px', cursor: 'pointer', padding: '2px', borderRadius: '6px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>

                    <div
                      onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); setContextMenuMsgId(null); }}
                      style={{ padding: '8px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                    >
                      <Reply size={13} /> Reply
                    </div>
                    {msg.type === 'text' && (
                      <div
                        onClick={(e) => { e.stopPropagation(); handleCopy(msg.text); }}
                        style={{ padding: '8px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                      >
                        <Copy size={13} /> Copy
                      </div>
                    )}
                    <div
                      onClick={(e) => { e.stopPropagation(); handlePinMsg(msg.id); }}
                      style={{ padding: '8px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                    >
                      <Pin size={13} /> {msg.pinned ? 'Unpin' : 'Pin'}
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); handleDeleteMsg(msg.id); }}
                      style={{ padding: '8px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: '#ff5c5c' }}
                    >
                      <Trash2 size={13} /> Delete
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              padding: '12px',
              background: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(245, 245, 247, 0.95)',
              borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '8px',
              textAlign: 'center',
              flexShrink: 0
            }}
          >
            {emojis.map((emoji, idx) => (
              <span
                key={idx}
                onClick={() => { setInputText(prev => prev + emoji); setShowEmojiPicker(false); }}
                style={{ fontSize: '22px', cursor: 'pointer', padding: '6px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
              >
                {emoji}
              </span>
            ))}
          </motion.div>
        )}

        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'absolute',
              bottom: '75px',
              left: '16px',
              right: '16px',
              background: isDark ? 'rgba(22, 22, 22, 0.92)' : 'rgba(245, 245, 247, 0.92)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: '20px',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              zIndex: 50,
              textAlign: 'center'
            }}
          >
            <div onClick={() => handleFileSelect('image')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: isDark ? '#fff' : '#000' }}>
                <Image size={20} />
              </div>
              <span style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', fontWeight: '500' }}>Photos</span>
            </div>
            <div onClick={() => handleFileSelect('audio')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: isDark ? '#fff' : '#000' }}>
                <Music size={20} />
              </div>
              <span style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', fontWeight: '500' }}>Audio</span>
            </div>
            <div onClick={() => handleFileSelect('document')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: isDark ? '#fff' : '#000' }}>
                <FileText size={20} />
              </div>
              <span style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', fontWeight: '500' }}>Document</span>
            </div>
            <div onClick={() => handleFileSelect('location')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: isDark ? '#fff' : '#000' }}>
                <MapPin size={20} />
              </div>
              <span style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', fontWeight: '500' }}>Location</span>
            </div>
          </motion.div>
        )}

        {replyingTo && (
          <div style={{ padding: '8px 16px', background: isDark ? 'rgba(20,20,20,0.9)' : 'rgba(240,240,242,0.9)', borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', borderLeft: '3px solid #22c55e', paddingLeft: '8px', textAlign: 'left' }}>
              Replying to: {replyingTo.text}
            </div>
            <X size={16} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} style={{ cursor: 'pointer' }} onClick={() => setReplyingTo(null)} />
          </div>
        )}

        {isRecording && (
          <div style={{ padding: '8px 16px', background: 'rgba(34, 197, 94, 0.15)', borderTop: '1px solid rgba(34, 197, 94, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
              Recording Voice Note... Tap Mic again to Stop & Send
            </div>
          </div>
        )}

        <div style={{ padding: '10px 12px calc(12px + env(safe-area-inset-bottom)) 12px', background: isDark ? '#000000' : '#ffffff', borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, boxSizing: 'border-box' }}>
          {isBlocked ? (
            <div style={{ width: '100%', textAlign: 'center', padding: '10px', fontSize: '13px', color: '#ef4444', fontWeight: '600' }}>
              You are blocked or this user is blocked.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }} onClick={() => setShowAttachMenu(!showAttachMenu)}>
                <Paperclip size={19} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} />
              </div>
              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '20px',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                  outline: 'none',
                  color: isDark ? '#fff' : '#000',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  minWidth: 0
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Smile size={19} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }} onClick={toggleRecording}>
                <Mic size={19} color={isRecording ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)')} />
              </div>
              <div
                onClick={handleSend}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                  color: '#22c55e',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  WebkitTapHighlightColor: 'transparent',
                  flexShrink: 0
                }}
              >
                <Send size={15} />
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}