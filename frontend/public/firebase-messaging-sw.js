importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDrT4xqWq8xIxz9Ye4bBLZ0UztSRFWnx_A",
  authDomain: "rozsewa-b820d.firebaseapp.com",
  projectId: "rozsewa-b820d",
  storageBucket: "rozsewa-b820d.firebasestorage.app",
  messagingSenderId: "755534504530",
  appId: "1:755534504530:web:acbbac4d1067f594def58b",
  measurementId: "G-YZJYCHKNZJ"
});

const messaging = firebase.messaging();

const shownNotifications = new Set();

// Force immediate Service Worker activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const id = payload.data?.notificationId;
  if (id && shownNotifications.has(id)) {
      console.log('Duplicate notification ignored in background:', id);
      return;
  }
  if (id) shownNotifications.add(id);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    tag: payload.data?.notificationId || undefined,
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions)
    .catch((err) => {
      console.error('[firebase-messaging-sw.js] Error showing notification:', err);
    });
});

// Handle background notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  let targetUrl = '/';
  
  if (data) {
    if (data.link) {
      targetUrl = data.link;
    } else if (data.url) {
      targetUrl = data.url;
    } else if (data.type === 'booking' || data.bookingId) {
      if (data.userRole === 'provider') {
        targetUrl = '/provider/bookings';
      } else {
        targetUrl = '/my-bookings';
      }
    } else if (data.type === 'lead' || data.leadId) {
      targetUrl = '/provider/leads';
    }
  }

  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with our origin
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate the existing window and focus it
          return client.navigate(absoluteUrl).then(c => c.focus());
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    })
  );
});
