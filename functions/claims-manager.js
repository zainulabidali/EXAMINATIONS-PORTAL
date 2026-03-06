exports.setInstitutionClaim = async (admin, uid, institutionId) => {
    await admin.auth().setCustomUserClaims(uid, {
        role: "institution",
        institutionId
    });
};
