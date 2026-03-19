/**
 * api.js – Centralised HTTP client for Vitamin English frontend
 *
 * This module exposes a single `api(endpoint, options)` helper that every
 * page-level script (app.js, monthly-reports.js, etc.) uses to communicate
 * with the Express backend.  Extracting it here keeps the function in one
 * place so that changes to error-handling, auth headers, or base URL only
 * need to be made once.
 *
 * Load order:  api.js must be loaded BEFORE app.js and monthly-reports.js.
 * All three files share the same global scope so `api` is available to both.
 */

/**
 * Fetch wrapper for all backend API calls.
 *
 * - Automatically prefixes `/api` to every endpoint path.
 * - Includes session cookies via `credentials: 'include'`.
 * - Sets `Content-Type: application/json` by default (can be overridden).
 * - Shows a loading spinner on the currently focused button while in-flight.
 * - On non-2xx responses, reads the JSON error body and surfaces it through
 *   `Toast.error()` (provided by app.js) so callers don't need to handle UI.
 * - On network failure (offline), shows a dedicated offline toast.
 *
 * @param {string} endpoint  - Path relative to /api  (e.g. '/students')
 * @param {RequestInit} [options] - Standard fetch options (method, body, …)
 * @returns {Promise<any>}   Parsed JSON response body
 * @throws  {Error}          Re-throws after showing a user-visible toast
 */
async function api(endpoint, options = {}) {
    // Show loading spinner on the currently focused button while in-flight
    const button = document.activeElement;
    if (button && button.tagName === 'BUTTON') {
        button.classList.add('loading');
    }

    try {
        const response = await fetch(`/api${endpoint}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const defaultError = `Request failed: ${response.status} ${response.statusText}`;
            const errorBody = await response.json().catch(() => ({ error: defaultError }));

            // Prefer a human-readable hint over a raw error string when available
            const errorMessage = errorBody.hint || errorBody.error || defaultError;
            Toast.error(errorMessage);

            throw new Error(errorBody.error || defaultError);
        }

        return response.json();
    } catch (error) {
        // Show a contextual offline message rather than a generic network error
        if (!navigator.onLine) {
            Toast.error('No internet connection', 'Offline');
        } else if (!error.message.includes('Request failed')) {
            // Only toast here if we haven't already toasted above
            Toast.error(error.message);
        }
        throw error;
    } finally {
        // Always restore the button state regardless of success or failure
        if (button && button.tagName === 'BUTTON') {
            button.classList.remove('loading');
        }
    }
}
