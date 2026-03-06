export function formatDate(timestamp) {
    if (!timestamp) return "-";
    return timestamp.toDate().toLocaleDateString();
}

export function calculatePercentage(total, maxTotal) {
    return ((total / maxTotal) * 100).toFixed(2);
}
