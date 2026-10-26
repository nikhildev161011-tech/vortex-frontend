import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, UserX, X, ShieldAlert } from 'lucide-react';

export default function PrivacyModal({ onBack }) {
  // Initial blocked list with sample DP, name, and phone/id
  const [blockedUsers, setBlockedUsers] = useState([
    { 
      id: 1, 
      name: 'Alex Morgan', 
      identifier: '+91 9123456780', 
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80' 
    }
  ]);
  const [showBlockInput, setShowBlockInput] = useState(false);
  const [newBlocked, setNewBlocked] = useState('');

  const handleBlock = () => {
    if (newBlocked.trim()) {
      const newUser = {
        id: Date.now(),
        name: newBlocked.trim(),
        identifier: newBlocked.trim().includes('+') ? newBlocked.trim() : `@${newBlocked.trim().toLowerCase()}`,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80' // Default profile avatar
      };
      setBlockedUsers([...blockedUsers, newUser]);
      setNewBlocked('');
      setShowBlockInput(false);
    }
  };

  const handleUnblock = (id) => {
    setBlockedUsers(blockedUsers.filter(user => user.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000000',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
        color: '#fff'
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        maxWidth: '480px',
        background: 'rgba(12, 12, 12, 0.95)',
        backdropFilter: 'blur(35px)',
        WebkitBackdropFilter: 'blur(35px)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div onClick={onBack} style={{ cursor: 'pointer', padding: '4px' }}>
            <ArrowLeft size={20} color="#fff" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Privacy & Security</h2>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', boxSizing: 'border-box', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginBottom: '14px', textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.5px' }}>
            Blocked Contacts ({blockedUsers.length})
          </div>

          {blockedUsers.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'left', marginBottom: '20px', fontStyle: 'italic' }}>
              No blocked contacts yet.
            </div>
          ) : (
            blockedUsers.map((user) => (
              <div 
                key={user.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  padding: '10px 14px', 
                  borderRadius: '16px', 
                  marginBottom: '10px', 
                  border: '1px solid rgba(255, 255, 255, 0.06)' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img 
                    src={user.avatar} 
                    alt={user.name} 
                    style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} 
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{user.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{user.identifier}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(user.id)}
                  style={{
                    background: 'rgba(255, 92, 92, 0.15)',
                    border: '1px solid rgba(255, 92, 92, 0.3)',
                    color: '#ff5c5c',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Unblock
                </button>
              </div>
            ))
          )}

          {!showBlockInput ? (
            <button
              onClick={() => setShowBlockInput(true)}
              style={{
                width: '100%',
                padding: '14px',
                marginTop: '10px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
              }}
            >
              <UserX size={16} /> Block New Contact
            </button>
          ) : (
            <div style={{ marginTop: '14px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>Block Contact</span>
                <X size={16} color="rgba(255,255,255,0.5)" style={{ cursor: 'pointer' }} onClick={() => setShowBlockInput(false)} />
              </div>
              <input
                type="text"
                placeholder="Enter name or phone number (e.g. 9044076898)"
                value={newBlocked}
                onChange={(e) => setNewBlocked(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />
              {/* Liquid Glass Confirm Block Button */}
              <button
                onClick={handleBlock}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                  transition: 'all 0.3s ease'
                }}
              >
                Confirm Block
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}