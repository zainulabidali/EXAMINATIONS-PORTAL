/**
 * Institution Admin Logic
 */

import { db, auth } from "./firebase-init.js";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    serverTimestamp,
    orderBy,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { Toast } from "./toast-service.js";

// Global State
let currentInstitutionId = null;
let currentSubjects = [];

/* =========================
   Initialize
========================= */

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById("adminEmailDisplay").textContent = user.email;
        await loadInstitutionId(user.uid);
        if (currentInstitutionId) {
            initDashboard();
        }
    }
});

async function loadInstitutionId(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            currentInstitutionId = userDoc.data().institutionId;

            // Load custom exam types
            const instDoc = await getDoc(doc(db, "institutions", currentInstitutionId));
            if (instDoc.exists() && instDoc.data().examTypes) {
                const examSelect = document.getElementById("globalExamType");
                instDoc.data().examTypes.forEach(ext => {
                    if (![...examSelect.options].some(o => o.value === ext)) {
                        const opt = document.createElement("option");
                        opt.value = ext;
                        opt.textContent = ext;
                        examSelect.appendChild(opt);
                    }
                });
            }
        } else {
            Toast.error("User profile not found.");
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

function initDashboard() {
    generateAcademicYear();
    loadStudents();
    loadSubjects();
    setupEventListeners();
}

function generateAcademicYear() {
    const yearSelect = document.getElementById("globalAcademicYear");
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = "";

    // Auto-generate current and next year based on current date
    const currentDisplay = `${currentYear}-${currentYear + 1}`;
    const currentOpt = document.createElement("option");
    currentOpt.value = currentDisplay;
    currentOpt.textContent = currentDisplay;
    currentOpt.selected = true;
    yearSelect.appendChild(currentOpt);

    const nextDisplay = `${currentYear + 1}-${currentYear + 2}`;
    const nextOpt = document.createElement("option");
    nextOpt.value = nextDisplay;
    nextOpt.textContent = nextDisplay;
    yearSelect.appendChild(nextOpt);
}

function setupEventListeners() {
    // Logout
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });

    // CSV Upload
    document.getElementById("processCsvBtn").addEventListener("click", processCSV);

    // Add Subject bulk details
    const addSubRowBtn = document.getElementById("addSubRowBtn");
    if (addSubRowBtn) addSubRowBtn.addEventListener("click", addBulkSubRow);

    const saveBulkSubjectBtn = document.getElementById("saveBulkSubjectBtn");
    if (saveBulkSubjectBtn) saveBulkSubjectBtn.addEventListener("click", saveBulkSubjects);

    const subModalEl = document.getElementById('addSubjectModal');
    if (subModalEl) {
        subModalEl.addEventListener('show.bs.modal', () => {
            document.getElementById("bulkSubRows").innerHTML = "";
            document.getElementById("bulkSubjectClass").value = "";
            addBulkSubRow(); // Start with 1 row
        });
    }

    const studentModalEl = document.getElementById('addStudentModal');
    if (studentModalEl) {
        studentModalEl.addEventListener('show.bs.modal', (e) => {
            const tbody = document.getElementById("bulkRows");
            if (tbody.children.length === 0) {
                addBulkRow(); // Auto-create first row
            }

            // If triggered by a button with data-class attribute 
            if (e.relatedTarget && e.relatedTarget.dataset.class) {
                const c = e.relatedTarget.dataset.class;
                document.getElementById("bulkClass").value = c;
                document.getElementById("bulkClass").readOnly = true;
            } else {
                document.getElementById("bulkClass").value = "";
                document.getElementById("bulkClass").readOnly = false;
            }
        });

        studentModalEl.addEventListener("hidden.bs.modal", () => {
            document.getElementById("bulkRows").innerHTML = "";
            document.getElementById("bulkClass").value = "";
            updateRowCount();
        });
    }

    const saveBulkBtn = document.getElementById("saveBulkBtn");
    if (saveBulkBtn) saveBulkBtn.addEventListener("click", saveBulkStudents);

    const addRowBtn = document.getElementById("addRowBtn");
    if (addRowBtn) addRowBtn.addEventListener("click", addBulkRow);

    document.getElementById("backToFoldersBtn").addEventListener("click", () => {
        document.getElementById("studentsTableArea").classList.add("d-none");
        document.getElementById("classFoldersArea").classList.remove("d-none");
    });

    document.getElementById("saveExamTypeBtn").addEventListener("click", async () => {
        const val = document.getElementById("newExamTypeInput").value.trim();
        if (!val) return;
        const sel = document.getElementById("globalExamType");
        if ([...sel.options].some(o => o.value === val)) {
            Toast.error("Exam type already exists.");
            return;
        }

        const btn = document.getElementById("saveExamTypeBtn");
        btn.disabled = true;

        try {
            const instRef = doc(db, "institutions", currentInstitutionId);
            const instDoc = await getDoc(instRef);
            let examTypes = ["Annual Exam", "Half Yearly Exam", "Quarterly Exam", "Model Exam"];
            if (instDoc.exists() && instDoc.data().examTypes) {
                examTypes = instDoc.data().examTypes;
            }
            examTypes.push(val);

            await setDoc(instRef, { examTypes: examTypes }, { merge: true });

            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = val;
            sel.appendChild(opt);
            sel.value = val;
            Toast.success("Exam type added & saved globally.");

            const modal = bootstrap.Modal.getInstance(document.getElementById('addExamModal'));
            modal.hide();
            document.getElementById("newExamTypeInput").value = "";
        } catch (e) {
            console.error(e);
            Toast.error("Failed to save exam type.");
        } finally {
            btn.disabled = false;
        }
    });

    // Auto-refresh when Context changes
    document.getElementById("globalAcademicYear").addEventListener("change", () => {
        const area = document.getElementById("marksEntryArea");
        if (area) area.classList.add("d-none");
        loadStudents();
        loadSubjects();
    });

    document.getElementById("globalExamType").addEventListener("change", () => {
        const area = document.getElementById("marksEntryArea");
        if (area) area.classList.add("d-none");
    });

    // Marks Context Events
    document.getElementById("backToMarksFoldersBtn").addEventListener("click", () => {
        document.getElementById("marksEntryArea").classList.add("d-none");
        document.getElementById("marksClassFoldersArea").classList.remove("d-none");
    });
    document.getElementById("saveMarksBtn").addEventListener("click", saveAllMarks);

    // Publish Results
    const publishAllBtn = document.getElementById("publishAllBtn");
    if (publishAllBtn) publishAllBtn.addEventListener("click", () => publishResultsForClass("All"));

    // Save Edit Student
    const saveEditStudentBtn = document.getElementById("saveEditStudentBtn");
    if (saveEditStudentBtn) saveEditStudentBtn.addEventListener("click", saveEditStudent);

    // Bulk Add Students Events

    const addStudentModalEl = document.getElementById("addStudentModal");
    if (addStudentModalEl) {
        addStudentModalEl.addEventListener("show.bs.modal", (e) => {
            const tbody = document.getElementById("bulkRows");
            if (tbody.children.length === 0) {
                addBulkRow(); // Auto-create first row
            }

            // If triggered by a button with data-class attribute (none currently, but good for future)
            if (e.relatedTarget && e.relatedTarget.dataset.class) {
                const c = e.relatedTarget.dataset.class;
                document.getElementById("bulkClass").value = c;
                document.getElementById("bulkClass").readOnly = true;
            } else {
                document.getElementById("bulkClass").value = "";
                document.getElementById("bulkClass").readOnly = false;
            }
        });

        addStudentModalEl.addEventListener("hidden.bs.modal", () => {
            document.getElementById("bulkRows").innerHTML = "";
            document.getElementById("bulkClass").value = "";
            updateRowCount();
        });
    }

    /* =========================
       Students Management
    ========================= */

    async function loadStudents() {
        try {
            const q = query(
                collection(db, "students"),
                where("institutionId", "==", currentInstitutionId)
            );
            const snapshot = await getDocs(q);

            const foldersArea = document.getElementById("classFoldersArea");
            const list = document.getElementById("studentsList");
            const empty = document.getElementById("studentsEmpty");
            foldersArea.innerHTML = "";
            list.innerHTML = "";

            if (snapshot.empty) {
                empty.classList.remove("d-none");
                foldersArea.classList.add("d-none");
                return;
            }
            empty.classList.add("d-none");
            foldersArea.classList.remove("d-none");

            const yearFilter = document.getElementById("globalAcademicYear").value;
            const classGroups = {};

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                // Backwards compatability logic: if doesn't have academicYear, show blindly, else match
                if (data.academicYear && data.academicYear !== yearFilter) return;

                data.id = docSnap.id;
                if (!classGroups[data.classId]) classGroups[data.classId] = [];
                classGroups[data.classId].push(data);
            });

            const sortedClasses = Object.keys(classGroups).sort();
            populateClassDropdowns(sortedClasses);

            if (sortedClasses.length === 0) {
                empty.classList.remove("d-none");
                foldersArea.classList.add("d-none");

                // Also handle Marks and Publish folder empty states
                const marksArea = document.getElementById("marksClassFoldersArea");
                const marksEmpty = document.getElementById("marksFoldersEmpty");
                if (marksArea) {
                    marksArea.classList.add("d-none");
                    marksEmpty.classList.remove("d-none");
                }

                const publishArea = document.getElementById("publishClassFoldersArea");
                const publishEmpty = document.getElementById("publishFoldersEmpty");
                if (publishArea) {
                    publishArea.classList.add("d-none");
                    publishEmpty.classList.remove("d-none");
                }
                return;
            }

            const marksFoldersArea = document.getElementById("marksFoldersList");
            const publishFoldersArea = document.getElementById("publishFoldersList");
            if (marksFoldersArea) marksFoldersArea.innerHTML = "";
            if (publishFoldersArea) publishFoldersArea.innerHTML = "";

            Object.keys(classGroups).sort().forEach(className => {
                const students = classGroups[className];
                const col = document.createElement("div");
                col.className = "col-md-4 col-lg-3";
                col.innerHTML = `
                <div class="card h-100 shadow-sm border-0 class-folder-card" style="cursor: pointer; transition: transform 0.2s;">
                    <div class="card-body text-center p-4">
                        <i class="fa-solid fa-folder-open fa-3x text-primary mb-3"></i>
                        <h5 class="fw-bold mb-1">Class ${className}</h5>
                        <span class="badge bg-light text-dark border">${students.length} Students</span>
                    </div>
                </div>
            `;
                col.querySelector(".class-folder-card").addEventListener("click", () => {
                    openClassFolder(className, students);
                });
                foldersArea.appendChild(col);

                // Populate Marks Entry Class Folders
                if (marksFoldersArea) {
                    const marksCol = document.createElement("div");
                    marksCol.className = "col-md-4 col-lg-3";
                    marksCol.innerHTML = `
                    <div class="card h-100 shadow-sm border-0 class-folder-card" style="cursor: pointer; transition: transform 0.2s;">
                        <div class="card-body text-center p-4">
                            <i class="fa-solid fa-folder-open fa-3x text-primary mb-3"></i>
                            <h5 class="fw-bold mb-1">Class ${className}</h5>
                            <span class="badge bg-light text-dark border">${students.length} Students</span>
                        </div>
                    </div>
                `;
                    marksCol.querySelector(".class-folder-card").addEventListener("click", () => {
                        openMarksFolder(className);
                    });
                    marksFoldersArea.appendChild(marksCol);
                }

                // Populate Publish Results Class Folders
                if (publishFoldersArea) {
                    const publishCol = document.createElement("div");
                    publishCol.className = "col-md-4 col-lg-3";
                    publishCol.innerHTML = `
                    <div class="card h-100 shadow-sm border-0 class-folder-card" style="cursor: pointer; transition: transform 0.2s;">
                        <div class="card-body text-center p-4">
                            <i class="fa-solid fa-folder-open fa-3x text-primary mb-3"></i>
                            <h5 class="fw-bold mb-1">Class ${className}</h5>
                            <span class="badge bg-light text-dark border">${students.length} Students</span>
                        </div>
                    </div>
                `;
                    publishCol.querySelector(".class-folder-card").addEventListener("click", () => {
                        publishResultsForClass(className);
                    });
                    publishFoldersArea.appendChild(publishCol);
                }
            });

        } catch (error) {
            console.error("Load Students Error:", error);
            Toast.error("Failed to load students.");
        }
    }

    function openClassFolder(className, students) {
        document.getElementById("classFoldersArea").classList.add("d-none");
        document.getElementById("studentsTableArea").classList.remove("d-none");
        document.getElementById("currentClassTitle").textContent = `Class ${className}`;

        const addBtn = document.getElementById("contextAddStudentBtn");
        if (addBtn) addBtn.dataset.class = className;

        const list = document.getElementById("studentsList");
        list.innerHTML = "";

        students.forEach(data => {
            const row = document.createElement("tr");
            row.innerHTML = `
            <td class="ps-4 fw-bold text-dark">${data.name}</td>
            <td><span class="font-monospace">${data.registerNo}</span></td>
            <td><span class="badge bg-light text-dark border">${data.classId}</span></td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-info view-student" data-id="${data.id}" title="View Details">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary edit-student" data-id="${data.id}" title="Edit Student">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-student" data-id="${data.id}" title="Delete Student">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

            row.querySelector(".view-student").addEventListener("click", () => viewStudent(data));
            row.querySelector(".edit-student").addEventListener("click", () => editStudent(data));
            row.querySelector(".delete-student").addEventListener("click", () => deleteStudent(data.id, row));
            list.appendChild(row);
        });
    }

    function populateClassDropdowns(classes) {
        const selects = [
            document.getElementById("marksClassSelect"),
            document.getElementById("publishClass"),
            document.getElementById("bulkSubjectClass")
        ];

        selects.forEach(select => {
            if (!select) return;
            // Keep first option
            const first = select.firstElementChild;
            select.innerHTML = '';
            select.appendChild(first);

            classes.sort().forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = c;
                select.appendChild(opt);
            });
        });
    }

    async function processCSV() {
        const fileInput = document.getElementById("csvFile");
        const file = fileInput.files[0];

        if (!file) {
            Toast.error("Please select a CSV file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const rows = text.split("\n").map(r => r.split(","));

            // Basic Validation: Header
            const header = rows[0].map(h => h.trim().toLowerCase());
            if (!header.includes("name") || !header.includes("registerno") || !header.includes("classid")) {
                Toast.error("Invalid CSV format. Header must contain Name, RegisterNo, ClassId");
                return;
            }

            const batch = writeBatch(db);
            let count = 0;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < 3) continue;

                const name = row[header.indexOf("name")].trim();
                const regNo = row[header.indexOf("registerno")].trim();
                const classId = row[header.indexOf("classid")].trim();

                if (!name || !regNo || !classId) continue;

                const docRef = doc(collection(db, "students")); // Auto-ID
                batch.set(docRef, {
                    institutionId: currentInstitutionId,
                    name: name,
                    registerNo: regNo,
                    classId: classId,
                    createdAt: serverTimestamp()
                });
                count++;
            }

            try {
                await batch.commit();
                Toast.success(`Uploaded ${count} students successfully.`);
                const modal = bootstrap.Modal.getInstance(document.getElementById('uploadModal'));
                modal.hide();
                loadStudents();
            } catch (error) {
                console.error(error);
                Toast.error("Upload failed.");
            }
        };
        reader.readAsText(file);
    }

    function viewStudent(student) {
        document.getElementById("viewStudentName").textContent = student.name;
        document.getElementById("viewStudentRegNo").textContent = student.registerNo;
        document.getElementById("viewStudentClass").textContent = student.classId;
        document.getElementById("viewStudentYear").textContent = document.getElementById("globalAcademicYear").value || "N/A";

        const modal = new bootstrap.Modal(document.getElementById('viewStudentModal'));
        modal.show();
    }

    function editStudent(student) {
        document.getElementById("editStudentId").value = student.id;
        document.getElementById("editStudentName").value = student.name;
        document.getElementById("editStudentRegNo").value = student.registerNo;
        document.getElementById("editStudentClass").value = student.classId;

        const modal = new bootstrap.Modal(document.getElementById('editStudentModal'));
        modal.show();
    }

    async function saveEditStudent() {
        const id = document.getElementById("editStudentId").value;
        const name = document.getElementById("editStudentName").value.trim();
        const regNo = document.getElementById("editStudentRegNo").value.trim();
        const classId = document.getElementById("editStudentClass").value.trim();

        if (!name || !regNo || !classId) return Toast.error("All fields are required.");

        const btn = document.getElementById("saveEditStudentBtn");
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

            await updateDoc(doc(db, "students", id), {
                name: name,
                registerNo: regNo,
                classId: classId
            });

            Toast.success("Student updated successfully.");
            const modal = bootstrap.Modal.getInstance(document.getElementById('editStudentModal'));
            modal.hide();

            // Refresh currently opened class if applicable
            loadStudents();
        } catch (e) {
            console.error(e);
            Toast.error("Failed to update student.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    async function deleteStudent(id, row) {
        if (!confirm("Delete this student?")) return;
        try {
            await deleteDoc(doc(db, "students", id));
            row.remove();
            Toast.success("Student deleted.");
        } catch (e) {
            Toast.error("Failed to delete.");
        }
    }

    /* =========================
       Bulk Add Logic
    ========================= */

    function addBulkRow() {
        const tbody = document.getElementById("bulkRows");
        const rowCount = tbody.children.length + 1;

        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td class="text-center text-muted bg-light">${rowCount}</td>
        <td><input type="text" class="form-control form-control-sm border-0 bg-transparent student-name" placeholder="Name" required></td>
        <td><input type="text" class="form-control form-control-sm border-0 bg-transparent student-reg" placeholder="ID / Reg No" required></td>
        <td class="text-center">
            <button type="button" class="btn btn-sm text-danger remove-row"><i class="fa-solid fa-times"></i></button>
        </td>
    `;

        tr.querySelector(".remove-row").addEventListener("click", () => {
            tr.remove();
            updateRowCount();
        });

        tbody.appendChild(tr);
        updateRowCount();
    }

    function updateRowCount() {
        const count = document.getElementById("bulkRows").children.length;
        document.getElementById("rowCountDisplay").textContent = `${count} students`;

        // Re-number rows
        Array.from(document.getElementById("bulkRows").children).forEach((row, index) => {
            row.firstElementChild.textContent = index + 1;
        });
    }

    async function saveBulkStudents() {
        const classId = document.getElementById("bulkClass").value.trim();
        const year = document.getElementById("globalAcademicYear").value;
        const rows = document.querySelectorAll("#bulkRows tr");

        if (!classId) return Toast.error("Class is required.");
        if (rows.length === 0) return Toast.error("Add at least one student.");

        const studentsToAdd = [];
        const regNos = new Set();
        let hasError = false;

        // Client-side Validation
        rows.forEach((row, index) => {
            const nameInput = row.querySelector(".student-name");
            const regInput = row.querySelector(".student-reg");
            const name = nameInput.value.trim();
            const regNo = regInput.value.trim();

            if (!name || !regNo) {
                row.classList.add("table-danger");
                hasError = true;
            } else {
                row.classList.remove("table-danger");
            }

            if (regNos.has(regNo)) {
                Toast.error(`Duplicate Register No '${regNo}' in list.`);
                row.classList.add("table-warning");
                hasError = true;
            }
            regNos.add(regNo);

            studentsToAdd.push({ name, regNo });
        });

        if (hasError) return Toast.error("Please fix errors in the list.");

        const btn = document.getElementById("saveBulkBtn");
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

            // Duplicate Check against DB
            // We can't batch query efficiently for disjoint IDs without many reads.
            // For simplicity and performance in this task, we will try to write and rely on successful batch?
            // No, we should check.
            // Strategy: Fetch all students of this class and check local list against it.
            // This is cheaper than 1 read per student.

            const qCheck = query(
                collection(db, "students"),
                where("institutionId", "==", currentInstitutionId),
                // where("classId", "==", classId) // Optional optimization
                // Actually registerNo should be unique per institution usually.
            );

            // This might be heavy if institution has 10k students.
            // Better: just fetch matching register numbers? Firestore "in" query limited to 10.
            // Let's rely on client side checking against "class" list if we can't query all.
            // Or just let's try to add. Duplicate register numbers are bad but maybe not strictly enforced by unique index in Firestore unless configured.
            // Plan: Check locally against loaded students? No, loaded students might be partial?
            // Let's implement a quick check for at least the Register Nos provided using "in" batches if needed or just proceed if user trusts.
            // Requirement said: "Prevent duplicate identifiers within same class + academicYear" or global?
            // "Prevent duplicate identifiers within same class + academicYear." -> OK scope.

            const qClass = query(
                collection(db, "students"),
                where("institutionId", "==", currentInstitutionId),
                where("classId", "==", classId)
            );

            const existingSnap = await getDocs(qClass);
            const existingRegs = new Set();
            existingSnap.forEach(doc => existingRegs.add(doc.data().registerNo));

            const duplicates = studentsToAdd.filter(s => existingRegs.has(s.regNo));
            if (duplicates.length > 0) {
                Toast.error(`Duplicate IDs found in DB: ${duplicates.map(d => d.regNo).join(", ")}`);
                // Highlight them
                rows.forEach(row => {
                    const reg = row.querySelector(".student-reg").value.trim();
                    if (existingRegs.has(reg)) row.classList.add("table-danger");
                });
                return;
            }

            // Batch Write
            const batch = writeBatch(db);

            studentsToAdd.forEach(s => {
                const docRef = doc(collection(db, "students"));
                batch.set(docRef, {
                    institutionId: currentInstitutionId,
                    name: s.name,
                    registerNo: s.regNo,
                    rollNo: s.regNo, // Using RegNo as RollNo for simplicity if same, or separate? Req says "Identifier".
                    classId: classId,
                    academicYear: year,
                    createdAt: serverTimestamp()
                });
            });

            await batch.commit();
            Toast.success(`Added ${studentsToAdd.length} students.`);

            // Close & Reload
            const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
            modal.hide();
            loadStudents();

        } catch (error) {
            console.error(error);
            Toast.error("Failed to save batch.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    /* =========================
       Subjects Management
    ========================= */

    async function loadSubjects() {
        try {
            const q = query(collection(db, "subjects"), where("institutionId", "==", currentInstitutionId));
            const snapshot = await getDocs(q);

            const foldersArea = document.getElementById("subjectClassFoldersArea");
            const listContainer = document.getElementById("subjectsList");
            const empty = document.getElementById("subjectFoldersEmpty");
            const folderListArea = document.getElementById("subjectFoldersList");

            if (folderListArea) folderListArea.innerHTML = "";
            if (listContainer) listContainer.innerHTML = "";
            currentSubjects = [];

            if (snapshot.empty) {
                if (empty) empty.classList.remove("d-none");
                if (foldersArea) foldersArea.classList.add("d-none");
                return;
            }
            if (empty) empty.classList.add("d-none");
            if (foldersArea) foldersArea.classList.remove("d-none");

            const yearFilter = document.getElementById("globalAcademicYear").value;
            const subjectGroups = {};

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                // Backwards compatibility check
                if (data.academicYear && data.academicYear !== yearFilter) return;

                currentSubjects.push({ id: docSnap.id, ...data });

                if (!subjectGroups[data.classId]) subjectGroups[data.classId] = [];
                subjectGroups[data.classId].push({ id: docSnap.id, ...data });
            });

            const sortedClasses = Object.keys(subjectGroups).sort();

            if (sortedClasses.length === 0) {
                if (empty) empty.classList.remove("d-none");
                if (foldersArea) foldersArea.classList.add("d-none");
                return;
            }

            sortedClasses.forEach(className => {
                const subjects = subjectGroups[className];
                const col = document.createElement("div");
                col.className = "col-md-4 col-lg-3";
                col.innerHTML = `
                <div class="card h-100 shadow-sm border-0 class-folder-card" style="cursor: pointer; transition: transform 0.2s;">
                    <div class="card-body text-center p-4">
                        <i class="fa-solid fa-folder-open fa-3x text-primary mb-3"></i>
                        <h5 class="fw-bold mb-1">Class ${className}</h5>
                        <span class="badge bg-light text-dark border">${subjects.length} Subjects</span>
                    </div>
                </div>
            `;
                col.querySelector(".class-folder-card").addEventListener("click", () => {
                    openSubjectFolder(className, subjects);
                });
                if (folderListArea) folderListArea.appendChild(col);
            });

        } catch (error) {
            console.error("Load Subjects Error:", error);
        }
    }

    function openSubjectFolder(className, subjects) {
        document.getElementById("subjectClassFoldersArea").classList.add("d-none");
        document.getElementById("subjectListViewArea").classList.remove("d-none");
        document.getElementById("currentSubjectClassTitle").textContent = `Class ${className}`;

        const container = document.getElementById("subjectsList");
        container.innerHTML = "";

        if (!subjects || subjects.length === 0) {
            document.getElementById("subjectsEmpty").classList.remove("d-none");
            return;
        }

        document.getElementById("subjectsEmpty").classList.add("d-none");

        subjects.forEach(data => {
            const col = document.createElement("div");
            col.className = "col-md-4 mb-4";
            col.innerHTML = `
            <div class="card h-100 shadow-sm border-0">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="fw-bold mb-1">${data.name}</h6>
                            <span class="badge bg-primary-subtle text-primary">${data.code || 'SUB'}</span>
                        </div>
                        <button class="btn btn-sm text-danger delete-sub" data-id="${data.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="mt-3 small text-muted">
                        <div>Max Marks: <span class="fw-bold text-dark">${data.maxMarks}</span></div>
                        <div>Pass Marks: <span class="fw-bold text-dark">${data.minPass}</span></div>
                    </div>
                </div>
            </div>
        `;
            col.querySelector(".delete-sub").addEventListener("click", () => deleteSubject(data.id, col));
            container.appendChild(col);
        });
    }

    /* =========================
       Bulk Subject Logic
    ========================= */

    function addBulkSubRow() {
        const tbody = document.getElementById("bulkSubRows");
        const rowCount = tbody.children.length + 1;

        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td class="text-center text-muted bg-light">${rowCount}</td>
        <td><input type="text" class="form-control form-control-sm border-0 bg-transparent sub-name" placeholder="Subject Name" required></td>
        <td><input type="text" class="form-control form-control-sm border-0 bg-transparent sub-code" placeholder="Code"></td>
        <td class="text-center">
            <button type="button" class="btn btn-sm text-danger remove-sub-row"><i class="fa-solid fa-times"></i></button>
        </td>
    `;

        tr.querySelector(".remove-sub-row").addEventListener("click", () => {
            tr.remove();
            updateSubRowCount();
        });

        tbody.appendChild(tr);
        updateSubRowCount();
    }

    function updateSubRowCount() {
        const count = document.getElementById("bulkSubRows").children.length;
        document.getElementById("subRowCountDisplay").textContent = `${count} subjects`;
        Array.from(document.getElementById("bulkSubRows").children).forEach((row, index) => {
            row.firstElementChild.textContent = index + 1;
        });
    }

    async function saveBulkSubjects() {
        const classId = document.getElementById("bulkSubjectClass").value.trim();
        const maxMarks = Number(document.getElementById("bulkSubMax").value) || 100;
        const minPass = Number(document.getElementById("bulkSubMin").value) || 35;
        const rows = document.querySelectorAll("#bulkSubRows tr");

        if (!classId) return Toast.error("Class is required.");
        if (rows.length === 0) return Toast.error("Add at least one subject.");

        const subjectsToAdd = [];
        let hasError = false;

        rows.forEach(row => {
            const name = row.querySelector(".sub-name").value.trim();
            const code = row.querySelector(".sub-code").value.trim();
            if (!name) {
                row.classList.add("table-danger");
                hasError = true;
            } else {
                row.classList.remove("table-danger");
            }
            subjectsToAdd.push({ name, code });
        });

        if (hasError) return Toast.error("Please fill in subject names.");

        const btn = document.getElementById("saveBulkSubjectBtn");
        const originalText = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

            const year = document.getElementById("globalAcademicYear").value;
            const batch = writeBatch(db);
            subjectsToAdd.forEach(s => {
                const docRef = doc(collection(db, "subjects"));
                batch.set(docRef, {
                    institutionId: currentInstitutionId,
                    classId: classId,
                    academicYear: year,
                    name: s.name,
                    code: s.code || s.name.substring(0, 3).toUpperCase(),
                    maxMarks: maxMarks,
                    minPass: minPass
                });
            });

            await batch.commit();
            Toast.success(`Added ${subjectsToAdd.length} subjects to Class ${classId}.`);

            const modal = bootstrap.Modal.getInstance(document.getElementById('addSubjectModal'));
            modal.hide();
            loadSubjects();

        } catch (error) {
            console.error(error);
            Toast.error("Failed to save subjects.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    async function deleteSubject(id, el) {
        if (!confirm("Delete subject?")) return;
        try {
            await deleteDoc(doc(db, "subjects", id));
            el.remove();
            loadSubjects(); // Reload dropdowns
        } catch (e) {
            Toast.error("Error deleting.");
        }
    }

    /* =========================
       Marks Entry & Publish State
    ========================= */
    let currentActiveMarksClass = null;

    async function openMarksFolder(classId) {
        if (!classId) return Toast.error("Invalid Class ID.");

        currentActiveMarksClass = classId;
        document.getElementById("marksClassFoldersArea").classList.add("d-none");
        document.getElementById("marksEntryTitle").textContent = `Class ${classId}`;

        // Fetch subjects for this class
        const qSubjects = query(collection(db, "subjects"),
            where("institutionId", "==", currentInstitutionId),
            where("classId", "==", classId)
        );
        // Fetch students exactly for this class
        const qStudents = query(collection(db, "students"),
            where("institutionId", "==", currentInstitutionId),
            where("classId", "==", classId)
        );

        try {
            const [subSnap, stuSnap] = await Promise.all([getDocs(qSubjects), getDocs(qStudents)]);

            if (stuSnap.empty) return Toast.info("No students found in this class.");
            if (subSnap.empty) return Toast.info("No subjects found for this class. Add subjects first.");

            const tableHead = document.getElementById("marksEntryTableHead");
            // Reset head
            tableHead.innerHTML = `
            <th class="ps-4" style="min-width: 150px;">Student Name</th>
            <th style="min-width: 120px;">Register No</th>
        `;

            const subjects = [];
            subSnap.forEach(doc => {
                const d = doc.data();
                d.id = doc.id;
                subjects.push(d);

                // Add column header
                const th = document.createElement("th");
                th.className = "text-center";
                th.style.minWidth = "100px";
                th.innerHTML = `<span class="fw-bold">${d.name}</span> <br> <small class="text-muted fw-normal">Max ${d.maxMarks}</small>`;
                tableHead.appendChild(th);
            });

            const tbody = document.getElementById("marksEntryTableBody");
            tbody.innerHTML = "";

            // Sort students logically if possible
            const students = [];
            stuSnap.forEach(d => students.push({ id: d.id, ...d.data() }));
            students.sort((a, b) => a.registerNo.localeCompare(b.registerNo));

            students.forEach(student => {
                const tr = document.createElement("tr");

                let html = `
                <td class="ps-4 fw-bold">${student.name}</td>
                <td class="font-monospace">${student.registerNo}</td>
            `;

                subjects.forEach(sub => {
                    html += `
                    <td>
                        <input type="number" class="form-control mark-input text-center fw-bold text-primary" 
                            data-student="${student.id}" 
                            data-subject="${sub.id}"
                            data-subject-name="${sub.name}"
                            data-subject-code="${sub.code}"
                            data-subject-max="${sub.maxMarks}"
                            data-subject-min="${sub.minPass}"
                            min="0" max="${sub.maxMarks}" placeholder="-">
                    </td>
                `;
                });

                tr.innerHTML = html;
                tbody.appendChild(tr);
            });

            document.getElementById("marksEntryArea").classList.remove("d-none");

        } catch (error) {
            console.error(error);
            Toast.error("Error loading matrix.");
        }
    }

    async function saveAllMarks() {
        const classId = currentActiveMarksClass;
        if (!classId) return Toast.error("No active class selected.");
        const year = document.getElementById("globalAcademicYear").value;
        const examType = document.getElementById("globalExamType").value;
        const inputs = document.querySelectorAll(".mark-input");

        if (inputs.length === 0) return;

        const batch = writeBatch(db);
        let count = 0;

        // Group inputs by student
        const studentMarks = {};
        inputs.forEach(input => {
            if (input.value === "") return;

            const studentId = input.dataset.student;
            if (!studentMarks[studentId]) studentMarks[studentId] = {};

            studentMarks[studentId][input.dataset.subject] = {
                name: input.dataset.subjectName,
                code: input.dataset.subjectCode || input.dataset.subjectName.substring(0, 3).toUpperCase(),
                maxMarks: Number(input.dataset.subjectMax),
                minPass: Number(input.dataset.subjectMin),
                obtained: Number(input.value)
            };
            count++;
        });

        if (count === 0) return Toast.info("No marks entered.");

        Object.keys(studentMarks).forEach(studentId => {
            const resultRef = doc(db, "results", `${studentId}_${year}_${examType.replace(/\s+/g, '')}`);

            const subjectsPayload = {};
            Object.entries(studentMarks[studentId]).forEach(([subId, data]) => {
                subjectsPayload[`subjects.${subId}`] = data;
            });

            batch.set(resultRef, {
                institutionId: currentInstitutionId,
                studentId: studentId,
                academicYear: year,
                examType: examType,
                classId: classId,
                ...subjectsPayload,
                published: false // Default to false until explicitly published
            }, { merge: true });
        });

        try {
            const btn = document.getElementById("saveMarksBtn");
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Saving...';

            await batch.commit();
            Toast.success(`Saved marks for ${Object.keys(studentMarks).length} students.`);

            // Don't reset to let them verify or keep working.
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-save me-2"></i> Save All';
            }, 1000);

        } catch (error) {
            console.error(error);
            Toast.error("Failed to save marks.");
        }
    }

    /* =========================
       Publish Results
    ========================= */

    async function publishResultsForClass(classId) {
        const msg = classId === "All"
            ? "Are you sure you want to publish results for ALL classes? This makes them instantly visible to students."
            : `Are you sure you want to publish results for Class ${classId}?`;

        if (!confirm(msg)) return;

        const year = document.getElementById("globalAcademicYear").value;
        const examType = document.getElementById("globalExamType").value;

        try {
            let q = query(
                collection(db, "results"),
                where("institutionId", "==", currentInstitutionId),
                where("academicYear", "==", year),
                where("examType", "==", examType)
            );

            if (classId !== "All") {
                q = query(q, where("classId", "==", classId));
            }

            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                Toast.info(`No results found to publish for ${classId === "All" ? "any class" : "Class " + classId}.`);
                return;
            }

            const batch = writeBatch(db);
            snapshot.forEach(docSnap => {
                batch.update(docSnap.ref, { published: true });
            });

            const btn = document.getElementById("publishAllBtn");
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Publishing...';
            btn.disabled = true;

            await batch.commit();
            Toast.success(`Published ${snapshot.size} result records.`);

            setTimeout(() => {
                btn.innerHTML = origHTML;
                btn.disabled = false;
            }, 1000);

        } catch (error) {
            console.error("Publish Error:", error);
            Toast.error("Failed to publish results.");
        }
    }
}
