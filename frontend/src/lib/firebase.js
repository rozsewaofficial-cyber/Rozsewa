import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyDrT4xqWq8xIxz9Ye4bBLZ0UztSRFWnx_A",
  authDomain: "rozsewa-b820d.firebaseapp.com",
  projectId: "rozsewa-b820d",
  storageBucket: "rozsewa-b820d.firebasestorage.app",
  messagingSenderId: "755534504530",
  appId: "1:755534504530:web:acbbac4d1067f594def58b",
  measurementId: "G-YZJYCHKNZJ"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export const requestForToken = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      let registration;
      if ('serviceWorker' in navigator) {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      }
      const vapidKey = "BKaj1FRPsv0u1cXLSKSpl3VDotbIgrN_pPn_3v7wwowIRshUWm6o1q__yd1FYZMV_k7COJf71bS5PHRZx3FDFPY";
      
      try {
        const token = await getToken(messaging, { 
          vapidKey: vapidKey ? vapidKey.trim() : undefined,
          serviceWorkerRegistration: registration
        });
        if (token) {
          console.log('FCM Token:', token);
          return token;
        } else {
          console.log('No registration token available.');
        }
      } catch (tokenError) {
        if (tokenError.name === 'InvalidAccessError' || (tokenError.message && tokenError.message.includes('applicationServerKey'))) {
          console.warn('VAPID key mismatch detected. Force clearing all subscriptions...');
          try {
            if (registration) {
              await registration.unregister();
            }
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let r of regs) {
              await r.unregister();
            }
            // Aggressively delete Firebase Messaging IndexedDB
            indexedDB.deleteDatabase('firebase-messaging-database');
            
            console.log('Aggressive cleanup finished. Reloading page...');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } catch (clearError) {
            console.error('Failed to clear old subscription:', clearError);
          }
        }
        throw tokenError;
      }
    }
  } catch (error) {
    console.error('An error occurred while retrieving token:', error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
