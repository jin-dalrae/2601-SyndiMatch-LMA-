/**
 * SyndiMatch - Firebase Configuration
 * Initialize Firebase and Analytics (ES6 Modules)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfraW_KG09G-2ZKxGeT0ZRxddmpVb3h1c",
  authDomain: "syndimatch-7383b.firebaseapp.com",
  projectId: "syndimatch-7383b",
  storageBucket: "syndimatch-7383b.firebasestorage.app",
  messagingSenderId: "1011670881566",
  appId: "1:1011670881566:web:95fc13b4668439ea59a50f",
  measurementId: "G-ZWCSTGBSP4"
};

// Initialize Firebase
let app = null;
let analytics = null;

try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  console.log('✅ Firebase initialized with Analytics');
  
  window.FirebaseApp = app;
  window.FirebaseAnalytics = analytics;
} catch (error) {
  console.warn('⚠️ Firebase initialization failed:', error);
}

// Helper function to log events
function logEvent(eventName, eventParams = {}) {
  if (analytics) {
    try {
      analytics.logEvent(eventName, eventParams);
    } catch (error) {
      console.log('📊 Analytics Event:', eventName, eventParams);
    }
  } else {
    console.log('📊 Analytics Event:', eventName, eventParams);
  }
}

// Track common SyndiMatch events
const Analytics = {
  // Syndication events
  syndicationViewed: (syndId) => logEvent('syndication_viewed', { syndication_id: syndId }),
  syndicationCreated: (syndId) => logEvent('syndication_created', { syndication_id: syndId }),
  bidPlaced: (syndId, amount) => logEvent('bid_placed', { syndication_id: syndId, amount }),
  
  // User actions
  roleSwitched: (role) => logEvent('role_switched', { role }),
  viewChanged: (view) => logEvent('view_changed', { view }),
  
  // Payment events
  paymentInitiated: (paymentId, amount) => logEvent('payment_initiated', { payment_id: paymentId, amount }),
  paymentCompleted: (paymentId, amount) => logEvent('payment_completed', { payment_id: paymentId, amount }),
  
  // General
  pageView: (pageName) => logEvent('page_view', { page_name: pageName }),
  error: (errorMessage) => logEvent('error', { error_message: errorMessage })
};

window.Analytics = Analytics;

