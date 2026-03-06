/**
 * PDF Generator Module
 * Uses jsPDF (UMD)
 * Generates clean Report Card PDF
 */

const downloadBtn = document.getElementById("downloadPdf");

if (downloadBtn) {
    downloadBtn.addEventListener("click", generatePDF);
}

function generatePDF() {

    const stored = sessionStorage.getItem("resultData");
    if (!stored) return alert("No result data found");

    const { institution, student, result, attendance, marks } = JSON.parse(stored);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    let y = 15;

    /* =============================
       Institution Header
    ============================== */

    doc.setFontSize(18);
    doc.text(institution.name || "Institution Name", 105, y, { align: "center" });
    y += 10;

    doc.setFontSize(12);
    doc.text("Official Result Report", 105, y, { align: "center" });
    y += 15;

    /* =============================
       Student Details
    ============================== */

    doc.setFontSize(11);

    doc.text(`Name: ${student.name}`, 15, y);
    y += 7;
    doc.text(`Register No: ${student.registerNo}`, 15, y);
    y += 7;
    doc.text(`Class: ${student.classId}`, 15, y);
    y += 7;
    doc.text(`Academic Year: ${student.academicYear}`, 15, y);
    y += 12;

    /* =============================
       Table Header
    ============================== */

    doc.setFontSize(12);
    doc.text("Subject", 15, y);
    doc.text("Marks", 110, y);
    doc.text("Status", 160, y);
    y += 5;

    doc.line(15, y, 195, y);
    y += 8;

    /* =============================
       Marks Table
    ============================== */

    doc.setFontSize(11);

    marks.forEach(m => {

        const status = m.marks >= 40 ? "Pass" : "Fail";

        doc.text(String(m.subjectId), 15, y);
        doc.text(String(m.marks), 110, y);
        doc.text(status, 160, y);

        y += 8;

        if (y > 270) {
            doc.addPage();
            y = 15;
        }
    });

    y += 5;
    doc.line(15, y, 195, y);
    y += 12;

    /* =============================
       Summary
    ============================== */

    doc.setFontSize(12);

    doc.text(`Total: ${result.total}`, 15, y);
    y += 8;
    doc.text(`Percentage: ${result.percentage}%`, 15, y);
    y += 8;
    doc.text(`Grade: ${result.grade}`, 15, y);
    y += 8;
    doc.text(`Rank: ${result.rank}`, 15, y);
    y += 8;
    doc.text(`Attendance: ${attendance}%`, 15, y);
    y += 8;
    doc.text(`Topper: ${result.topperName || "-"}`, 15, y);
    y += 12;

    /* =============================
       Verification ID
    ============================== */

    const verificationId = `${result.studentId}-${Date.now()}`;

    doc.setFontSize(10);
    doc.text(`Verification ID: ${verificationId}`, 15, y);

    /* =============================
       Footer
    ============================== */

    doc.setFontSize(9);
    doc.text("Generated from Result Management Portal", 105, 290, { align: "center" });

    /* =============================
       Save File
    ============================== */

    doc.save(`${student.name}_Result.pdf`);
}
