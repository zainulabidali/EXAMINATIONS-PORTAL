/**
 * Authentication Module
 * Handles Login and Logout Logic
 */

import { auth, db } from "./firebase-init.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

import { Toast } from "./toast-service.js";

const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");

/* =========================
   Login Logic
========================= */

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        const submitBtn = loginForm.querySelector("button");

        if (!email || !password) {
            Toast.error("Please enter email and password");
            return;
        }

        try {
            // Show loading state
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check User Role
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                await signOut(auth);
                throw new Error("No role assigned to this user.");
            }

            const { role } = userDoc.data();

            Toast.success("Login successful! Redirecting...");

            setTimeout(async () => {
                if (role === "super") {
                    window.location.href = "super-dashboard.html";
                } else if (role === "institution") {
                    // Check if institution is active before allowing in
                    const institutionId = userDoc.data().institutionId;
                    if (institutionId) {
                        const instDoc = await getDoc(doc(db, "institutions", institutionId));
                        if (instDoc.exists() && instDoc.data().active === false) {
                            await signOut(auth);
                            Toast.error("Institution account is inactive. Please contact administrator.");
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = "Login";
                            return;
                        }
                    }
                    window.location.href = "institution-dashboard.html";
                } else {
                    // Fallback or unauthorized
                    signOut(auth);
                    Toast.error("Unauthorized role.");
                }
            }, 1000);

        } catch (error) {
            console.error("Login Error:", error);
            let message = "Login failed. Please check your credentials.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = "Invalid email or password.";
            } else if (error.message) {
                message = error.message;
            }
            Toast.error(message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Login"; // Reset button text - assuming original was "Login" or similar
        }
    });
}

/* =========================
   Logout Logic
========================= */

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            Toast.info("Logged out successfully.");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 500);
        } catch (error) {
            console.error("Logout Error:", error);
            Toast.error("Failed to logout.");
        }
    });
}

/**
 * Optional: Redirect if already logged in and on login page
 * This logic is tricky if not handled carefully with role-guard.
 * We'll do a simple check here.
 */
if (window.location.pathname.includes("login.html")) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const { role } = userDoc.data();
                if (role === "super") window.location.replace("super-dashboard.html");
                else if (role === "institution") window.location.replace("institution-dashboard.html");
            }
        }
    });
}
