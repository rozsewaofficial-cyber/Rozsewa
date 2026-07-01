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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const id = payload.data?.notificationId;
  if (id && shownNotifications.has(id)) {
      console.log('Duplicate notification ignored in background:', id);
      return;
  }
  if (id) shownNotifications.add(id);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
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
      targetUrl = '/provider/bookings';
    } else if (data.type === 'lead' || data.leadId) {
      targetUrl = '/provider/leads';
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with our origin
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate the existing window and focus it
          return client.navigate(targetUrl).then(c => c.focus());
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
