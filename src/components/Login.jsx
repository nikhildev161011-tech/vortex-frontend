import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck, Download, Globe } from 'lucide-react';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

export default function Login({ onLoginComplete }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallGate, setShowInstallGate] = useState(false);
  
  const [subStep, setSubStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verificationId, setVerificationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(checkStandalone);
    
    // अगर ऐप इंस्टॉल नहीं है, तो सबसे पहले इंस्टॉल गेट दिखाओ
    if (!checkStandalone) {
      setShowInstallGate(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowInstallGate(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallGate(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install Vortex, tap your browser menu (3 dots) and select "Install app" or "Add to Home screen".');
    }
  };

  const handleContinueToBrowser = () => {
    setShowInstallGate(false);
  };

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {}
      });
    }
  };

  const handleSendOtp = async () => {
    if (phone.trim().length !== 10) return;

    setLoading(true);
    setErrorMsg('');
    try {
      setupRecaptcha();
      const formattedPhoneNumber = '+91' + phone.trim();
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhoneNumber, appVerifier);
      setVerificationId(confirmationResult);
      setSubStep(3);
    } catch (error) {
      console.error('Error sending OTP:', error);
      setErrorMsg('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6 || !verificationId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await verificationId.confirm(fullOtp);
      const cleanPhone = phone.trim();
      const formattedPhoneForDb = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

      try {
        await fetch('https://vortex-1-r5ty.onrender.com/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: formattedPhoneForDb,
            name: name.trim(),
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
          })
        });
      } catch (dbErr) {
        console.error('Error saving user to backend database:', dbErr);
      }

      onLoginComplete({ name: name.trim(), phone: '+91 ' + cleanPhone, phoneNumber: formattedPhoneForDb });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setErrorMsg('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (subStep === 1 && name.trim()) {
      setSubStep(2);
    } else if (subStep === 2 && phone.trim().length === 10) {
      handleSendOtp();
    } else if (subStep === 3) {
      handleVerifyOtp();
    }
  };

  const handleOtpChange = (value, index) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const isNameValid = name.trim().length > 0;
  const isPhoneValid = phone.trim().length === 10;
  const isOtpValid = otp.every((digit) => digit !== '');

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      background: '#000000',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      overflowY: 'auto',
      color: '#ffffff',
      WebkitTapHighlightColor: 'transparent'
    }}>
      <div id="recaptcha-container"></div>

      {showInstallGate ? (
        /* ================= PWA WELCOME / INSTALL GATE ================= */
        <motion.div
          key="install-gate"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4 }}
          style={{
            width: '100%',
            maxWidth: '380px',
            padding: '30px 20px',
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxSizing: 'border-box',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: '#000',
            border: '1px solid rgba(56,189,248,0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '20px',
            boxShadow: '0 10px 30px rgba(56,189,248,0.2)',
            overflow: 'hidden'
          }}>
            <img src="/appicon.png" alt="Vortex Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Vortex Secure Messenger</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '30px', lineHeight: '1.5' }}>
            Experience lightning-fast, secure real-time messaging. Install Vortex as an app for the best experience!
          </p>

          <button
            onClick={handleInstallClick}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(56,189,248,0.9), rgba(37,99,235,0.9))',
              border: 'none',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 10px 25px rgba(37, 99, 235, 0.3)',
              marginBottom: '12px',
              transition: 'all 0.3s ease'
            }}
          >
            <Download size={18} /> Install Vortex App
          </button>

          <button
            onClick={handleContinueToBrowser}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '14px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Globe size={16} /> Continue in Browser
          </button>
        </motion.div>
      ) : (
        /* ================= REGULAR LOGIN FLOW ================= */
        <AnimatePresence mode="wait">
          {subStep === 1 && (
            <motion.div
              key="name-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              style={{
                width: '100%',
                maxWidth: '380px',
                padding: '24px 20px',
                borderRadius: '24px',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                boxSizing: 'border-box',
                textAlign: 'left'
              }}
            >
              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>What's your name?</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>Please enter your name to set up your Vortex profile.</p>
              
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '15px',
                  outline: 'none',
                  marginBottom: '20px',
                  boxSizing: 'border-box'
                }}
              />

              <button
                onClick={handleNext}
                disabled={!isNameValid}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  background: isNameValid 
                    ? 'linear-gradient(135deg, rgba(56,189,248,0.9), rgba(37,99,235,0.9))' 
                    : 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: isNameValid ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isNameValid ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isNameValid ? '0 10px 25px rgba(37, 99, 235, 0.3)' : 'none',
                  transition: 'all 0.3s ease',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                Next <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {subStep === 2 && (
            <motion.div
              key="phone-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              style={{
                width: '100%',
                maxWidth: '380px',
                padding: '24px 20px',
                borderRadius: '24px',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                boxSizing: 'border-box',
                textAlign: 'left'
              }}
            >
              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Enter Mobile Number</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>We will send a verification code via SMS.</p>
              
              {errorMsg && <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>{errorMsg}</p>}

              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                padding: '0 14px',
                marginBottom: '20px',
                boxSizing: 'border-box'
              }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginRight: '10px' }}>+91</span>
                <input
                  type="tel"
                  placeholder="Enter your number"
                  maxLength="10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '15px',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                onClick={handleNext}
                disabled={!isPhoneValid || loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  background: isPhoneValid 
                    ? 'linear-gradient(135deg, rgba(56,189,248,0.9), rgba(37,99,235,0.9))' 
                    : 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: isPhoneValid ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isPhoneValid && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isPhoneValid ? '0 10px 25px rgba(37, 99, 235, 0.3)' : 'none',
                  transition: 'all 0.3s ease',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                {loading ? 'Sending...' : 'Send OTP'} <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {subStep === 3 && (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              style={{
                width: '100%',
                maxWidth: '380px',
                padding: '24px 20px',
                borderRadius: '24px',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                boxSizing: 'border-box',
                textAlign: 'left'
              }}
            >
              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>Enter OTP</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>Code sent to +91 {phone}</p>
              
              {errorMsg && <p style={{ fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>{errorMsg}</p>}

              <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', marginBottom: '24px' }}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-input-${index}`}
                    type="text"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, index)}
                    style={{
                      width: '40px',
                      height: '48px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '18px',
                      fontWeight: '600',
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={!isOtpValid || loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  background: isOtpValid 
                    ? 'linear-gradient(135deg, rgba(56,189,248,0.9), rgba(37,99,235,0.9))' 
                    : 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: isOtpValid ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: isOtpValid && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isOtpValid ? '0 10px 25px rgba(37, 99, 235, 0.3)' : 'none',
                  transition: 'all 0.3s ease',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                {loading ? 'Verifying...' : 'Verify & Enter'} <ShieldCheck size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
