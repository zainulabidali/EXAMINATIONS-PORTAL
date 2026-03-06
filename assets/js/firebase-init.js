/**
 * Firebase Initialization (Modular v12)
 * Production Ready
 * No inline usage
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";

/* =========================
   Firebase Configuration
========================= */

const firebaseConfig = {
    apiKey: "AIzaSyA21-AAI-LWQG-RqnTxkoOFQwmS31D2gnc",
    authDomain: "public-result-portal.firebaseapp.com",
    projectId: "public-result-portal",
    storageBucket: "public-result-portal.firebasestorage.app",
    messagingSenderId: "648662327663",
    appId: "1:648662327663:web:f532bfbbef4fb7619ac89a",
    measurementId: "G-G1FGY01ZR8"
};

/* =========================
   Initialize App
========================= */

const app = initializeApp(firebaseConfig);

/* =========================
   Initialize Services
========================= */

const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

/* =========================
   Export Services
========================= */

export {
    app,
    auth,
    db,
    analytics
};
