import { db } from "./firebase-init.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

export async function saveMark(studentId, subjectId, marks, institutionId) {
    await addDoc(collection(db, "marks"), {
        studentId,
        subjectId,
        institutionId,
        marks: Number(marks),
        createdAt: serverTimestamp()
    });
}
