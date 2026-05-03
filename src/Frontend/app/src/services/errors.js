/**
 * Extracts a human-readable error message from an Axios error object,
 * specifically handling ASP.NET Core's ValidationProblemDetails (RFC 9110).
 * 
 * @param {any} err - The error object from a caught promise.
 * @param {string} fallback - Fallback message if parsing fails.
 * @returns {string}
 */
export function extractErrorMessage(err, fallback = "Something went wrong.") {
    if (!err) return fallback;

    // 1. Handle ASP.NET Validation Errors (400 Bad Request)
    if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        const messages = [];

        Object.keys(errors).forEach(key => {
            const fieldErrors = errors[key];
            if (Array.isArray(fieldErrors)) {
                messages.push(...fieldErrors);
            } else {
                messages.push(String(fieldErrors));
            }
        });

        if (messages.length > 0) {
            return messages.join("\n");
        }
    }

    // 2. Handle Custom API Titles (e.g. 404, 403, 500)
    if (err.response?.data?.title) {
        return err.response.data.title;
    }

    // 3. Handle Axios Default Messages
    if (err.response?.data?.message) {
        return err.response.data.message;
    }

    // 4. Handle Network Errors
    if (err.message === "Network Error") {
        return "Network connection lost. Please check your internet.";
    }

    return err.message || fallback;
}
