import { db } from "./firebase-init.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

export async function saveAttendance(studentId, percentage, institutionId) {
    await addDoc(collection(db, "attendance"), {
        studentId,
        institutionId,
        attendancePercentage: Number(percentage),
        createdAt: serverTimestamp()
    });
}
