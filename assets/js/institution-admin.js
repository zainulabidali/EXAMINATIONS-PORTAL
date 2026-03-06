/**
 * Institution Admin — Clean Rebuild
 * Modular, simple, reliable.
 */

import { db, auth } from "./firebase-init.js";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { Toast } from "./toast-service.js";

/* ============================================================
   GLOBAL STATE
   ============================================================ */
let currentInstitutionId = null;

function getAcademicYear() {
    return document.getElementById("globalAcademicYear").value;
}
function getExamType() {
    return document.getElementById("globalExamType").value;
}

/* ============================================================
   BOOT
   ============================================================ */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById("adminEmailDisplay").textContent = user.email;
        await loadInstitutionId(user.uid);
        if (currentInstitutionId) {
            initApp();
        }
    }
});

async function loadInstitutionId(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists()) {
            Toast.error("User profile not found.");
            return;
        }
        currentInstitutionId = userDoc.data().institutionId;

        // Load custom exam types saved in the institution document
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
    } catch (err) {
        console.error("loadInstitutionId:", err);
        Toast.error("Failed to load user profile.");
    }
}

function initApp() {
    generateAcademicYears();
    setupGlobalListeners();
    loadStudentFolders();
    loadSubjectFolders();
    loadMarksFolders();
    loadPublishFolders();
}

/* ============================================================
   SETTINGS — Academic Year & Exam Type
   ============================================================ */
function generateAcademicYears() {
    const sel = document.getElementById("globalAcademicYear");
    const year = new Date().getFullYear();
    sel.innerHTML = "";
    [-1, 0, 1].forEach(offset => {
        const y = year + offset;
        const opt = document.createElement("option");
        opt.value = `${y}-${y + 1}`;
        opt.textContent = `${y}-${y + 1}`;
        if (offset === 0) opt.selected = true;
        sel.appendChild(opt);
    });
}

function setupGlobalListeners() {
    // Logout
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "login.html";
    });

    // Academic Year change → reload everything
    document.getElementById("globalAcademicYear").addEventListener("change", () => {
        resetAllViews();
        loadStudentFolders();
        loadSubjectFolders();
        loadMarksFolders();
        loadPublishFolders();
    });

    // Exam Type change → reload marks & publish (subjects/students aren't filtered by examType)
    document.getElementById("globalExamType").addEventListener("change", () => {
        resetMarksView();
        loadMarksFolders();
        loadPublishFolders();
    });

    // Add Exam Type
    document.getElementById("saveExamTypeBtn").addEventListener("click", saveNewExamType);

    // Students
    document.getElementById("backToFoldersBtn").addEventListener("click", backToStudentFolders);
    document.getElementById("addRowBtn").addEventListener("click", addStudentRow);
    document.getElementById("saveBulkBtn").addEventListener("click", saveBulkStudents);
    document.getElementById("saveEditStudentBtn").addEventListener("click", saveEditStudent);

    // Student modal lifecycle
    const studentModal = document.getElementById("addStudentModal");
    studentModal.addEventListener("show.bs.modal", e => {
        resetStudentModal();
        const classCtx = e.relatedTarget?.dataset?.class || "";
        if (classCtx) {
            document.getElementById("bulkClass").value = classCtx;
            document.getElementById("bulkClass").readOnly = true;
        }
        addStudentRow(); // first row
    });
    studentModal.addEventListener("hidden.bs.modal", resetStudentModal);

    // Subjects
    document.getElementById("backToSubjectFoldersBtn").addEventListener("click", backToSubjectFolders);
    document.getElementById("addSubRowBtn").addEventListener("click", addSubjectRow);
    document.getElementById("saveBulkSubjectBtn").addEventListener("click", saveBulkSubjects);

    // Subject modal lifecycle
    const subjectModal = document.getElementById("addSubjectModal");
    subjectModal.addEventListener("show.bs.modal", e => {
        resetSubjectModal();
        const classCtx = e.relatedTarget?.dataset?.class || "";
        if (classCtx) {
            const sel = document.getElementById("bulkSubjectClass");
            sel.value = classCtx;
            sel.disabled = true;
        }
        addSubjectRow(); // first row
    });
    subjectModal.addEventListener("hidden.bs.modal", resetSubjectModal);

    // Marks
    document.getElementById("backToMarksFoldersBtn").addEventListener("click", backToMarksFolders);
    document.getElementById("saveMarksBtn").addEventListener("click", saveAllMarks);

    // Publish
    document.getElementById("publishAllBtn").addEventListener("click", () => publishClass("All"));

    // Subjects — Edit
    document.getElementById("saveEditSubjectBtn").addEventListener("click", saveEditSubject);
}

/* ============================================================
   HELPER — Reset all folder views when context changes
   ============================================================ */
function resetAllViews() {
    backToStudentFolders();
    backToSubjectFolders();
    resetMarksView();
}

function resetMarksView() {
    document.getElementById("marksEntryArea").classList.add("d-none");
    document.getElementById("marksClassFoldersArea").classList.remove("d-none");
}

/* ============================================================
   SETTINGS — Save New Exam Type
   ============================================================ */
async function saveNewExamType() {
    const val = document.getElementById("newExamTypeInput").value.trim();
    if (!val) return Toast.error("Please enter an exam type name.");

    const sel = document.getElementById("globalExamType");
    if ([...sel.options].some(o => o.value === val)) {
        return Toast.error("Exam type already exists.");
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
        if (!examTypes.includes(val)) examTypes.push(val);

        await setDoc(instRef, { examTypes }, { merge: true });

        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        sel.appendChild(opt);
        sel.value = val;

        Toast.success("Exam type added.");
        bootstrap.Modal.getInstance(document.getElementById("addExamModal")).hide();
        document.getElementById("newExamTypeInput").value = "";
    } catch (err) {
        console.error(err);
        Toast.error("Failed to save exam type.");
    } finally {
        btn.disabled = false;
    }
}

