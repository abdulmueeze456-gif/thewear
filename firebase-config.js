// THE WEAR - Firebase Configuration

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7Ku9wnFB_mSYrAj_LF-g4ih89PVXBx48",
  authDomain: "the-wear-192a9.firebaseapp.com",
  projectId: "the-wear-192a9",
  storageBucket: "the-wear-192a9.firebasestorage.app",
  messagingSenderId: "99568699535",
  appId: "1:99568699535:web:acc28bbd349eb043ccc8fa",
  measurementId: "G-JFCT8B358M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export {
  app,
  analytics,
  db,
  auth,
  storage
};
