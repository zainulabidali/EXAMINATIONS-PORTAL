exports.assignRanks = async (db, institutionId, classId) => {

    const snapshot = await db.collection("results")
        .where("institutionId", "==", institutionId)
        .where("classId", "==", classId)
        .get();

    const results = [];
    snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));

    results.sort((a, b) => b.total - a.total);

    const batch = db.batch();
    let rank = 1;

    for (const result of results) {
        const ref = db.collection("results").doc(result.id);
        batch.update(ref, { rank });
        rank++;
    }

    await batch.commit();
};
