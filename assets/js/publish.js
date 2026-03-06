import { db } from "./firebase-init.js";
import {
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

export async function togglePublish(resultId, state) {
    await updateDoc(doc(db, "results", resultId), {
        published: state
    });
}
