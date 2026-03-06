/**
 * Super Admin Logic
 */

import { db, auth, app } from "./firebase-init.js";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
    signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signOut as secondarySignOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { Toast } from "./toast-service.js";

const instForm = document.getElementById("addInstitutionForm");
const institutionList = document.getElementById("institutionList");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const totalEl = document.getElementById("totalInstitutions");

/* =========================
   Initialize
========================= */

async function init() {
    await loadInstitutions();
    setupLogout();
}

/* =========================
   Create Institution (Complex Flow)
========================= */

if (instForm) {
    instForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("institutionName").value.trim();
        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value.trim();
        const btn = instForm.querySelector("button");

        if (!name || !email || !password) {
            Toast.error("All fields are required.");
            return;
        }

        if (password.length < 6) {
            Toast.error("Password must be at least 6 characters.");
            return;
        }

        try {
            // UI Loading
            const originalBtn = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

            /**
             * TRICKY PART: Create User without logging out current Super Admin.
             * Solution: Initialize a secondary Firebase App instance.
             */

            // 1. Init Secondary App
            const secondaryApp = initializeApp({
                apiKey: app.options.apiKey,
                authDomain: app.options.authDomain,
                projectId: app.options.projectId
            }, "SecondaryApp");

            const secondaryAuth = getAuth(secondaryApp);

            // 2. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            // 3. Create 'users' doc for Role
            await setDoc(doc(db, "users", newUser.uid), {
                email: email,
                role: "institution",
                createdAt: serverTimestamp()
            });

            // 4. Create 'institutions' doc linked to user
            const instRef = await addDoc(collection(db, "institutions"), {
                name: name,
                adminEmail: email,
                adminUid: newUser.uid,
                createdAt: serverTimestamp()
            });

            // Update user doc with institutionId as well (optional but good for reverse lookup)
            await setDoc(doc(db, "users", newUser.uid), {
                institutionId: instRef.id
            }, { merge: true });

            // 5. Cleanup Secondary App
            await secondarySignOut(secondaryAuth);
            // Delete app not strictly necessary in JS SDK modules as it's GC'd, but good practice if available.
            // There is no explicit deleteApp in modular v9+ easily accessible without importing 'deleteApp' from firebase-app.
            // We'll just let it be.

            Toast.success("Institution Created Successfully!");
            instForm.reset();
            loadInstitutions(); // Refresh list

        } catch (error) {
            console.error("Creation Error:", error);
            if (error.code === 'auth/email-already-in-use') {
                Toast.error("Email is already in use.");
            } else {
                Toast.error("Failed to create institution: " + error.message);
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check me-2"></i> Create Institution';
        }
    });
}

/* =========================
   Load Institutions
========================= */

async function loadInstitutions() {
    try {
        const q = query(collection(db, "institutions"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        institutionList.innerHTML = "";
        loadingState.classList.add("d-none");

        if (snapshot.empty) {
            emptyState.classList.remove("d-none");
            totalEl.textContent = "0";
            return;
        }

        emptyState.classList.add("d-none");
        totalEl.textContent = snapshot.size;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "N/A";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="ps-4 fw-bold text-dark">${data.name}</td>
                <td><span class="text-muted small">${data.adminEmail}</span></td>
                <td><span class="badge bg-light text-dark border">${date}</span></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${docSnap.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

            // Delete Handler
            tr.querySelector(".delete-btn").addEventListener("click", () => deleteInstitution(docSnap.id, tr));

            institutionList.appendChild(tr);
        });

    } catch (error) {
        console.error("Load Error:", error);
        loadingState.classList.add("d-none");
        Toast.error("Failed to load institutions.");
    }
}

/* =========================
   Delete Institution
========================= */

async function deleteInstitution(id, rowEl) {
    if (!confirm("Are you sure? This will delete the institution record ONLY. The Auth user will remain (security limitation without Cloud Functions).")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "institutions", id));
        rowEl.remove();
        Toast.success("Institution deleted.");
        // Adjust count
        totalEl.textContent = Math.max(0, parseInt(totalEl.textContent) - 1);
    } catch (error) {
        console.error("Delete Error:", error);
        Toast.error("Failed to delete.");
    }
}

/* =========================
   Logout
========================= */

function setupLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await signOut(auth);
            window.location.href = "login.html";
        });
    }
}

init();
