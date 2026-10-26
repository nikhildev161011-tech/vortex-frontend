import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquare, Users, MoreVertical, Pin, Archive, Trash2, User, Lock, LogOut, Info, UserPlus, CheckCircle2, Send, UsersRound, X, Plus, Sun, Moon } from 'lucide-react';
import ProfileModal from './ProfileModal';
import PrivacyModal from './PrivacyModal';
import ChatWindow from './ChatWindow';
import io from 'socket.io-client';

const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `https://vortex-1-r5ty.onrender.com`
  : 'http://localhost:5000';

const socket = io(SOCKET_URL);

export default function ChatList({ userData, onUpdateUser, onLogout }) {
  const [activeBottomTab, setActiveBottomTab] = useState('chats');
  const [activeTopTab, setActiveTopTab] = useState('recent');
  const [contextMenu, setContextMenu] = useState(null);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [currentModal, setCurrentModal] = useState(null);
  const [previewDpUser, setPreviewDpUser] = useState(null);
  
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('vortex_theme_mode') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vortex_theme_mode', themeMode);
    } catch (e) {}
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => (prev === 'dark' ? 'light' : 'dark'));
    setShowThreeDotsMenu(false);
  };

  const isDark = themeMode === 'dark';

  const [blockedUsers, setBlockedUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('vortex_blocked_users');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vortex_blocked_users', JSON.stringify(blockedUsers));
    } catch (e) {}
  }, [blockedUsers]);

  const handleToggleBlock = (targetPhone) => {
    const cleanId = cleanNumber(targetPhone);
    setBlockedUsers(prev => {
      if (prev.includes(cleanId)) {
        return prev.filter(id => id !== cleanId);
      } else {
        return [...prev, cleanId];
      }
    });
  };

  const cleanNumber = (num) => {
    if (!num) return '';
    const digits = String(num).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  const myPhone = cleanNumber(userData?.phone || userData?.phoneNumber || localStorage.getItem('userPhone') || '9044076898');

  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('vortex_chats');
    const deletedIds = JSON.parse(localStorage.getItem('vortex_deleted_chats') || '[]');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        return parsed.filter(c => !deletedIds.includes(String(c.id)) && !deletedIds.includes(String(c.room)));
      } catch (e) { }
    }
    return [];
  });

  const [contactsList, setContactsList] = useState(() => {
    const saved = localStorage.getItem('vortex_contacts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [searchResultFound, setSearchResultFound] = useState(null);

  const [currentProfile, setCurrentProfile] = useState(() => {
    const savedProfile = localStorage.getItem('vortex_user_profile');
    if (savedProfile) {
      try { return JSON.parse(savedProfile); } catch (e) { }
    }
    return userData || { name: 'Nikhil Gupta', avatar: '' };
  });

  useEffect(() => {
    if (userData) {
      setCurrentProfile(userData);
      try {
        localStorage.setItem('vortex_user_profile', JSON.stringify(userData));
      } catch(e) {}
    }
  }, [userData]);

  useEffect(() => {
    const handleStorageSync = () => {
      const savedProfile = localStorage.getItem('vortex_user_profile');
      if (savedProfile) {
        try {
          setCurrentProfile(JSON.parse(savedProfile));
        } catch(e) {}
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  useEffect(() => {
    const handleGlobalMessage = (newMessage) => {
      const senderClean = cleanNumber(newMessage.sender);
      const isMe = senderClean === myPhone;
      const targetRoom = newMessage.room;
      const deletedIds = JSON.parse(localStorage.getItem('vortex_deleted_chats') || '[]');

      if (deletedIds.includes(String(newMessage.sender)) || deletedIds.includes(String(targetRoom))) {
        return;
      }
      
      const displayTxt = newMessage.message || newMessage.text || (newMessage.type === 'image' ? '📷 Photo' : newMessage.type === 'video' ? '🎥 Video' : newMessage.type === 'audio' ? '🎵 Voice Note' : newMessage.type === 'location' ? '📍 Location' : '📎 File');

      setChats(prev => {
        let found = false;
        const updated = prev.map(c => {
          const cTarget = cleanNumber(c.phoneNumber || c.phone);
          if (c.room === targetRoom || cTarget === senderClean) {
            found = true;
            return { ...c, message: displayTxt, time: 'Just now' };
          }
          return c;
        });

        if (!found && !isMe) {
          const matchedContact = contactsList.find(c => cleanNumber(c.phone || c.phoneNumber) === senderClean);
          updated.unshift({
            id: newMessage.sender,
            name: matchedContact ? matchedContact.name : `User ${senderClean.slice(-4)}`,
            phoneNumber: senderClean,
            phone: senderClean,
            room: targetRoom,
            message: displayTxt,
            time: 'Just now',
            unread: 1,
            avatar: matchedContact ? matchedContact.avatar : '',
            isGroup: false,
            pinned: false
          });
        }

        try {
          localStorage.setItem('vortex_chats', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    };

    socket.on('receive_message', handleGlobalMessage);
    return () => {
      socket.off('receive_message', handleGlobalMessage);
    };
  }, [myPhone, contactsList]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        if (!myPhone) return;
        const res = await fetch(`https://vortex-1-r5ty.onrender.com/api/groups/${myPhone}`);
        if (res.ok) {
          const serverGroups = await res.json();
          const deletedIds = JSON.parse(localStorage.getItem('vortex_deleted_chats') || '[]');
          if (serverGroups && serverGroups.length > 0) {
            const formattedGroups = serverGroups
              .filter(g => !deletedIds.includes(String(g._id)) && !deletedIds.includes(`group_${g._id}`))
              .map(g => ({
                id: g._id,
                name: g.name,
                room: `group_${g._id}`,
                message: 'Group created',
                time: 'Just now',
                unread: 0,
                isGroup: true,
                pinned: false,
                members: g.members,
                createdBy: g.createdBy
              }));

            setChats(prev => {
              const existingIds = new Set(prev.map(c => c.id));
              const newItems = formattedGroups.filter(g => !existingIds.has(g.id));
              const updated = [...newItems, ...prev];
              try {
                localStorage.setItem('vortex_chats', JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
          }
        }
      } catch (err) {}
    };
    fetchGroups();
  }, [myPhone]);

  const fullName = currentProfile?.name || 'Nikhil Gupta';
  const avatarUrl = currentProfile?.avatar || '';

  const renderAvatar = (name, avatar, size = '46px', onClickHandler = null) => {
    return (
      <div 
        onClick={onClickHandler} 
        style={{ 
          width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, 
          cursor: onClickHandler ? 'pointer' : 'default', display: 'flex', justifyContent: 'center', alignItems: 'center',
          background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', 
          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)'
        }}
      >
        {avatar && !avatar.includes('unsplash') ? (
          <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', color: isDark ? '#ffffff' : '#000000', fontFamily: '"SF Pro Display", -apple-system, sans-serif',
            fontWeight: '600', fontSize: size === '24px' ? '11px' : '17px', display: 'flex', justifyContent: 'center', alignItems: 'center',
            letterSpacing: '0.5px'
          }}>
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    try {
      localStorage.setItem('vortex_chats', JSON.stringify(chats));
    } catch (e) {}
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem('vortex_contacts', JSON.stringify(contactsList));
    } catch (e) {}
  }, [contactsList]);

  const filteredChats = chats.filter(chat => {
    if (chatSearchQuery.trim()) {
      const q = chatSearchQuery.toLowerCase();
      const matchesName = chat.name?.toLowerCase().includes(q);
      const matchesMsg = chat.message?.toLowerCase().includes(q);
      if (!matchesName && !matchesMsg) return false;
    }
    if (activeTopTab === 'unread') return chat.unread > 0;
    if (activeTopTab === 'groups') return chat.isGroup;
    return true;
  });

  const handleSearchContact = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length >= 4) {
      try {
        const response = await fetch('https://vortex-1-r5ty.onrender.com/api/check-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: query.trim() })
        });
        const data = await response.json();
        
        if (data.exists) {
          const targetNum = cleanNumber(data.user.phoneNumber);
          const computedRoom = [myPhone, targetNum].sort().join('_');
          setSearchResultFound({
            id: data.user._id,
            name: data.user.name,
            phone: data.user.phoneNumber,
            phoneNumber: data.user.phoneNumber,
            room: computedRoom,
            about: 'Active on Vortex',
            avatar: data.user.avatar || '',
            message: 'Tap to start chat',
            time: 'Just now',
            unread: 0,
            isGroup: false,
            pinned: false
          });
        } else {
          setSearchResultFound(null);
        }
      } catch (err) {
        setSearchResultFound(null);
      }
    } else {
      setSearchResultFound(null);
    }
  };

  const handleSelectUser = (userChat) => {
    const targetNum = cleanNumber(userChat.phone || userChat.phoneNumber || userChat.id);
    const computedRoom = userChat.isGroup ? userChat.room : (myPhone && targetNum ? [myPhone, targetNum].sort().join('_') : userChat.room);
    const formattedChat = {
      id: userChat.id || targetNum || computedRoom,
      name: userChat.name || `User ${targetNum.slice(-4) || 'Chat'}`,
      phone: targetNum,
      phoneNumber: targetNum,
      room: computedRoom,
      message: userChat.message || 'Tap to start chat',
      time: userChat.time || 'Just now',
      unread: 0,
      avatar: userChat.avatar || '',
      isGroup: !!userChat.isGroup,
      pinned: !!userChat.pinned
    };

    setChats(prev => {
      const existingIndex = prev.findIndex(c => 
        c.room === computedRoom || 
        cleanNumber(c.phone || c.phoneNumber) === targetNum || 
        c.id === formattedChat.id
      );

      let updated;
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...formattedChat };
      } else {
        updated = [formattedChat, ...prev];
      }

      try {
        localStorage.setItem('vortex_chats', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setCurrentModal(formattedChat);
  };

  const handleAddToContacts = (e, userContact) => {
    e.stopPropagation();
    setContactsList(prev => {
      const contactPhone = cleanNumber(userContact.phone || userContact.phoneNumber);
      const exists = prev.some(c => cleanNumber(c.phone || c.phoneNumber) === contactPhone || c.id === userContact.id);
      if (!exists) {
        const updated = [...prev, userContact];
        try {
          localStorage.setItem('vortex_contacts', JSON.stringify(updated));
        } catch (err) {}
        return updated;
      }
      return prev;
    });
    alert('Contact added successfully!');
  };

  const handleDeleteContact = (e, contactId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this contact?')) {
      setContactsList(prev => {
        const updated = prev.filter(c => c.id !== contactId);
        try {
          localStorage.setItem('vortex_contacts', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }
  };

  const handleToggleMember = (contactPhone) => {
    if (selectedMembers.includes(contactPhone)) {
      setSelectedMembers(selectedMembers.filter(p => p !== contactPhone));
    } else {
      setSelectedMembers([...selectedMembers, contactPhone]);
    }
  };

  const handleCreateGroup = async () => {
    if (groupName.trim()) {
      try {
        const allMembers = [...selectedMembers, myPhone];
        const response = await fetch('https://vortex-1-r5ty.onrender.com/api/create-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupName.trim(),
            members: allMembers,
            createdBy: myPhone
          })
        });
        const data = await response.json();
        if (data.success) {
          const newGroup = {
            id: data.group._id,
            name: data.group.name,
            room: `group_${data.group._id}`,
            message: `Group created with ${allMembers.length} members`,
            time: 'Just now',
            unread: 0,
            isGroup: true,
            pinned: false,
            members: allMembers,
            createdBy: myPhone
          };
          setChats([newGroup, ...chats]);
          setGroupName('');
          setSelectedMembers([]);
          setShowCreateGroupModal(false);
          setActiveBottomTab('chats');
        }
      } catch (err) {
        alert('Failed to create group');
      }
    }
  };

  const handlePinToggle = (id) => {
    setChats(chats.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
    setContextMenu(null);
  };

  const handleDelete = (chatItem) => {
    const targetId = chatItem.id;
    const targetRoom = chatItem.room;
    setChats(prev => {
      const updated = prev.filter(c => c.id !== targetId && c.room !== targetRoom);
      try {
        localStorage.setItem('vortex_chats', JSON.stringify(updated));
        const deletedIds = JSON.parse(localStorage.getItem('vortex_deleted_chats') || '[]');
        if (targetId && !deletedIds.includes(String(targetId))) {
          deletedIds.push(String(targetId));
        }
        if (targetRoom && !deletedIds.includes(String(targetRoom))) {
          deletedIds.push(String(targetRoom));
        }
        localStorage.setItem('vortex_deleted_chats', JSON.stringify(deletedIds));
      } catch (e) {}
      return updated;
    });
    setContextMenu(null);
  };

  if (currentModal === 'profile') {
    return <ProfileModal userData={currentProfile} themeMode={themeMode} onUpdateUser={(updated) => {
      setCurrentProfile(updated);
      try {
        localStorage.setItem('vortex_user_profile', JSON.stringify(updated));
      } catch(e) {}
      if (onUpdateUser) onUpdateUser(updated);
    }} onBack={() => setCurrentModal(null)} />;
  }
  if (currentModal === 'privacy') {
    return <PrivacyModal themeMode={themeMode} onBack={() => setCurrentModal(null)} />;
  }
  if (typeof currentModal === 'object' && currentModal !== null) {
    return <ChatWindow chat={currentModal} currentUser={currentProfile} themeMode={themeMode} blockedUsers={blockedUsers} onToggleBlock={handleToggleBlock} onBack={() => {
      const saved = localStorage.getItem('vortex_chats');
      const deletedIds = JSON.parse(localStorage.getItem('vortex_deleted_chats') || '[]');
      if (saved) { 
        try { 
          const parsedChats = JSON.parse(saved);
          setChats(parsedChats.filter(c => !deletedIds.includes(String(c.id)) && !deletedIds.includes(String(c.room)))); 
        } catch(e){} 
      }
      setCurrentModal(null);
    }} />;
  }

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      background: isDark ? '#000000' : '#f5f5f7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      margin: 0,
      padding: 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
      color: isDark ? '#ffffff' : '#000000',
      position: 'fixed',
      top: 0,
      left: 0,
      WebkitTapHighlightColor: 'transparent',
      userSelect: 'none',
      WebkitUserSelect: 'none'
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        maxWidth: '480px',
        background: isDark ? 'rgba(8, 8, 8, 0.96)' : 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(35px)',
        WebkitBackdropFilter: 'blur(35px)',
        borderLeft: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.06)',
        borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        WebkitTapHighlightColor: 'transparent'
      }}>
        <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '1.5px', color: isDark ? '#fff' : '#000' }}>VORTEX</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <div 
              onClick={() => setCurrentModal('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '20px',
                padding: '3px 10px 3px 3px',
                gap: '6px',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              {renderAvatar(fullName, avatarUrl, '24px')}
              <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#fff' : '#000', whiteSpace: 'nowrap' }}>{fullName}</span>
            </div>

            <div 
              onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
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

            {showThreeDotsMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                style={{
                  position: 'absolute',
                  right: '0',
                  top: '42px',
                  background: isDark ? 'rgba(15, 15, 15, 0.98)' : 'rgba(245, 245, 247, 0.98)',
                  backdropFilter: 'blur(25px)',
                  WebkitBackdropFilter: 'blur(25px)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '14px',
                  padding: '6px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                  zIndex: 100,
                  minWidth: '160px'
                }}
              >
                <div
                  onClick={toggleTheme}
                  style={{ padding: '9px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                >
                  {isDark ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#38bdf8" />} 
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </div>
                <div
                  onClick={() => { setShowThreeDotsMenu(false); setCurrentModal('profile'); }}
                  style={{ padding: '9px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                >
                  <User size={14} /> DP & Profile
                </div>
                <div
                  onClick={() => { setShowThreeDotsMenu(false); setCurrentModal('privacy'); }}
                  style={{ padding: '9px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                >
                  <Lock size={14} /> Privacy
                </div>
                <div
                  onClick={() => { setShowThreeDotsMenu(false); if(onLogout) onLogout(); }}
                  style={{ padding: '9px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer', color: '#ff5c5c' }}
                >
                  <LogOut size={14} /> Logout
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait">
            {activeBottomTab === 'chats' && (
              <motion.div
                key="chats-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', width: '100%', height: '100%' }}
              >
                <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '14px',
                    padding: '9px 14px',
                    gap: '10px'
                  }}>
                    <Search size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                    <input
                      type="text"
                      placeholder="Search chats or messages..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '13px'
                      }}
                    />
                    {chatSearchQuery && (
                      <X size={14} color={isDark ? '#fff' : '#000'} style={{ cursor: 'pointer' }} onClick={() => setChatSearchQuery('')} />
                    )}
                  </div>
                </div>

                <div style={{
                  padding: '4px',
                  margin: '0 20px 12px',
                  background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.04)',
                  borderRadius: '24px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  position: 'relative',
                  flexShrink: 0,
                  height: '42px',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}>
                  {[
                    { id: 'recent', label: 'Recent Chats' },
                    { id: 'unread', label: 'Unread' },
                    { id: 'groups', label: 'Groups' }
                  ].map((tab) => {
                    const isActive = activeTopTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTopTab(tab.id)}
                        style={{
                          flex: 1,
                          height: '34px',
                          borderRadius: '20px',
                          background: 'transparent',
                          border: 'none',
                          color: isActive ? (isDark ? '#ffffff' : '#000000') : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)') ,
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          position: 'relative',
                          zIndex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeTopPillIndicator"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              borderRadius: '20px',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.12)',
                              zIndex: -1,
                              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                            }}
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          />
                        )}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', boxSizing: 'border-box', position: 'relative', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTopTab}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      transition={{ duration: 0.2 }}
                    >
                      {filteredChats.length === 0 ? (
                        <div style={{ textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', marginTop: '40px', fontSize: '14px' }}>
                          No chats found. Search and start a new chat!
                        </div>
                      ) : (
                        filteredChats.map((chat) => (
                          <div
                            key={chat.id}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu(contextMenu === chat.id ? null : chat.id);
                            }}
                            onClick={() => handleSelectUser(chat)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '11px 14px',
                              borderRadius: '16px',
                              background: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.02)',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.05)',
                              marginBottom: '8px',
                              cursor: 'pointer',
                              position: 'relative',
                              textAlign: 'left',
                              WebkitTapHighlightColor: 'transparent'
                            }}
                          >
                            {chat.isGroup ? (
                              <div style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                background: isDark ? 'rgba(15, 15, 15, 0.9)' : 'rgba(230, 230, 230, 0.9)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                                color: isDark ? '#ffffff' : '#000000',
                                fontWeight: '700',
                                fontSize: '17px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: '14px',
                                flexShrink: 0,
                                boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
                              }}>
                                {chat.name ? chat.name.charAt(0).toUpperCase() : 'G'}
                              </div>
                            ) : renderAvatar(chat.name, chat.avatar, '46px', (e) => { e.stopPropagation(); setPreviewDpUser(chat); })}

                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left', marginLeft: chat.isGroup ? '0px' : '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: isDark ? '#fff' : '#000', textAlign: 'left' }}>{chat.name}</span>
                                <span style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textAlign: 'right' }}>{chat.time}</span>
                              </div>
                              <p style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
                                {chat.message}
                              </p>
                            </div>
                            {chat.pinned && <Pin size={13} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} style={{ marginRight: '8px' }} />}
                            {chat.unread > 0 && (
                              <div style={{
                                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                color: isDark ? '#fff' : '#000',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                                marginLeft: '8px'
                              }}>
                                {chat.unread}
                              </div>
                            )}

                            {contextMenu === chat.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                style={{
                                  position: 'absolute',
                                  right: '14px',
                                  top: '50px',
                                  background: isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(245, 245, 247, 0.95)',
                                  backdropFilter: 'blur(25px)',
                                  WebkitBackdropFilter: 'blur(25px)',
                                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
                                  borderRadius: '14px',
                                  padding: '6px',
                                  boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
                                  zIndex: 10,
                                  minWidth: '150px',
                                  textAlign: 'left'
                                }}
                              >
                                <div
                                  onClick={(e) => { e.stopPropagation(); handlePinToggle(chat.id); }}
                                  style={{ padding: '9px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                                >
                                  <Pin size={14} /> {chat.pinned ? 'Unpin Chat' : 'Pin Chat'}
                                </div>
                                <div
                                  onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
                                  style={{ padding: '9px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }}
                                >
                                  <Archive size={14} /> Archive Chat
                                </div>
                                <div
                                  onClick={(e) => { e.stopPropagation(); handleDelete(chat); }}
                                  style={{ padding: '9px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', cursor: 'pointer', color: '#ff5c5c' }}
                                >
                                  <Trash2 size={14} /> Delete Chat
                                </div>
                              </motion.div>
                            )}
                          </div>
                        ))
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {activeBottomTab === 'contacts' && (
              <motion.div
                key="contacts-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', boxSizing: 'border-box', scrollbarWidth: 'none', msOverflowStyle: 'none', width: '100%', height: '100%' }}
              >
                <div 
                  onClick={() => setShowCreateGroupModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: '16px',
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    marginBottom: '20px',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: isDark ? '#fff' : '#000' }}>
                    <UsersRound size={20} />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>Create New Group</div>
                    <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Add recent chats & contacts</div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', marginBottom: '8px', textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.5px' }}>
                    Find Vortex User
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    gap: '12px'
                  }}>
                    <UserPlus size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                    <input
                      type="text"
                      placeholder="Enter phone number to find on Vortex..."
                      value={searchQuery}
                      onChange={handleSearchContact}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    />
                  </div>
                </div>

                {searchResultFound && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isDark ? '#fff' : '#000', marginBottom: '8px', textTransform: 'uppercase', textAlign: 'left' }}>
                      Active on Vortex
                    </div>
                    <div
                      onClick={() => handleSelectUser(searchResultFound)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '14px 16px',
                        borderRadius: '18px',
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                        gap: '12px',
                        boxSizing: 'border-box',
                        width: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                        {renderAvatar(searchResultFound.name, searchResultFound.avatar, '50px', (e) => { e.stopPropagation(); setPreviewDpUser(searchResultFound); })}
                        <div style={{ textAlign: 'left', flex: 1, marginLeft: '14px', minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '16px', fontWeight: '600', color: isDark ? '#fff' : '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{searchResultFound.name}</span>
                            <CheckCircle2 size={16} color={isDark ? '#fff' : '#000'} style={{ flexShrink: 0 }} />
                          </div>
                          <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{searchResultFound.phone} • Tap to message</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', width: '100%', borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)', paddingTop: '10px', boxSizing: 'border-box' }}>
                        <button
                          onClick={(e) => handleAddToContacts(e, searchResultFound)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '10px',
                            background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                            color: isDark ? '#fff' : '#000',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                            flexShrink: 0
                          }}
                        >
                          Add Contact
                        </button>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: isDark ? '#fff' : '#000', flexShrink: 0 }}>
                          <MessageSquare size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginBottom: '12px', textTransform: 'uppercase', textAlign: 'left' }}>
                  My Contacts ({contactsList.length})
                </div>
                {contactsList.length === 0 ? (
                  <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', textAlign: 'left', padding: '10px 0' }}>
                    No saved contacts yet. Search a user and click "Add Contact".
                  </div>
                ) : (
                  contactsList.map((contact) => (
                    <div
                      key={contact.id}
                      onContextMenu={(e) => handleDeleteContact(e, contact.id)}
                      onClick={() => handleSelectUser(contact)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: '16px',
                        background: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.02)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.05)',
                        marginBottom: '10px',
                        cursor: 'pointer',
                        position: 'relative',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                    >
                      {renderAvatar(contact.name, contact.avatar, '46px', (e) => { e.stopPropagation(); setPreviewDpUser(contact); })}
                      <div style={{ textAlign: 'left', flex: 1, marginLeft: '14px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: isDark ? '#fff' : '#000' }}>{contact.name}</div>
                        <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: '2px' }}>{contact.phone}</div>
                      </div>
                      <div 
                        onClick={(e) => handleDeleteContact(e, contact.id)}
                        style={{ padding: '8px', cursor: 'pointer', color: isDark ? '#ffffff' : '#000000' }}
                        title="Delete Contact"
                      >
                        <Trash2 size={16} />
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeBottomTab === 'about' && (
              <motion.div
                key="about-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', boxSizing: 'border-box', textAlign: 'left', scrollbarWidth: 'none', msOverflowStyle: 'none', width: '100%', height: '100%' }}
              >
                <div style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)', border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', padding: '20px', backdropFilter: 'blur(20px)' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 10px', color: isDark ? '#ffffff' : '#000000' }}>VORTEX</h2>
                  <p style={{ fontSize: '13px', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', lineHeight: '1.6', margin: '0 0 16px' }}>
                    Vortex is a real-time messaging platform engineered for lightning-fast and secure communication.
                  </p>
                  
                  <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', paddingTop: '14px', lineHeight: '1.6' }}>
                    <div><strong>About the Creator:</strong></div>
                    <div style={{ marginTop: '6px' }}>
                      This application is proudly crafted by an aspiring software engineer currently pursuing his BCA (First Semester). Driven by a passion for building high-scale architectures, he is actively preparing for top-tier tech placements at companies like Google.
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)', border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: isDark ? '#ffffff' : '#000000', marginBottom: '6px' }}>
                      Coming Soon
                    </div>
                    <div style={{ fontSize: '12px', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', lineHeight: '1.5' }}>
                      Status updates, end-to-end media encryption enhancements, and more exciting new features will arrive soon in future updates!
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: '14px' }}>
                    <strong>Version:</strong> 1.0.0-Beta
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {previewDpUser && (
          <div 
            onClick={() => setPreviewDpUser(null)} 
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(25px)', WebkitBackdropFilter: 'blur(25px)',
              zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box'
            }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()} 
              style={{
                background: isDark ? 'rgba(15, 15, 15, 0.95)' : 'rgba(245, 245, 247, 0.95)', border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: '24px', padding: '24px', textAlign: 'center', maxWidth: '300px', width: '100%',
                boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{ width: '180px', height: '180px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px', border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                {previewDpUser.avatar && !previewDpUser.avatar.includes('unsplash') ? (
                  <img src={previewDpUser.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', color: isDark ? '#fff' : '#000', fontSize: '64px', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {previewDpUser.name ? previewDpUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              <h3 style={{ margin: '0 0 16px', color: isDark ? '#fff' : '#000', fontSize: '18px', fontWeight: '600' }}>{previewDpUser.name}</h3>
              <button 
                onClick={() => setPreviewDpUser(null)} 
                style={{
                  width: '100%', padding: '10px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
                  borderRadius: '12px', color: isDark ? '#fff' : '#000', fontWeight: '700', fontSize: '14px', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </motion.div>
          </div>
        )}

        {showCreateGroupModal && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            boxSizing: 'border-box'
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              style={{
                width: '100%',
                maxWidth: '360px',
                background: isDark ? 'rgba(15, 15, 15, 0.96)' : 'rgba(245, 245, 247, 0.96)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '22px',
                padding: '22px',
                boxSizing: 'border-box',
                textAlign: 'left',
                boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: isDark ? '#fff' : '#000' }}>Create New Group</span>
                <X size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} style={{ cursor: 'pointer' }} onClick={() => setShowCreateGroupModal(false)} />
              </div>

              <input
                type="text"
                placeholder="Enter Group Name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                  outline: 'none',
                  color: isDark ? '#fff' : '#000',
                  fontSize: '14px',
                  marginBottom: '16px',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ fontSize: '11px', fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Select Members from Contacts
              </div>

              <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '18px', scrollbarWidth: 'none' }}>
                {contactsList.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => handleToggleMember(contact.phone || contact.phoneNumber)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: selectedMembers.includes(contact.phone || contact.phoneNumber) ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
                      border: selectedMembers.includes(contact.phone || contact.phoneNumber) ? (isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)') : '1px solid transparent',
                      marginBottom: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {renderAvatar(contact.name, contact.avatar, '28px')}
                      <span style={{ fontSize: '13px', color: isDark ? '#fff' : '#000', fontWeight: '500' }}>{contact.name}</span>
                    </div>
                    {selectedMembers.includes(contact.phone || contact.phoneNumber) && <CheckCircle2 size={16} color={isDark ? '#fff' : '#000'} />}
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateGroup}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '14px',
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                  backdropFilter: 'blur(20px)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                  color: isDark ? '#fff' : '#000',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Create Group
              </button>
            </motion.div>
          </div>
        )}

        <div style={{
          padding: '8px 16px calc(8px + env(safe-area-inset-bottom)) 16px',
          background: isDark ? 'rgba(8, 8, 8, 0.96)' : 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(25px)',
          borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.06)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          flexShrink: 0,
          zIndex: 50
        }}>
          {[
            { id: 'chats', label: 'Chats', icon: MessageSquare },
            { id: 'contacts', label: 'Contacts', icon: Users },
            { id: 'about', label: 'About', icon: Info }
          ].map((nav) => {
            const Icon = nav.icon;
            const isActive = activeBottomTab === nav.id;
            return (
              <div
                key={nav.id}
                onClick={() => setActiveBottomTab(nav.id)}
                style={{
                  position: 'relative',
                  flex: 1,
                  maxWidth: '110px',
                  height: '46px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: isActive ? (isDark ? '#ffffff' : '#000000') : (isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'),
                  fontSize: '11px',
                  fontWeight: '500',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '23px',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeBottomPillIndicator"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      borderRadius: '23px',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.12)',
                      zIndex: -1,
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
                >
                  <Icon size={16} />
                  <div style={{ marginTop: '1px', fontSize: '10px' }}>{nav.label}</div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}