/* ============================================================
   STUDENTS — Folder View
   ============================================================ */
async function loadStudentFolders() {
    const area = document.getElementById("classFoldersArea");
    area.innerHTML = `<div class="col-12 text-center py-4"><span class="spinner-border text-primary"></span></div>`;

    try {
        const snap = await getDocs(query(
            collection(db, "students"),
            where("institutionId", "==", currentInstitutionId),
            where("academicYear", "==", getAcademicYear())
        ));

        // Group by class
        const groups = {};
        snap.forEach(d => {
            const data = d.data();
            if (!groups[data.classId]) groups[data.classId] = [];
            groups[data.classId].push({ id: d.id, ...data });
        });

        area.innerHTML = "";
        const classes = Object.keys(groups).sort();

        if (classes.length === 0) {
            area.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fa-solid fa-folder-open fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No students found for the selected academic year.<br>
                    Click <strong>Add Students</strong> to get started.</p>
                </div>`;
            // Also update subject class dropdown
            populateSubjectClassDropdown([]);
            return;
        }

        classes.forEach(cls => {
            const students = groups[cls];
            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-3";
            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm class-folder-card" style="cursor:pointer;transition:transform .15s;">
                    <div class="card-body text-center p-4">
                        <i class="fa-solid fa-folder-open fa-3x text-warning mb-3"></i>
                        <h6 class="fw-bold mb-1">${cls}</h6>
                        <span class="badge bg-primary-subtle text-primary border">${students.length} Student${students.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>`;
            col.querySelector(".class-folder-card").addEventListener("click", () => openStudentList(cls, students));
            col.querySelector(".class-folder-card").addEventListener("mouseenter", e => e.currentTarget.style.transform = "translateY(-4px)");
            col.querySelector(".class-folder-card").addEventListener("mouseleave", e => e.currentTarget.style.transform = "");
            area.appendChild(col);
        });

        // Populate subject class dropdown with the available classes
        populateSubjectClassDropdown(classes);

    } catch (err) {
        console.error(err);
        area.innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load students.</div></div>`;
    }
}

function openStudentList(className, students) {
    document.getElementById("classFoldersArea").classList.add("d-none");
    document.getElementById("studentsTableArea").classList.remove("d-none");
    document.getElementById("currentClassTitle").textContent = className;

    // Set context for "Add Students" button inside the table view
    document.getElementById("contextAddStudentBtn").dataset.class = className;

    renderStudentTable(className, students);
}

function renderStudentTable(className, students) {
    const tbody = document.getElementById("studentsList");
    const empty = document.getElementById("studentsEmpty");
    tbody.innerHTML = "";

    if (!students || students.length === 0) {
        empty.classList.remove("d-none");
        return;
    }
    empty.classList.add("d-none");

    students.sort((a, b) => (a.registerNo || "").localeCompare(b.registerNo || ""));

    students.forEach(data => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="ps-4 fw-semibold">${escHtml(data.name)}</td>
            <td><span class="font-monospace small">${escHtml(data.registerNo)}</span></td>
            <td class="text-end pe-3">
                <button class="btn btn-sm btn-outline-primary me-1 btn-edit" title="Edit">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-delete" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>`;
        tr.querySelector(".btn-edit").addEventListener("click", () => openEditStudentModal(data));
        tr.querySelector(".btn-delete").addEventListener("click", () => deleteStudent(data.id, tr, className));
        tbody.appendChild(tr);
    });
}

function backToStudentFolders() {
    document.getElementById("studentsTableArea").classList.add("d-none");
    document.getElementById("classFoldersArea").classList.remove("d-none");
}

/* ============================================================
   STUDENTS — Bulk Add Modal
   ============================================================ */
function resetStudentModal() {
    document.getElementById("bulkRows").innerHTML = "";
    document.getElementById("bulkClass").value = "";
    document.getElementById("bulkClass").readOnly = false;
    updateStudentRowCount();
}

function addStudentRow() {
    const tbody = document.getElementById("bulkRows");
    const tr = document.createElement("tr");
    const rowNum = tbody.children.length + 1;
    tr.innerHTML = `
        <td class="text-center text-muted small bg-light fw-bold align-middle">${rowNum}</td>
        <td><input type="text" class="form-control form-control-sm stu-name" placeholder="Student Full Name" autocomplete="off"></td>
        <td><input type="text" class="form-control form-control-sm stu-reg" placeholder="Register / Roll No" autocomplete="off"></td>
        <td class="text-center align-middle">
            <button type="button" class="btn btn-sm btn-outline-danger remove-row">
                <i class="fa-solid fa-times"></i>
            </button>
        </td>`;
    tr.querySelector(".remove-row").addEventListener("click", () => {
        tr.remove();
        renumberStudentRows();
    });
    tbody.appendChild(tr);
    updateStudentRowCount();
    tr.querySelector(".stu-name").focus();
}

function renumberStudentRows() {
    [...document.getElementById("bulkRows").children].forEach((row, i) => {
        row.firstElementChild.textContent = i + 1;
    });
    updateStudentRowCount();
}

function updateStudentRowCount() {
    const count = document.getElementById("bulkRows").children.length;
    const el = document.getElementById("rowCountDisplay");
    if (el) el.textContent = `${count} student${count !== 1 ? "s" : ""}`;
}

