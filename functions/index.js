/**
 * Firebase Cloud Functions
 * - Create Institution Admin
 * - Recalculate Result
 * - Auto Grade
 * - Auto Rank
 * - Detect Topper
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/* ============================================================
   1️⃣ Create Institution Admin
============================================================ */

exports.createInstitutionAdmin = functions.https.onCall(async (data, context) => {

    if (!context.auth || context.auth.token.role !== "super") {
        throw new functions.https.HttpsError("permission-denied", "Not authorized");
    }

    const { email, institutionId } = data;

    let user;

    try {
        user = await admin.auth().getUserByEmail(email);
    } catch {
        user = await admin.auth().createUser({
            email,
            password: "Change@123"
        });
    }

    await admin.auth().setCustomUserClaims(user.uid, {
        role: "institution",
        institutionId
    });

    return { success: true };
});

/* ============================================================
   2️⃣ Recalculate Result
============================================================ */

exports.recalculateResult = functions.https.onCall(async (data, context) => {

    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated");
    }

    const { studentId } = data;

    const marksSnap = await db.collection("marks")
        .where("studentId", "==", studentId)
        .get();

    let total = 0;
    let subjectCount = 0;

    marksSnap.forEach(doc => {
        total += doc.data().marks;
        subjectCount++;
    });

    if (subjectCount === 0) return;

    const percentage = Number((total / (subjectCount * 100)) * 100).toFixed(2);
    const grade = calculateGrade(percentage);

    const studentDoc = await db.collection("students").doc(studentId).get();
    const student = studentDoc.data();

    const resultRef = db.collection("results").doc(studentId);

    await resultRef.set({
        studentId,
        institutionId: student.institutionId,
        classId: student.classId,
        total,
        percentage: Number(percentage),
        grade,
        rank: 0,
        published: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await assignRanks(student.institutionId, student.classId);

    return { success: true };
});

/* ============================================================
   3️⃣ Grade Calculation
============================================================ */

function calculateGrade(percentage) {

    percentage = Number(percentage);

    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    if (percentage >= 40) return "D";
    return "F";
}

/* ============================================================
   4️⃣ Rank Assignment + Topper Detection
============================================================ */

async function assignRanks(institutionId, classId) {

    const resultsSnap = await db.collection("results")
        .where("institutionId", "==", institutionId)
        .where("classId", "==", classId)
        .get();

    const results = [];

    resultsSnap.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });

    results.sort((a, b) => b.total - a.total);

    const batch = db.batch();

    let rank = 1;
    let topperName = null;

    for (const result of results) {

        if (rank === 1) {
            const studentDoc = await db.collection("students").doc(result.studentId).get();
            topperName = studentDoc.data().name;
        }

        const ref = db.collection("results").doc(result.studentId);

        batch.update(ref, {
            rank,
            topperName
        });

        rank++;
    }

    await batch.commit();
}
