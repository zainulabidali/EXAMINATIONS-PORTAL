/**
 * Role Guard
 * Protects pages from unauthorized access
 */

import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/**
 * Enforce Role-Based Access Control
 * @param {string} allowedRole - 'super', 'institution', or 'any'
 */
export function requireAuth(allowedRole) {

    // Create a loading overlay
    const overlay = document.createElement('div');
    overlay.id = 'auth-loader';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = '#fff';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    document.body.appendChild(overlay);

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.replace("login.html");
            return;
        }

        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                // No role, invalid user
                window.location.replace("login.html");
                return;
            }

            const { role } = userDoc.data();

            if (allowedRole !== 'any' && role !== allowedRole) {
                // Incorrect role, redirect to correct dashboard
                if (role === 'super') {
                    window.location.replace("super-dashboard.html");
                } else if (role === 'institution') {
                    window.location.replace("institution-dashboard.html");
                } else {
                    window.location.replace("login.html");
                }
                return;
            }

            // If we are here, access is granted
            // Remove loader
            const loader = document.getElementById('auth-loader');
            if (loader) loader.remove();

            // Show body content (optional animation)
            document.body.style.opacity = '1';

        } catch (error) {
            console.error("Auth Guard Error:", error);
            window.location.replace("login.html");
        }
    });
}
