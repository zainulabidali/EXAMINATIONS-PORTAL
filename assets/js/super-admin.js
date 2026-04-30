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
    updateDoc,
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

/* =========================
   Validity Helper
   Extends existing active logic — fully backward compatible.
   - If valid_from / valid_until are absent → fall back to `active` flag (old behaviour).
   - If dates are present → institute is active only within the date range.
========================= */
function computeEffectiveActive(data) {
    const manualActive = data.active !== false; // old field, treat missing as true
    const now = new Date();
    now.setHours(0, 0, 0, 0); // compare at day boundary

    const hasFrom  = !!data.valid_from;
    const hasUntil = !!data.valid_until;

    if (!hasFrom && !hasUntil) {
        // No date range set — use old manual toggle
        return { effective: manualActive, expired: false };
    }

    const from  = hasFrom  ? new Date(data.valid_from)  : null;
    const until = hasUntil ? new Date(data.valid_until) : null;

    const afterFrom  = !from  || now >= from;
    const beforeUntil = !until || now <= until;
    const inRange = afterFrom && beforeUntil;
    const expired = hasUntil && now > until;

    return { effective: inRange && manualActive, expired };
}

if (instForm) {
    instForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name     = document.getElementById("institutionName").value.trim();
        const email    = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value.trim();
        const validFrom  = document.getElementById("validFrom")?.value  || null;
        const validUntil = document.getElementById("validUntil")?.value || null;
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
            // valid_from / valid_until are optional — only stored when provided
            const instPayload = {
                name: name,
                adminEmail: email,
                adminUid: newUser.uid,
                active: true,
                createdAt: serverTimestamp()
            };
            if (validFrom)  instPayload.valid_from  = validFrom;
            if (validUntil) instPayload.valid_until = validUntil;

            const instRef = await addDoc(collection(db, "institutions"), instPayload);

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

            // --- Validity-aware status (backward compatible) ---
            const { effective: isActive, expired } = computeEffectiveActive(data);

            // Validity range display
            let validityHtml = `<span class="text-muted small">—</span>`;
            if (data.valid_from || data.valid_until) {
                const fmtDate = d => d ? new Date(d).toLocaleDateString() : "∞";
                const rangeLabel = `${fmtDate(data.valid_from)} → ${fmtDate(data.valid_until)}`;
                const rangeClass = expired ? 'text-danger' : 'text-success';
                validityHtml = `<span class="small ${rangeClass} fw-semibold">${rangeLabel}</span>`;
                if (expired) validityHtml += ` <span class="badge bg-danger-subtle text-danger border ms-1" style="font-size:.7rem;">Expired</span>`;
            }

            // Status badge — shows Expired when applicable
            let statusLabel, statusClass;
            if (expired) {
                statusLabel = 'Expired';  statusClass = 'bg-warning text-dark';
            } else if (isActive) {
                statusLabel = 'Active';   statusClass = 'bg-success';
            } else {
                statusLabel = 'Inactive'; statusClass = 'bg-danger';
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="ps-4 fw-bold text-dark">${data.name}</td>
                <td><span class="text-muted small">${data.adminEmail}</span></td>
                <td><span class="badge bg-light text-dark border">${date}</span></td>
                <td>${validityHtml}</td>
                <td>
                    <span class="badge status-badge ${statusClass} me-2">${statusLabel}</span>
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm ${isActive && !expired ? 'btn-outline-warning' : 'btn-outline-success'} toggle-status-btn me-1"
                        title="${isActive && !expired ? 'Deactivate' : 'Activate'}">
                        <i class="fa-solid ${isActive && !expired ? 'fa-ban' : 'fa-check-circle'} me-1"></i>
                        ${isActive && !expired ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${docSnap.id}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

            // Pass the raw manualActive (data.active) to the toggle — not the computed one
            const manualActive = data.active !== false;
            tr.querySelector(".toggle-status-btn").addEventListener("click", () => {
                toggleInstitutionStatus(docSnap.id, manualActive, tr);
            });

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
   Toggle Institution Status
========================= */

async function toggleInstitutionStatus(id, currentlyActive, rowEl) {
    const action = currentlyActive ? "deactivate" : "activate";
    const newActive = !currentlyActive;
    const msg = currentlyActive
        ? "Deactivate this institution? The admin will not be able to log in until reactivated."
        : "Activate this institution? The admin will regain access immediately.";

    if (!confirm(msg)) return;

    const btn = rowEl.querySelector(".toggle-status-btn");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        await updateDoc(doc(db, "institutions", id), { active: newActive });

        // Update badge
        const badge = rowEl.querySelector(".status-badge");
        badge.className = `badge status-badge ${newActive ? 'bg-success' : 'bg-danger'} me-2`;
        badge.textContent = newActive ? 'Active' : 'Inactive';

        // Update button
        btn.className = `btn btn-sm ${newActive ? 'btn-outline-warning' : 'btn-outline-success'} toggle-status-btn me-1`;
        btn.innerHTML = `<i class="fa-solid ${newActive ? 'fa-ban' : 'fa-check-circle'} me-1"></i>${newActive ? 'Deactivate' : 'Activate'}`;
        btn.title = newActive ? 'Deactivate' : 'Activate';
        btn.disabled = false;

        // Re-bind with flipped state
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener("click", () => toggleInstitutionStatus(id, newActive, rowEl));

        Toast.success(`Institution ${newActive ? 'activated' : 'deactivated'} successfully.`);
    } catch (err) {
        console.error("Toggle status error:", err);
        Toast.error(`Failed to ${action} institution.`);
        btn.disabled = false;
        btn.innerHTML = orig;
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
