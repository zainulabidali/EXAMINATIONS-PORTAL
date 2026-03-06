export function showSpinner() {
    document.body.insertAdjacentHTML("beforeend", `
        <div class="spinner-overlay" id="globalSpinner">
            <div class="spinner-border text-primary"></div>
        </div>
    `);
}

export function hideSpinner() {
    const el = document.getElementById("globalSpinner");
    if (el) el.remove();
}

export function showAlert(message, type = "success") {
    alert(message);
}
