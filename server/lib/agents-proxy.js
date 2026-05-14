// Proxy helper for the Python agents service.
// AGENTS_SERVICE_URL points at FastAPI on :8000 locally, or Cloud Run in prod.

const AGENTS_SERVICE_URL = process.env.AGENTS_SERVICE_URL || 'http://localhost:8000';

async function callAgentsService(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${AGENTS_SERVICE_URL}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`Agents service returned ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`❌ Agents service call failed (${endpoint}):`, error.message);
        throw error;
    }
}

module.exports = { callAgentsService, AGENTS_SERVICE_URL };
