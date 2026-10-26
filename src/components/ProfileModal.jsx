import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Trash2, Edit2, X } from 'lucide-react';
import io from 'socket.io-client';

const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `https://vortex-1-r5ty.onrender.com`
  : 'http://localhost:5000';

const socket = io(SOCKET_URL);

export default function ProfileModal({ userData, themeMode = 'dark', onUpdateUser, onBack }) {
  const isDark = themeMode === 'dark';
  const fileInputRef = useRef(null);
  const [showFullDp, setShowFullDp] = useState(false);

  const cleanNumber = (num) => {
    if (!num) return '';
    const digits = String(num).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  const myPhone = cleanNumber(userData?.phoneNumber || userData?.phone || localStorage.getItem('userPhone') || '9044076898');

  useEffect(() => {
    const handleProfileUpdate = (updatedUser) => {
      const targetPhone = cleanNumber(updatedUser.phoneNumber || updatedUser.phone);
      if (targetPhone === myPhone && onUpdateUser) {
        onUpdateUser(updatedUser);
      }
    };

    socket.on('profile_updated', handleProfileUpdate);
    return () => {
      socket.off('profile_updated', handleProfileUpdate);
    };
  }, [myPhone, onUpdateUser]);

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const syncProfileToBackend = async (updatedData) => {
    try {
      const phone = cleanNumber(updatedData.phoneNumber || updatedData.phone);
      const payload = {
        phoneNumber: phone,
        name: updatedData.name,
        avatar: updatedData.avatar,
        about: updatedData.about
      };

      await fetch('https://vortex-1-r5ty.onrender.com/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      socket.emit('update_profile', payload);
    } catch (err) {}
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const newImageUrl = reader.result;
        const updatedUser = { ...userData, avatar: newImageUrl };
        try {
          localStorage.setItem('vortex_user_profile', JSON.stringify(updatedUser));
        } catch (storageErr) {}
        if (onUpdateUser) onUpdateUser(updatedUser);
        syncProfileToBackend(updatedUser);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAvatar = () => {
    const updatedUser = { ...userData, avatar: '' };
    try {
      localStorage.setItem('vortex_user_profile', JSON.stringify(updatedUser));
    } catch (storageErr) {}
    if (onUpdateUser) onUpdateUser(updatedUser);
    syncProfileToBackend(updatedUser);
  };

  const handleNameChange = (e) => {
    const updatedUser = { ...userData, name: e.target.value };
    try {
      localStorage.setItem('vortex_user_profile', JSON.stringify(updatedUser));
    } catch (storageErr) {}
    if (onUpdateUser) onUpdateUser(updatedUser);
    syncProfileToBackend(updatedUser);
  };

  const handleAboutChange = (e) => {
    const updatedUser = { ...userData, about: e.target.value };
    try {
      localStorage.setItem('vortex_user_profile', JSON.stringify(updatedUser));
    } catch (storageErr) {}
    if (onUpdateUser) onUpdateUser(updatedUser);
    syncProfileToBackend(updatedUser);
  };

  const renderProfileAvatar = () => {
    if (userData?.avatar && !userData.avatar.includes('unsplash')) {
      return (
        <img
          src={userData.avatar}
          alt="Profile"
          onClick={() => setShowFullDp(true)}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
        />
      );
    }
    return (
      <div 
        onClick={() => setShowFullDp(true)}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: '#38bdf8',
          color: '#000',
          fontWeight: '800',
          fontSize: '36px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer'
        }}
      >
        {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
      </div>
    );
  };

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
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        maxWidth: '480px',
        background: isDark ? 'rgba(12, 12, 12, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(35px)',
        WebkitBackdropFilter: 'blur(35px)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          onChange={handleFileChange} 
        />

        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)' }}>
          <div onClick={onBack} style={{ cursor: 'pointer', padding: '4px', WebkitTapHighlightColor: 'transparent' }}>
            <ArrowLeft size={20} color={isDark ? '#fff' : '#000'} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: isDark ? '#fff' : '#000' }}>Profile</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', boxSizing: 'border-box', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div style={{ textAlign: 'center', position: 'relative', width: '110px', height: '110px', margin: '0 auto 28px' }}>
            {renderProfileAvatar()}
            <div 
              onClick={handleCameraClick}
              style={{
                position: 'absolute', bottom: '2px', right: '2px', width: '36px', height: '36px',
                borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(20px)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.2)', color: '#38bdf8', display: 'flex',
                justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Camera size={16} />
            </div>
            <div 
              onClick={handleDeleteAvatar}
              style={{
                position: 'absolute', bottom: '2px', left: '2px', width: '36px', height: '36px',
                borderRadius: '50%', background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(20px)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.2)', color: '#ff5c5c', display: 'flex',
                justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <Trash2 size={16} />
            </div>
          </div>

          <div style={{ marginBottom: '20px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', padding: '14px 16px', borderRadius: '16px', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '700', textAlign: 'left' }}>Your Name</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="text"
                value={userData?.name || 'Nikhil Gupta'}
                onChange={handleNameChange}
                style={{ width: '100%', background: 'transparent', border: 'none', color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none', fontWeight: '500', textAlign: 'left' }}
              />
              <Edit2 size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
            </div>
          </div>

          <div style={{ marginBottom: '20px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', padding: '14px 16px', borderRadius: '16px', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '700', textAlign: 'left' }}>About</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="text"
                value={userData?.about || 'Hey there! I am using Vortex.'}
                onChange={handleAboutChange}
                style={{ width: '100%', background: 'transparent', border: 'none', color: isDark ? '#fff' : '#000', fontSize: '15px', outline: 'none', fontWeight: '500', textAlign: 'left' }}
              />
              <Edit2 size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
            </div>
          </div>

          <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', padding: '14px 16px', borderRadius: '16px', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '11px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '700', textAlign: 'left' }}>Phone Number</div>
            <div style={{ fontSize: '15px', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', fontWeight: '500', textAlign: 'left' }}>{userData?.phone || userData?.phoneNumber || '+91 9044076898'}</div>
          </div>
        </div>

        {showFullDp && (
          <div 
            onClick={() => setShowFullDp(false)} 
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(25px)', WebkitBackdropFilter: 'blur(25px)',
              zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box'
            }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={e => e.stopPropagation()} 
              style={{
                background: isDark ? 'rgba(15, 15, 15, 0.95)' : 'rgba(245, 245, 247, 0.95)', border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: '24px', padding: '24px', textAlign: 'center', maxWidth: '320px', width: '100%',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative'
              }}
            >
              <div style={{ position: 'absolute', top: '12px', right: '12px', cursor: 'pointer', color: isDark ? '#fff' : '#000' }} onClick={() => setShowFullDp(false)}>
                <X size={20} />
              </div>
              <div style={{ width: '220px', height: '220px', borderRadius: '50%', overflow: 'hidden', margin: '16px auto 16px', border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                {userData?.avatar && !userData.avatar.includes('unsplash') ? (
                  <img src={userData.avatar} alt="Profile Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', color: isDark ? '#fff' : '#000', fontSize: '72px', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              <h3 style={{ margin: '0 0 16px', color: isDark ? '#fff' : '#000', fontSize: '18px', fontWeight: '600' }}>{userData?.name}</h3>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}