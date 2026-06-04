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
            await sleep(100);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export { executeUntilDone };