/**
 * Toast Service
 * Replaces native alert() with Bootstrap 5 Toasts
 */

export const Toast = {
    /**
     * Show a Success Toast
     * @param {string} message 
     */
    success(message) {
        this._show(message, 'bg-success', 'text-white');
    },

    /**
     * Show an Error Toast
     * @param {string} message 
     */
    error(message) {
        this._show(message, 'bg-danger', 'text-white');
    },

    /**
     * Show an Info Toast
     * @param {string} message 
     */
    info(message) {
        this._show(message, 'bg-primary', 'text-white');
    },

    /**
     * Internal method to create and show the toast
     */
    _show(message, bgClass, textClass) {
        // Create container if not exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            container.style.zIndex = '10000';
            document.body.appendChild(container);
        }

        // Create Toast Element
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center ${bgClass} ${textClass} border-0 mb-2`;
        toastEl.role = 'alert';
        toastEl.ariaLive = 'assertive';
        toastEl.ariaAtomic = 'true';

        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;

        container.appendChild(toastEl);

        // Initialize Bootstrap Toast (assuming bootstrap is global or available via CDN)
        // We use the CDN link in HTML so 'bootstrap' global should be available.
        // If strict modules, we might need to import it, but for now relying on global Bundle.
        if (window.bootstrap) {
            const toast = new window.bootstrap.Toast(toastEl, { delay: 3000 });
            toast.show();

            // Remove from DOM after hidden
            toastEl.addEventListener('hidden.bs.toast', () => {
                toastEl.remove();
            });
        } else {
            // Fallback if bootstrap JS not loaded yet (should not happen with proper script order)
            console.warn('Bootstrap JS not loaded. Toast fallback to alert.');
            alert(message);
            toastEl.remove();
        }
    }
};
