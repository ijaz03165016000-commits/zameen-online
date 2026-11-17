// =========================================================
//  Firebase settings for Zameen Online
//  1. Go to https://console.firebase.google.com → your project
//  2. Project settings → General → "Your apps" → Web app → copy the config
//  3. Paste the values below and save.
//  While apiKey is empty the site runs in DEMO MODE (sample data
//  saved only in the visitor's own browser).
// =========================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDIqZhgE98R3W3CAGA3uUNia3Lo1D6g40g",
  authDomain: "zameen-online.firebaseapp.com",
  projectId: "zameen-online",
  storageBucket: "zameen-online.firebasestorage.app",
  messagingSenderId: "213309490340",
  appId: "1:213309490340:web:35fe46a8915666377c5231"
};

// Site-wide settings
export const SITE = {
  name: "Zameen Online",
  domain: "www.zameen.online",
  phone: "+92 344 0807888",
  whatsapp: "923440807888",
  email: "info@zameen.online",
  address: "Ijaz Software House, Sector G1/3, Mirpur AJK, Pakistan",
  poweredBy: "Ijaz Software House",
  poweredByUrl: "https://www.ijazs.online"
};

// Ijaz Network cross-promotion ads (public pages only)
if (typeof document !== "undefined" && !/(admin|dashboard|login|post-ad)/.test(location.pathname)) {
  const s = document.createElement("script");
  s.src = "https://www.ijazs.online/ijaz-network-ads.js";
  s.defer = true;
  document.head.appendChild(s);
}
