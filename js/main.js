// ============================================================
// SyndiMatch — single ES-module entry (Phase 4)
//
// Imports every legacy script in the SAME order index.html used to
// load them. Each legacy file still publishes its `window.X` bridge,
// so cross-file references that use `window.X` keep working while we
// migrate to real imports leaf-by-leaf. This is the bundle entry Vite
// needs so `vite build` produces a complete, working app.
//
// firebase-config.js stays a separate module tag in index.html (it's
// already ESM and loads third-party SDKs).
// ============================================================

import './config.js';
import './api-client.js';
import './app-state.js';
import './router.js';
import './data.js';
import './role-context.js';
import './simulation-engine.js';
import './market-conditions.js';
import './auto-generator.js';
import './auto-bidder.js';
import './role-router.js';
import './components/metrics.js';
import './components/pipeline.js';
import './components/syndication-detail.js';
import './components/payments.js';
import './components/x402-payment.js';
import './components/agents.js';
import './components/analytics.js';
import './components/alerts.js';
import './components/origination-form.js';
import './components/originator-dashboard.js';
import './components/participant-dashboard.js';
import './components/platform-dashboard.js';
import './components/landing-page.js';
import './components/admin-view.js';
import './components/agent-ruleset-page.js';
import './components/process-details-page.js';
import './agent-orchestration.js';
import './app.js';
