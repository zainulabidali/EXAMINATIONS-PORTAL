/**
 * Result Search Logic
 * Validates → Finds Student → Checks Published Result → Redirects
 */

import { db } from "./firebase-init.js";
import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* =========================
   DOM References
========================= */
const institutionSelect = document.getElementById("institutionSelect");
const classIdInput = document.getElementById("classId");
const registerNoInput = document.getElementById("registerNo");
const searchForm = document.getElementById("resultSearchForm");
const searchBtn = document.getElementById("searchBtn");
const msgBox = document.getElementById("searchMessage");

/* =========================
   Helpers
========================= */

function showMessage(text, type = "danger") {
    msgBox.innerHTML = `
        <div class="alert alert-${type} d-flex align-items-center gap-2 mb-0 animate-fade-in" role="alert">
            <i class="fa-solid ${type === "danger" ? "fa-circle-exclamation" : "fa-circle-check"}"></i>
            <span>${text}</span>
        </div>`;
    msgBox.classList.remove("d-none");
}

function clearMessage() {
    msgBox.innerHTML = "";
    msgBox.classList.add("d-none");
}

function setLoading(isLoading) {
    if (isLoading) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Searching...`;
    } else {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `<i class="fa-solid fa-search me-2"></i>Search Result`;
    }
}

/* =========================
   Load Institutions
========================= */

/* =========================
   Validity Helper (mirrors super-admin.js logic — no shared module needed)
   Backward compatible: institutes without date fields use the `active` flag only.
========================= */
function isInstitutionAccessible(data) {
    const manualActive = data.active !== false; // missing field → treated as active
    if (!manualActive) return false;            // manually deactivated → always hidden

    const hasFrom  = !!data.valid_from;
    const hasUntil = !!data.valid_until;
    if (!hasFrom && !hasUntil) return true;     // no date range → old behaviour, just use active flag

    const now   = new Date(); now.setHours(0, 0, 0, 0);
    const from  = hasFrom  ? new Date(data.valid_from)  : null;
    const until = hasUntil ? new Date(data.valid_until) : null;

    const afterFrom   = !from  || now >= from;
    const beforeUntil = !until || now <= until;
    return afterFrom && beforeUntil;
}

async function loadInstitutions() {
    try {
        const snap = await getDocs(collection(db, "institutions"));

        if (snap.empty) {
            institutionSelect.innerHTML = `<option value="" disabled selected>No institutions found</option>`;
            return;
        }

        let added = 0;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            // Only show institutions that are active and within their validity window
            if (!isInstitutionAccessible(data)) return;

            const opt = document.createElement("option");
            opt.value = docSnap.id;
            opt.textContent = data.name || docSnap.id;
            institutionSelect.appendChild(opt);
            added++;
        });

        if (added === 0) {
            institutionSelect.innerHTML = `<option value="" disabled selected>No active institutions available</option>`;
        }
    } catch (err) {
        console.error("Error loading institutions:", err);
        showMessage("Could not load institutions. Please refresh the page.", "danger");
    }
}

/* =========================
   Handle Search Submit
========================= */

if (searchForm) {
    searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessage();

        const institutionId = institutionSelect.value.trim();
        const classId = classIdInput.value.trim();
        const registerNo = registerNoInput.value.trim();

        /* --- Step 1: Validate Inputs --- */
        if (!institutionId || !classId || !registerNo) {
            showMessage("Please fill in all required fields.", "danger");
            return;
        }

        setLoading(true);

        try {
            /* --- Step 2: Find the Student --- */
            const studentQuery = query(
                collection(db, "students"),
                where("institutionId", "==", institutionId),
                where("classId", "==", classId),
                where("registerNo", "==", registerNo)
            );

            const studentSnap = await getDocs(studentQuery);

            if (studentSnap.empty) {
                showMessage(
                    "Student record not found. Please double-check your Class and Register Number.",
                    "danger"
                );
                setLoading(false);
                return;
            }

            const studentId = studentSnap.docs[0].id;

            /* --- Step 3: Check Published Result --- */
            const resultQuery = query(
                collection(db, "results"),
                where("institutionId", "==", institutionId),
                where("studentId", "==", studentId),
                where("published", "==", true)
            );

            const resultSnap = await getDocs(resultQuery);

            if (resultSnap.empty) {
                showMessage(
                    "Result has not been published yet. Please check back later.",
                    "warning"
                );
                setLoading(false);
                return;
            }

            /* --- Step 4: Redirect to Result View --- */
            const params = new URLSearchParams({
                studentId,
                inst: institutionId
            });

            window.location.href = `result-view.html?${params.toString()}`;

        } catch (err) {
            console.error("Search error:", err);
            showMessage(
                "A network error occurred. Please check your connection and try again.",
                "danger"
            );
            setLoading(false);
        }
    });
}

/* =========================
   Init
========================= */
loadInstitutions();
