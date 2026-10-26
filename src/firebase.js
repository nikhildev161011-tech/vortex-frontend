// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAdaOK0IpCDHy56Ep75A0uzcOkRbTLjcSM",
  authDomain: "vortex-df313.firebaseapp.com",
  projectId: "vortex-df313",
  storageBucket: "vortex-df313.firebasestorage.app",
  messagingSenderId: "612575400030",
  appId: "1:612575400030:web:d0686bf87a2961d180a4cf",
  measurementId: "G-6BQT1P7733"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);