/**
 * Generic CSV Parser Utility
 */

export function parseCSV(file, callback) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split("\n").map(r => r.trim()).filter(Boolean);
        const headers = rows.shift().split(",");

        const data = rows.map(row => {
            const cols = row.split(",");
            let obj = {};
            headers.forEach((h, i) => obj[h.trim()] = cols[i]?.trim());
            return obj;
        });

        callback(data);
    };

    reader.readAsText(file);
}