async function saveBulkStudents() {
    const classId = document.getElementById("bulkClass").value.trim();
    const year = getAcademicYear();
    const rows = [...document.getElementById("bulkRows").children];

    if (!classId) return Toast.error("Class name is required.");
    if (rows.length === 0) return Toast.error("Add at least one student row.");

    // Collect & validate
    const toAdd = [];
    const localRegs = new Set();
    let hasError = false;

    rows.forEach(row => {
        const nameEl = row.querySelector(".stu-name");
        const regEl = row.querySelector(".stu-reg");
        const name = nameEl.value.trim();
        const reg = regEl.value.trim();

        row.classList.remove("table-danger", "table-warning");

        if (!name || !reg) {
            row.classList.add("table-danger");
            hasError = true;
            return;
        }
        if (localRegs.has(reg.toLowerCase())) {
            row.classList.add("table-warning");
            Toast.error(`Duplicate register number in form: ${reg}`);
            hasError = true;
            return;
        }
        localRegs.add(reg.toLowerCase());
        toAdd.push({ name, reg });
    });

    if (hasError) return Toast.error("Please fix the highlighted rows.");
    if (toAdd.length === 0) return Toast.error("No valid students to save.");

    const btn = document.getElementById("saveBulkBtn");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

    try {
        // Check for existing register numbers in this class (Firestore duplicate check)
        const existing = await getDocs(query(
            collection(db, "students"),
            where("institutionId", "==", currentInstitutionId),
            where("classId", "==", classId),
            where("academicYear", "==", year)
        ));
        const existingRegs = new Set();
        existing.forEach(d => existingRegs.add((d.data().registerNo || "").toLowerCase()));

        const duplicates = toAdd.filter(s => existingRegs.has(s.reg.toLowerCase()));
        if (duplicates.length > 0) {
            // Highlight duplicates
            rows.forEach(row => {
                const reg = row.querySelector(".stu-reg")?.value.trim().toLowerCase();
                if (existingRegs.has(reg)) row.classList.add("table-danger");
            });
            return Toast.error(`Already exist in class: ${duplicates.map(d => d.reg).join(", ")}`);
        }

        // Batch write
        const batch = writeBatch(db);
        toAdd.forEach(s => {
            const ref = doc(collection(db, "students"));
            batch.set(ref, {
                institutionId: currentInstitutionId,
                name: s.name,
                registerNo: s.reg,
                classId: classId,
                academicYear: year,
                createdAt: serverTimestamp()
            });
        });
        await batch.commit();
        Toast.success(`Saved ${toAdd.length} student${toAdd.length !== 1 ? "s" : ""} to ${classId}.`);
        bootstrap.Modal.getInstance(document.getElementById("addStudentModal")).hide();
        loadStudentFolders();
        loadMarksFolders();
        loadPublishFolders();

    } catch (err) {
        console.error(err);
        Toast.error("Failed to save students.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

/* ============================================================
   STUDENTS — Edit Student
   ============================================================ */
function openEditStudentModal(student) {
    document.getElementById("editStudentId").value = student.id;
    document.getElementById("editStudentName").value = student.name;
    document.getElementById("editStudentRegNo").value = student.registerNo;
    document.getElementById("editStudentClass").value = student.classId;
    new bootstrap.Modal(document.getElementById("editStudentModal")).show();
}

async function saveEditStudent() {
    const id = document.getElementById("editStudentId").value;
    const name = document.getElementById("editStudentName").value.trim();
    const regNo = document.getElementById("editStudentRegNo").value.trim();
    const classId = document.getElementById("editStudentClass").value.trim();

    if (!name || !regNo || !classId) return Toast.error("All fields are required.");

    const btn = document.getElementById("saveEditStudentBtn");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

    try {
        await updateDoc(doc(db, "students", id), { name, registerNo: regNo, classId });
        Toast.success("Student updated.");
        bootstrap.Modal.getInstance(document.getElementById("editStudentModal")).hide();
        loadStudentFolders();
        loadMarksFolders();
    } catch (err) {
        console.error(err);
        Toast.error("Failed to update student.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

async function deleteStudent(id, row, className) {
    if (!confirm(`Delete this student from ${className}?`)) return;
    try {
        await deleteDoc(doc(db, "students", id));
        row.remove();
        Toast.success("Student deleted.");
        loadStudentFolders(); // Refresh folder counts
    } catch (err) {
        Toast.error("Failed to delete student.");
    }
}

/* ============================================================
   SUBJECTS — Folder View
   ============================================================ */
function populateSubjectClassDropdown(classes) {
    const sel = document.getElementById("bulkSubjectClass");
    if (!sel) return;
    sel.innerHTML = `<option value="">Choose Class…</option>`;
    classes.sort().forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
}

async function loadSubjectFolders() {
    const area = document.getElementById("subjectFoldersList");
    if (!area) return;
    area.innerHTML = `<div class="col-12 text-center py-4"><span class="spinner-border text-primary"></span></div>`;
    const empty = document.getElementById("subjectFoldersEmpty");

    try {
        const snap = await getDocs(query(
            collection(db, "subjects"),
            where("institutionId", "==", currentInstitutionId)
        ));

        const groups = {};
        const year = getAcademicYear();
        snap.forEach(d => {
            const data = d.data();
            // Filter by academic year if stored, else include for backwards compatibility
            if (data.academicYear && data.academicYear !== year) return;
            if (!groups[data.classId]) groups[data.classId] = [];
            groups[data.classId].push({ id: d.id, ...data });
        });

        area.innerHTML = "";
        const classes = Object.keys(groups).sort();

        if (classes.length === 0) {
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");

        classes.forEach(cls => {
            const subjects = groups[cls];
            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-3";
            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm class-folder-card" style="cursor:pointer;transition:transform .15s;">
                    <div class="card-body text-center p-4">
                        <i class="fa-solid fa-folder-open fa-3x text-success mb-3"></i>
                        <h6 class="fw-bold mb-1">${cls}</h6>
                        <span class="badge bg-success-subtle text-success border">${subjects.length} Subject${subjects.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>`;
            col.querySelector(".class-folder-card").addEventListener("click", () => openSubjectList(cls, subjects));
            col.querySelector(".class-folder-card").addEventListener("mouseenter", e => e.currentTarget.style.transform = "translateY(-4px)");
            col.querySelector(".class-folder-card").addEventListener("mouseleave", e => e.currentTarget.style.transform = "");
            area.appendChild(col);
        });

    } catch (err) {
        console.error(err);
        area.innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load subjects.</div></div>`;
    }
}

function openSubjectList(className, subjects) {
    document.getElementById("subjectClassFoldersArea").classList.add("d-none");
    document.getElementById("subjectListViewArea").classList.remove("d-none");
    document.getElementById("currentSubjectClassTitle").textContent = className;

    // Set context for "Add Subject" button inside list view
    document.getElementById("contextAddSubjectBtn").dataset.class = className;

    renderSubjectList(subjects);
}

function renderSubjectList(subjects) {
    const container = document.getElementById("subjectsList");
    const empty = document.getElementById("subjectsEmpty");
    container.innerHTML = "";

    if (!subjects || subjects.length === 0) {
        empty.classList.remove("d-none");
        return;
    }
    empty.classList.add("d-none");

    subjects.forEach(data => {
        const col = document.createElement("div");
        col.className = "col-sm-6 col-lg-4 mb-3";
        col.innerHTML = `
            <div class="card h-100 border-0 subject-card" style="border-radius:14px;transition:transform .15s,box-shadow .15s;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold mb-1">${escHtml(data.name)}</h6>
                            <span class="badge bg-primary-subtle text-primary">${escHtml(data.code || "—")}</span>
                        </div>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-outline-primary btn-edit-sub" title="Edit subject">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-delete-sub" title="Delete subject">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="mt-3 pt-2 border-top small text-muted row g-0">
                        <div class="col-6">Max Marks <strong class="text-dark d-block">${data.maxMarks}</strong></div>
                        <div class="col-6">Pass Marks <strong class="text-dark d-block">${data.minPass}</strong></div>
                    </div>
                </div>
            </div>`;
        const card = col.querySelector(".subject-card");
        card.addEventListener("mouseenter", () => { card.style.transform = "translateY(-3px)"; card.style.boxShadow = "0 8px 20px rgba(0,0,0,.10)"; });
        card.addEventListener("mouseleave", () => { card.style.transform = ""; card.style.boxShadow = ""; });
        col.querySelector(".btn-edit-sub").addEventListener("click", () => openEditSubjectModal(data));
        col.querySelector(".btn-delete-sub").addEventListener("click", () => deleteSubject(data.id, col, data.classId));
        container.appendChild(col);
    });
}

function backToSubjectFolders() {
    document.getElementById("subjectListViewArea").classList.add("d-none");
    document.getElementById("subjectClassFoldersArea").classList.remove("d-none");
}

/* ============================================================
   SUBJECTS — Bulk Add Modal
   ============================================================ */
function resetSubjectModal() {
    document.getElementById("bulkSubRows").innerHTML = "";
    document.getElementById("bulkSubjectClass").value = "";
    document.getElementById("bulkSubjectClass").disabled = false;
    document.getElementById("bulkSubMax").value = "100";
    document.getElementById("bulkSubMin").value = "35";
    updateSubjectRowCount();
}

function addSubjectRow() {
    const tbody = document.getElementById("bulkSubRows");
    const tr = document.createElement("tr");
    const rowNum = tbody.children.length + 1;
    tr.innerHTML = `
        <td class="text-center text-muted small bg-light fw-bold align-middle">${rowNum}</td>
        <td><input type="text" class="form-control form-control-sm sub-name" placeholder="Subject Name" autocomplete="off" required></td>
        <td><input type="text" class="form-control form-control-sm sub-code" placeholder="Code (e.g. ENG)" autocomplete="off"></td>
        <td class="text-center align-middle">
            <button type="button" class="btn btn-sm btn-outline-danger remove-sub-row">
                <i class="fa-solid fa-times"></i>
            </button>
        </td>`;
    tr.querySelector(".remove-sub-row").addEventListener("click", () => {
        tr.remove();
        renumberSubjectRows();
    });
    tbody.appendChild(tr);
    updateSubjectRowCount();
    tr.querySelector(".sub-name").focus();
}

function renumberSubjectRows() {
    [...document.getElementById("bulkSubRows").children].forEach((row, i) => {
        row.firstElementChild.textContent = i + 1;
    });
    updateSubjectRowCount();
}

function updateSubjectRowCount() {
    const count = document.getElementById("bulkSubRows").children.length;
    const el = document.getElementById("subRowCountDisplay");
    if (el) el.textContent = `${count} subject${count !== 1 ? "s" : ""}`;
}

async function saveBulkSubjects() {
    const classId = document.getElementById("bulkSubjectClass").value.trim();
    const maxMarks = Number(document.getElementById("bulkSubMax").value) || 100;
    const minPass = Number(document.getElementById("bulkSubMin").value) || 35;
    const rows = [...document.getElementById("bulkSubRows").children];

    if (!classId) return Toast.error("Please select a class.");
    if (rows.length === 0) return Toast.error("Add at least one subject row.");

    const toAdd = [];
    let hasError = false;

    rows.forEach(row => {
        const name = row.querySelector(".sub-name").value.trim();
        const code = row.querySelector(".sub-code").value.trim();
        row.classList.remove("table-danger");
        if (!name) {
            row.classList.add("table-danger");
            hasError = true;
            return;
        }
        toAdd.push({ name, code: code || name.substring(0, 3).toUpperCase() });
    });

    if (hasError) return Toast.error("Please fill in all Subject Names.");
    if (toAdd.length === 0) return Toast.error("No valid subjects to save.");

    const btn = document.getElementById("saveBulkSubjectBtn");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

    try {
        const year = getAcademicYear();
        const batch = writeBatch(db);
        toAdd.forEach(s => {
            const ref = doc(collection(db, "subjects"));
            batch.set(ref, {
                institutionId: currentInstitutionId,
                classId,
                academicYear: year,
                name: s.name,
                code: s.code,
                maxMarks,
                minPass
            });
        });
        await batch.commit();
        Toast.success(`Saved ${toAdd.length} subject${toAdd.length !== 1 ? "s" : ""} to ${classId}.`);
        bootstrap.Modal.getInstance(document.getElementById("addSubjectModal")).hide();
        loadSubjectFolders();
    } catch (err) {
        console.error(err);
        Toast.error("Failed to save subjects.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

async function deleteSubject(id, el, className) {
    if (!confirm("Delete this subject? This cannot be undone.")) return;
    try {
        await deleteDoc(doc(db, "subjects", id));
        el.remove();
        Toast.success("Subject deleted.");
        loadSubjectFolders();
    } catch (err) {
        Toast.error("Failed to delete subject.");
    }
}

/* ============================================================
   SUBJECTS — Edit Subject
   ============================================================ */
function openEditSubjectModal(subject) {
    document.getElementById("editSubjectId").value = subject.id;
    document.getElementById("editSubjectName").value = subject.name;
    document.getElementById("editSubjectCode").value = subject.code || "";
    document.getElementById("editSubjectMaxMarks").value = subject.maxMarks;
    document.getElementById("editSubjectMinPass").value = subject.minPass;
    new bootstrap.Modal(document.getElementById("editSubjectModal")).show();
}

async function saveEditSubject() {
    const id = document.getElementById("editSubjectId").value;
    const name = document.getElementById("editSubjectName").value.trim();
    const code = document.getElementById("editSubjectCode").value.trim();
    const maxMarks = Number(document.getElementById("editSubjectMaxMarks").value);
    const minPass = Number(document.getElementById("editSubjectMinPass").value);

    if (!name) return Toast.error("Subject name is required.");
    if (!maxMarks || maxMarks < 1) return Toast.error("Max marks must be at least 1.");
    if (minPass < 0 || minPass > maxMarks) return Toast.error("Invalid pass marks.");

    const btn = document.getElementById("saveEditSubjectBtn");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving…';

    try {
        await updateDoc(doc(db, "subjects", id), {
            name,
            code: code || name.substring(0, 3).toUpperCase(),
            maxMarks,
            minPass
        });
        Toast.success("Subject updated.");
        bootstrap.Modal.getInstance(document.getElementById("editSubjectModal")).hide();
        loadSubjectFolders();
    } catch (err) {
        console.error(err);
        Toast.error("Failed to update subject.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

/* ============================================================
   MARKS ENTRY — Folder View
   ============================================================ */
async function loadMarksFolders() {
    const area = document.getElementById("marksFoldersList");
    if (!area) return;
    area.innerHTML = `<div class="col-12 text-center py-4"><span class="spinner-border text-primary"></span></div>`;
    const empty = document.getElementById("marksFoldersEmpty");

    try {
        const snap = await getDocs(query(
            collection(db, "students"),
            where("institutionId", "==", currentInstitutionId),
            where("academicYear", "==", getAcademicYear())
        ));

        const groups = {};
        snap.forEach(d => {
            const data = d.data();
            if (!groups[data.classId]) groups[data.classId] = 0;
            groups[data.classId]++;
        });

        area.innerHTML = "";
        const classes = Object.keys(groups).sort();

        if (classes.length === 0) {
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");

        classes.forEach(cls => {
            const count = groups[cls];
            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-3";
            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm class-folder-card" style="cursor:pointer;transition:transform .15s;">
                    <div class="card-body text-center p-4">
                        <i class="fa-solid fa-folder-open fa-3x text-danger mb-3"></i>
                        <h6 class="fw-bold mb-1">${cls}</h6>
                        <span class="badge bg-danger-subtle text-danger border">${count} Student${count !== 1 ? 's' : ''}</span>
                    </div>
                </div>`;
            col.querySelector(".class-folder-card").addEventListener("click", () => openMarksEntry(cls));
            col.querySelector(".class-folder-card").addEventListener("mouseenter", e => e.currentTarget.style.transform = "translateY(-4px)");
            col.querySelector(".class-folder-card").addEventListener("mouseleave", e => e.currentTarget.style.transform = "");
            area.appendChild(col);
        });

    } catch (err) {
        console.error(err);
        area.innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load classes.</div></div>`;
    }
}

/* ============================================================
   MARKS ENTRY — Auto-save State
   ============================================================ */
let _autoSaveTimer = null;
let _marksDirty = false;

function setMarksSaveStatus(state) {
    const bar = document.getElementById("marksSaveStatus");
    const icon = document.getElementById("marksSaveIcon");
    const text = document.getElementById("marksSaveText");
    if (!bar) return;
    bar.classList.remove("d-none", "status-saving", "status-saved", "status-unsaved");
    if (state === "saving") {
        bar.classList.add("status-saving");
        icon.className = "fa-solid fa-spinner fa-spin me-2";
        text.textContent = "Saving…";
    } else if (state === "saved") {
        bar.classList.add("status-saved");
        icon.className = "fa-solid fa-circle-check me-2";
        text.textContent = "Saved automatically";
        _marksDirty = false;
    } else {
        bar.classList.add("status-unsaved");
        icon.className = "fa-solid fa-circle-dot me-2";
        text.textContent = "Unsaved changes";
        _marksDirty = true;
    }
}

function scheduleAutoSave() {
    setMarksSaveStatus("unsaved");
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(async () => {
        setMarksSaveStatus("saving");
        await autoSaveMarks();
    }, 1500);
}

async function autoSaveMarks() {
    const classId = currentMarksClassId;
    if (!classId) return;
    const year = getAcademicYear();
    const examType = getExamType();
    const markInputs = document.querySelectorAll(".mark-input");
    const attInputs = document.querySelectorAll(".mark-attendance");
    const rankInputs = document.querySelectorAll(".mark-rank");
    const studentData = {};
    markInputs.forEach(inp => {
        const sid = inp.dataset.student;
        if (!studentData[sid]) studentData[sid] = { subjects: {} };
        if (inp.value !== "") {
            studentData[sid].subjects[inp.dataset.subjectId] = {
                name: inp.dataset.subjectName,
                code: inp.dataset.subjectCode,
                maxMarks: Number(inp.dataset.subjectMax),
                minPass: Number(inp.dataset.subjectMin),
                obtained: Number(inp.value)
            };
        }
    });
    attInputs.forEach(inp => {
        const sid = inp.dataset.student;
        if (!studentData[sid]) studentData[sid] = { subjects: {} };
        studentData[sid].attendance = inp.value;
    });
    rankInputs.forEach(inp => {
        const sid = inp.dataset.student;
        if (!studentData[sid]) studentData[sid] = { subjects: {} };
        if (inp.value !== "") studentData[sid].rank = Number(inp.value);
    });
    if (Object.keys(studentData).length === 0) { setMarksSaveStatus("saved"); return; }
    try {
        const batch = writeBatch(db);
        Object.entries(studentData).forEach(([sid, data]) => {
            const safeExam = examType.replace(/\s+/g, "_");
            const ref = doc(db, "results", `${sid}_${year}_${safeExam}`);
            batch.set(ref, {
                institutionId: currentInstitutionId,
                studentId: sid,
                classId,
                academicYear: year,
                examType,
                subjects: data.subjects,
                attendance: data.attendance || "Present",
                rank: data.rank ?? null,
                published: false
            }, { merge: true });
        });
        await batch.commit();
        setMarksSaveStatus("saved");
    } catch (err) {
        console.error("Auto-save failed:", err);
        setMarksSaveStatus("unsaved");
    }
}

let currentMarksClassId = null;

async function openMarksEntry(classId) {
    currentMarksClassId = classId;
    document.getElementById("marksEntryTitle").textContent = `Class ${classId} — ${getExamType()}`;

    try {
        const [stuSnap, subSnap] = await Promise.all([
            getDocs(query(collection(db, "students"),
                where("institutionId", "==", currentInstitutionId),
                where("classId", "==", classId),
                where("academicYear", "==", getAcademicYear()))),
            getDocs(query(collection(db, "subjects"),
                where("institutionId", "==", currentInstitutionId),
                where("classId", "==", classId)))
        ]);

        if (stuSnap.empty) return Toast.error("No students found in this class for the selected year.");
        if (subSnap.empty) return Toast.error("No subjects found for this class. Add subjects first.");

        const subjects = [];
        subSnap.forEach(d => subjects.push({ id: d.id, ...d.data() }));
        subjects.sort((a, b) => a.name.localeCompare(b.name));

        const students = [];
        stuSnap.forEach(d => students.push({ id: d.id, ...d.data() }));
        students.sort((a, b) => (a.registerNo || "").localeCompare(b.registerNo || ""));

        const examType = getExamType();
        const year = getAcademicYear();
        const resultsSnap = await getDocs(query(
            collection(db, "results"),
            where("institutionId", "==", currentInstitutionId),
            where("classId", "==", classId),
            where("academicYear", "==", year),
            where("examType", "==", examType)
        ));
        const savedResults = {};
        resultsSnap.forEach(d => { savedResults[d.data().studentId] = d.data(); });

        // Build table header
        const thead = document.getElementById("marksEntryTableHead");
        thead.innerHTML = `
            <th class="ps-4" style="min-width:180px;">Student Name</th>
            <th style="min-width:130px;">Register No</th>`;

        // Subject group columns
        subjects.forEach(sub => {
            const th = document.createElement("th");
            th.className = "text-center subject-col";
            th.style.minWidth = "110px";
            th.innerHTML = `<span class="fw-semibold">${escHtml(sub.name)}</span><br><small class="text-muted fw-normal">Max ${sub.maxMarks}</small>`;
            thead.appendChild(th);
        });

        // Attendance header
        const thAtt = document.createElement("th");
        thAtt.className = "text-center";
        thAtt.style.minWidth = "140px";
        thAtt.innerHTML = `<span class="fw-semibold">Attendance</span><br><small class="text-muted fw-normal fst-italic">Optional</small>`;
        thead.appendChild(thAtt);

        // Rank header
        const thRank = document.createElement("th");
        thRank.className = "text-center";
        thRank.style.minWidth = "90px";
        thRank.innerHTML = `<span class="fw-semibold">Rank</span><br><small class="text-muted fw-normal fst-italic">Optional</small>`;
        thead.appendChild(thRank);

        // Actions header
        const thAct = document.createElement("th");
        thAct.className = "text-center";
        thAct.style.minWidth = "80px";
        thAct.textContent = "Actions";
        thead.appendChild(thAct);

        // Build table body
        const tbody = document.getElementById("marksEntryTableBody");
        tbody.innerHTML = "";

        students.forEach(stu => {
            const saved = savedResults[stu.id] || {};
            const savedSubjects = saved.subjects || {};
            const tr = document.createElement("tr");

            let html = `
                <td class="ps-4 fw-semibold align-middle">${escHtml(stu.name)}</td>
                <td class="align-middle"><span class="font-monospace small">${escHtml(stu.registerNo)}</span></td>`;

            subjects.forEach(sub => {
                const existing = savedSubjects[sub.id]?.obtained ?? "";
                html += `
                    <td class="align-middle">
                        <input type="number" class="form-control form-control-sm text-center fw-semibold mark-input marks-cell-input"
                            data-student="${stu.id}"
                            data-subject-id="${sub.id}"
                            data-subject-name="${escAttr(sub.name)}"
                            data-subject-code="${escAttr(sub.code || sub.name.substring(0, 3).toUpperCase())}"
                            data-subject-max="${sub.maxMarks}"
                            data-subject-min="${sub.minPass}"
                            min="0" max="${sub.maxMarks}"
                            value="${existing}"
                            placeholder="—">
                    </td>`;
            });

            const savedAtt = saved.attendance || "Present";
            html += `
                <td class="align-middle">
                    <select class="form-select form-select-sm mark-attendance marks-cell-input" data-student="${stu.id}">
                        <option value="Present"${savedAtt === "Present" ? " selected" : ""}>Present</option>
                        <option value="Absent"${savedAtt === "Absent" ? " selected" : ""}>Absent</option>
                    </select>
                </td>`;

            const savedRank = saved.rank ?? "";
            html += `
                <td class="align-middle">
                    <input type="number" class="form-control form-control-sm text-center mark-rank marks-cell-input"
                        data-student="${stu.id}" min="1" value="${savedRank}" placeholder="—">
                </td>`;

            html += `
                <td class="text-center align-middle">
                    <button class="btn btn-sm btn-outline-secondary btn-clear-row" title="Clear marks for this student">
                        <i class="fa-solid fa-eraser"></i>
                    </button>
                </td>`;

            tr.innerHTML = html;

            // Clear row action
            tr.querySelector(".btn-clear-row").addEventListener("click", () => {
                if (!confirm(`Clear all marks for ${stu.name}?`)) return;
                tr.querySelectorAll(".mark-input").forEach(inp => inp.value = "");
                tr.querySelectorAll(".mark-rank").forEach(inp => inp.value = "");
                const attSel = tr.querySelector(".mark-attendance");
                if (attSel) attSel.value = "Present";
                scheduleAutoSave();
            });

            tbody.appendChild(tr);
        });

        // Attach auto-save listeners to all mark inputs
        document.querySelectorAll(".marks-cell-input").forEach(inp => {
            inp.addEventListener("change", scheduleAutoSave);
            inp.addEventListener("input", scheduleAutoSave);
        });

        // Show status bar
        const statusBar = document.getElementById("marksSaveStatus");
        if (statusBar) statusBar.classList.remove("d-none");
        setMarksSaveStatus("saved"); // default to saved when loading

        document.getElementById("marksClassFoldersArea").classList.add("d-none");
        document.getElementById("marksEntryArea").classList.remove("d-none");

    } catch (err) {
        console.error(err);
        Toast.error("Failed to load marks entry.");
    }
}

function backToMarksFolders() {
    clearTimeout(_autoSaveTimer);
    document.getElementById("marksEntryArea").classList.add("d-none");
    document.getElementById("marksClassFoldersArea").classList.remove("d-none");
    const bar = document.getElementById("marksSaveStatus");
    if (bar) bar.classList.add("d-none");
}

/* ============================================================
   MARKS ENTRY — Save All Marks
   ============================================================ */
async function saveAllMarks() {
    const classId = currentMarksClassId;
    if (!classId) return Toast.error("No class selected.");

    const year = getAcademicYear();
    const examType = getExamType();
    const markInputs = document.querySelectorAll(".mark-input");
    const attInputs = document.querySelectorAll(".mark-attendance");
    const rankInputs = document.querySelectorAll(".mark-rank");

    // Aggregate per student
    const studentData = {};

    markInputs.forEach(inp => {
        const sid = inp.dataset.student;
        if (!studentData[sid]) studentData[sid] = { subjects: {} };
        if (inp.value !== "") {
            studentData[sid].subjects[inp.dataset.subjectId] = {
                name: inp.dataset.subjectName,
                code: inp.dataset.subjectCode,
                maxMarks: Number(inp.dataset.subjectMax),
                minPass: Number(inp.dataset.subjectMin),
                obtained: Number(inp.value)
            };
        }
    });

    attInputs.forEach(inp => {
        const sid = inp.dataset.student;
        if (!studentData[sid]) studentData[sid] = { subjects: {} };
        studentData[sid].attendance = inp.value;
    });

    rankInputs.forEach(inp => {
        const sid = inp.dataset.student;
        if (!studentData[sid]) studentData[sid] = { subjects: {} };
        if (inp.value !== "") studentData[sid].rank = Number(inp.value);
    });

    if (Object.keys(studentData).length === 0) return Toast.info("No data to save.");

    const btn = document.getElementById("saveMarksBtn");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Saving…';

    try {
        const batch = writeBatch(db);
        Object.entries(studentData).forEach(([sid, data]) => {
            const safeExam = examType.replace(/\s+/g, "_");
            const ref = doc(db, "results", `${sid}_${year}_${safeExam}`);
            batch.set(ref, {
                institutionId: currentInstitutionId,
                studentId: sid,
                classId,
                academicYear: year,
                examType,
                subjects: data.subjects,
                attendance: data.attendance || "Present",
                rank: data.rank ?? null,
                published: false
            }, { merge: true });
        });
        await batch.commit();
        Toast.success(`Marks saved for ${Object.keys(studentData).length} student(s).`);
    } catch (err) {
        console.error(err);
        Toast.error("Failed to save marks.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

/* ============================================================
   PUBLISH RESULTS — Folder View
   ============================================================ */
async function loadPublishFolders() {
    const area = document.getElementById("publishFoldersList");
    if (!area) return;
    area.innerHTML = `<div class="col-12 text-center py-4"><span class="spinner-border text-primary"></span></div>`;
    const empty = document.getElementById("publishFoldersEmpty");

    try {
        const year = getAcademicYear();
        const examType = getExamType();

        // Load all students for this year
        const stuSnap = await getDocs(query(
            collection(db, "students"),
            where("institutionId", "==", currentInstitutionId),
            where("academicYear", "==", year)
        ));

        const groups = {};
        stuSnap.forEach(d => {
            const data = d.data();
            if (!groups[data.classId]) groups[data.classId] = 0;
            groups[data.classId]++;
        });

        area.innerHTML = "";
        const classes = Object.keys(groups).sort();

        if (classes.length === 0) {
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");

        // Check publish status per class — check if ANY result for that class is published
        const publishedClasses = new Set();
        const resultsSnap = await getDocs(query(
            collection(db, "results"),
            where("institutionId", "==", currentInstitutionId),
            where("academicYear", "==", year),
            where("examType", "==", examType),
            where("published", "==", true)
        ));
        resultsSnap.forEach(d => publishedClasses.add(d.data().classId));

        classes.forEach(cls => {
            const isPublished = publishedClasses.has(cls);
            const col = document.createElement("div");
            col.className = "col-6 col-md-4 col-lg-3";
            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm publish-folder-card" style="border-radius:14px;transition:transform .15s,box-shadow .15s;">
                    <div class="card-body text-center p-4">
                        <i class="fa-solid fa-folder-open fa-3x ${isPublished ? 'text-success' : 'text-info'} mb-3"></i>
                        <h6 class="fw-bold mb-2">${cls}</h6>
                        <span class="publish-status-badge ${isPublished ? 'badge-published' : 'badge-unpublished'} mb-3 d-block">
                            <i class="fa-solid ${isPublished ? 'fa-circle-check' : 'fa-triangle-exclamation'} me-1"></i>
                            ${isPublished ? 'Published' : 'Not Published'}
                        </span>
                        <button class="btn btn-sm w-100 btn-publish-class ${isPublished ? 'btn-outline-warning' : 'btn-success'}">
                            ${isPublished
                    ? '<i class="fa-solid fa-eye-slash me-1"></i> Unpublish Results'
                    : '<i class="fa-solid fa-check me-1"></i> Publish'}
                        </button>
                    </div>
                </div>`;
            const card = col.querySelector(".publish-folder-card");
            card.addEventListener("mouseenter", () => { card.style.transform = "translateY(-3px)"; card.style.boxShadow = "0 8px 20px rgba(0,0,0,.10)"; });
            card.addEventListener("mouseleave", () => { card.style.transform = ""; card.style.boxShadow = ""; });
            const actionBtn = col.querySelector(".btn-publish-class");
            if (isPublished) {
                actionBtn.addEventListener("click", () => unpublishClassAndRefresh(cls, col));
            } else {
                actionBtn.addEventListener("click", () => publishClassAndRefresh(cls, col));
            }
            area.appendChild(col);
        });

    } catch (err) {
        console.error(err);
        area.innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load classes.</div></div>`;
    }
}

async function publishClassAndRefresh(classId, colEl) {
    const msg = `Publish results for ${classId}? Students will be able to view them immediately.`;
    if (!confirm(msg)) return;

    const year = getAcademicYear();
    const examType = getExamType();
    const btn = colEl.querySelector(".btn-publish-class");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Publishing…';

    try {
        const q = query(
            collection(db, "results"),
            where("institutionId", "==", currentInstitutionId),
            where("academicYear", "==", year),
            where("examType", "==", examType),
            where("classId", "==", classId)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            Toast.info(`No results found for ${classId}. Enter marks first.`);
            btn.disabled = false;
            btn.innerHTML = orig;
            return;
        }
        const batch = writeBatch(db);
        snap.forEach(d => batch.update(d.ref, { published: true }));
        await batch.commit();
        Toast.success(`Published ${snap.size} result(s) for ${classId}.`);

        // Update UI in-place: switch to Unpublish state
        const badge = colEl.querySelector(".publish-status-badge");
        badge.className = "publish-status-badge badge-published mb-3 d-block";
        badge.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> Published';
        const icon = colEl.querySelector(".fa-folder-open");
        icon.className = "fa-solid fa-folder-open fa-3x text-success mb-3";
        btn.className = "btn btn-sm w-100 btn-publish-class btn-outline-warning";
        btn.innerHTML = '<i class="fa-solid fa-eye-slash me-1"></i> Unpublish Results';
        btn.disabled = false;
        // Replace listener: now unpublish
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener("click", () => unpublishClassAndRefresh(classId, colEl));
    } catch (err) {
        console.error(err);
        Toast.error("Failed to publish results.");
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

async function unpublishClassAndRefresh(classId, colEl) {
    const msg = `Are you sure you want to unpublish results for ${classId}? Students will no longer be able to view them.`;
    if (!confirm(msg)) return;

    const year = getAcademicYear();
    const examType = getExamType();
    const btn = colEl.querySelector(".btn-publish-class");
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Unpublishing…';

    try {
        const q = query(
            collection(db, "results"),
            where("institutionId", "==", currentInstitutionId),
            where("academicYear", "==", year),
            where("examType", "==", examType),
            where("classId", "==", classId)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            Toast.info(`No results found for ${classId}.`);
            btn.disabled = false;
            btn.innerHTML = orig;
            return;
        }
        const batch = writeBatch(db);
        snap.forEach(d => batch.update(d.ref, { published: false }));
        await batch.commit();
        Toast.success(`Unpublished ${snap.size} result(s) for ${classId}.`);

        // Update UI in-place: switch to Publish state
        const badge = colEl.querySelector(".publish-status-badge");
        badge.className = "publish-status-badge badge-unpublished mb-3 d-block";
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Not Published';
        const icon = colEl.querySelector(".fa-folder-open");
        icon.className = "fa-solid fa-folder-open fa-3x text-info mb-3";
        btn.className = "btn btn-sm w-100 btn-publish-class btn-success";
        btn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Publish';
        btn.disabled = false;
        // Replace listener: now publish
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener("click", () => publishClassAndRefresh(classId, colEl));
    } catch (err) {
        console.error(err);
        Toast.error("Failed to unpublish results.");
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

async function publishClass(classId) {
    const msg = classId === "All"
        ? "Publish results for ALL classes? Students will be able to view them immediately."
        : `Publish results for ${classId}? Students will be able to view them immediately.`;

    if (!confirm(msg)) return;

    const year = getAcademicYear();
    const examType = getExamType();

    const btn = classId === "All"
        ? document.getElementById("publishAllBtn")
        : null;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Publishing…';
    }

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

        const snap = await getDocs(q);
        if (snap.empty) {
            return Toast.info(`No results found for ${classId === "All" ? "any class" : classId} with the current context.`);
        }

        const batch = writeBatch(db);
        snap.forEach(d => batch.update(d.ref, { published: true }));
        await batch.commit();

        Toast.success(`Published ${snap.size} result(s) for ${classId === "All" ? "all classes" : classId}.`);
    } catch (err) {
        console.error(err);
        Toast.error("Failed to publish results.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check-double me-2"></i> Publish All Classes';
        }
    }
}

/* ============================================================
   UTILITIES
   ============================================================ */
function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escAttr(str) {
    return String(str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
