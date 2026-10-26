import React, { useState, useEffect } from 'react';
import Splash from './components/Splash';
import Login from './components/Login';
import ChatList from './components/ChatList';

export default function App() {
  const [currentStep, setCurrentStep] = useState('splash');
  const [userData, setUserData] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      name: 'Nikhil Gupta',
      phone: '+91 9044076898',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      about: 'Hey there! I am using Vortex.'
    };
  });

  useEffect(() => {
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    }
  }, [userData]);


  useEffect(() => {
    if (currentStep === 'splash') {
      const timer = setTimeout(() => {
        setCurrentStep('login');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const handleLoginComplete = (data) => {
    setUserData(prev => ({ ...prev, ...data }));
    setCurrentStep('chatlist');
  };

  const handleUpdateUser = (newData) => {
    setUserData(newData);
  };

  const handleLogout = () => {
    setCurrentStep('login');
  };

  if (currentStep === 'splash') {
    return <Splash />;
  }

  if (currentStep === 'login') {
    return <Login onLoginComplete={handleLoginComplete} />;
  }

  if (currentStep === 'chatlist') {
    return <ChatList userData={userData} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />;
  }

  return null;
}