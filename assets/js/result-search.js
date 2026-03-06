/**
 * Result Search Logic
 */

import { db } from "./firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { Toast } from "./toast-service.js";

const institutionSelect = document.getElementById("institutionSelect");
const searchForm = document.getElementById("resultSearchForm");

/* =========================
   Initialize
========================= */

async function init() {
    await loadInstitutions();
}

/* =========================
   Load Institutions
========================= */

async function loadInstitutions() {
    try {
        const querySnapshot = await getDocs(collection(db, "institutions"));

        if (querySnapshot.empty) {
            console.warn("No institutions found.");
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = data.name;
            institutionSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading institutions:", error);
        Toast.error("Failed to load institutions. Please refresh.");
    }
}

/* =========================
   Handle Search
========================= */

if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const institutionId = institutionSelect.value;
        const classId = document.getElementById("classId").value.trim();
        const registerNo = document.getElementById("registerNo").value.trim();

        if (!institutionId || !classId || !registerNo) {
            Toast.error("Please fill in all fields.");
            return;
        }

        // Redirect to Result View with params
        const params = new URLSearchParams({
            inst: institutionId,
            class: classId,
            reg: registerNo
        });

        window.location.href = `result-view.html?${params.toString()}`;
    });
}

// Run Init
init();
