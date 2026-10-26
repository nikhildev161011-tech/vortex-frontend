import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

export default function Splash() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000000',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999,
      color: '#ffffff'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        style={{ textAlign: 'center', width: '100%', maxWidth: '400px' }}
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          style={{
            width: '88px',
            height: '88px',
            margin: '0 auto 24px',
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}
        >
          <MessageSquare size={40} color="#38bdf8" />
        </motion.div>
        <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '3px', margin: '0 0 8px', color: '#fff' }}>VORTEX</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Secure Real-Time Messaging</p>
      </motion.div>
    </div>
  );
}