import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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
      const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
      if (token) {
        console.log('FCM Token:', token);
        return token;
      } else {
        console.log('No registration token available. Request permission to generate one.');
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
