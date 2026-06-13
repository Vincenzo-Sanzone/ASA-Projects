/**
 * Executes a function until it succeeds
 * @param {any} fn - Function to execute 
 * @param  {...any} args - Arguments to pass to the function
 * @returns 
 */
async function executeUntilDone(fn, ...args) {
    while (true) {
        try {
            return await fn(...args);
        } catch (error) {
            console.log('[DEBUG] Error:', error);
            await sleep(3000);
        }
    }
}

function decodeJWT(token) {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT");

    const payload = parts[1];

    // base64url → base64
    const base64 = payload
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const json = atob(base64);

    return JSON.parse(json);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export { executeUntilDone, decodeJWT };