// SyndiMatch — Express API + static frontend
// Mounts route modules from ./routes, serves index.html for SPA paths.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/all-data'));
app.use('/api', require('./routes/analytics'));
app.use('/api', require('./routes/syndications'));
app.use('/api', require('./routes/syndication-events'));
app.use('/api', require('./routes/bids'));
app.use('/api', require('./routes/participants'));
app.use('/api', require('./routes/originators'));
app.use('/api', require('./routes/payments'));
app.use('/api', require('./routes/agents'));
app.use('/api', require('./routes/allocations'));
app.use('/api', require('./routes/x402'));
app.use('/api', require('./routes/orchestrator'));

// SPA catch-all — must come after all /api routes.
// Client-side routes that should serve index.html.
const clientRoutes = [
    '/landing', '/overview', '/orchestration', '/payments', '/analytics',
    '/transactions', '/settings', '/originate', '/originator', '/participant',
    '/syndications', '/participants'
];

app.get(/^\/(?!api).*/, (req, res, next) => {
    const isClientRoute = req.path === '/' ||
        clientRoutes.some(route => req.path.startsWith(route)) ||
        req.path.match(/^\/SYND-/i);
    if (isClientRoute) {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    } else {
        next();
    }
});

async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 SyndiMatch API running on http://0.0.0.0:${PORT}`);
            console.log(`📊 Dashboard available at http://0.0.0.0:${PORT}`);
            console.log(`💳 x402 Mock Payment endpoints active`);
            console.log(`🔗 MongoDB connected`);
            console.log(`🧭 SPA routing enabled (History API)`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
