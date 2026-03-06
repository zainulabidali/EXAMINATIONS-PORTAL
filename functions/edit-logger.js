exports.logEdit = async (db, data) => {
    await db.collection("editLogs").add({
        ...data,
        editedAt: new Date()
    });
};
