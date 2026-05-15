/**
 * SyndiMatch Landing Page Component
 * Hero leads with a live "Agent Activity" feed instead of decorative cards —
 * same vocabulary as the AI decision log and the Compliance Agent on the
 * legal pages, so the brand voice carries through.
 */
const LandingPage = {
    feedTimer: null,
    feedPool: [
        { agent: 'Negotiation', action: 'Closed round 3 of TechFlow auction at 425 bps',          confidence: 91 },
        { agent: 'Participant', action: 'Apollo Global bid 350 bps on SYND-2025-001',             confidence: 94 },
        { agent: 'Settlement',  action: 'Allocated $475M to 12 participants pro-rata',            confidence: 99 },
        { agent: 'Originator',  action: 'Drafted term sheet for Meridian Healthcare',             confidence: 88 },
        { agent: 'Payment',     action: 'Mock-settled commitment fee $2.5M via x402',             confidence: 100 },
        { agent: 'Participant', action: 'CalPERS placed bid: $80M at 412 bps',                    confidence: 92 },
        { agent: 'Negotiation', action: 'Detected oversubscription: 1.4× on Quantum Logistics',   confidence: 97 },
        { agent: 'Originator',  action: 'JPMorgan opened SYND-2025-009 — $600M, BB+, Healthcare', confidence: 95 },
        { agent: 'Settlement',  action: 'Closed Atlas Manufacturing — T+2 settlement',            confidence: 99 },
        { agent: 'Participant', action: 'MUFG declined: outside investment mandate',              confidence: 89 },
        { agent: 'Payment',     action: 'Released escrow on SYND-2025-006 to 8 wallets',          confidence: 96 },
        { agent: 'Negotiation', action: 'Spread converging on Vertex Energy: 446 bps',            confidence: 93 }
    ],

    init() {
        if (window.AppState) {
            AppState.subscribe('currentView', (view) => {
                if (view === 'landing') {
                    this.render();
                    this.showLandingMode();
                } else {
                    this.hideLandingMode();
                }
            });
            const currentView = AppState.get('currentView');
            if (currentView === 'landing') {
                this.render();
                this.showLandingMode();
            }
        }

        window.addEventListener('routeChanged', (e) => {
            if (e.detail?.view === 'landing') {
                this.render();
                this.showLandingMode();
            }
        });

        console.log('Landing Page initialized');
    },

    showLandingMode() {
        document.body.classList.add('landing-mode');
        const header = document.querySelector('.header');
        const metricsBar = document.querySelector('.metrics-bar');
        const mainContent = document.querySelector('.main-content');
        if (header) header.style.display = 'none';
        if (metricsBar) metricsBar.style.display = 'none';
        if (mainContent) mainContent.style.display = 'none';
    },

    hideLandingMode() {
        document.body.classList.remove('landing-mode');
        const header = document.querySelector('.header');
        const metricsBar = document.querySelector('.metrics-bar');
        const mainContent = document.querySelector('.main-content');
        if (header) header.style.display = '';
        if (metricsBar) metricsBar.style.display = '';
        if (mainContent) mainContent.style.display = '';
        if (this.feedTimer) {
            clearInterval(this.feedTimer);
            this.feedTimer = null;
        }
    },

    // Build a timestamp HH:MM:SS shifted N seconds into the past
    _ts(offsetSec) {
        const d = new Date(Date.now() - offsetSec * 1000);
        return d.toTimeString().slice(0, 8);
    },

    _entryHtml(entry, tsOffsetSec, isFresh) {
        const agentKey = entry.agent.toLowerCase();
        const conf = entry.confidence;
        const confTier = conf >= 95 ? 'high' : conf >= 90 ? 'mid' : 'low';
        return `
            <div class="agent-feed-entry${isFresh ? ' fresh' : ''}" data-agent="${agentKey}">
                <div class="agent-feed-time">${this._ts(tsOffsetSec)}</div>
                <div class="agent-feed-payload">
                    <div class="agent-feed-row">
                        <span class="agent-feed-name agent-${agentKey}">${entry.agent}</span>
                        <span class="agent-feed-conf conf-${confTier}">${conf}%</span>
                    </div>
                    <div class="agent-feed-action">${entry.action}</div>
                </div>
            </div>
        `;
    },

    _startFeedRotation() {
        const body = document.getElementById('agent-feed-body');
        if (!body) return;

        // Seed: 4 initial entries, oldest at the bottom
        const seed = [];
        for (let i = 0; i < 4; i++) {
            seed.push({
                ...this.feedPool[i % this.feedPool.length],
                offsetSec: i * 5 + 2
            });
        }
        body.innerHTML = seed.map(e => this._entryHtml(e, e.offsetSec, false)).join('');

        // Rotate: every 3s prepend a fresh entry, drop the oldest
        let cursor = 4;
        if (this.feedTimer) clearInterval(this.feedTimer);
        this.feedTimer = setInterval(() => {
            const body = document.getElementById('agent-feed-body');
            if (!body) return;
            const next = this.feedPool[cursor % this.feedPool.length];
            cursor++;

            // Drop oldest (last child)
            const last = body.lastElementChild;
            if (last) last.remove();

            // Re-stamp existing timestamps so older entries appear to age
            const remaining = body.querySelectorAll('.agent-feed-entry');
            remaining.forEach((el, idx) => {
                const t = el.querySelector('.agent-feed-time');
                if (t) t.textContent = this._ts((idx + 1) * 5 + 2);
                el.classList.remove('fresh');
            });

            // Prepend new
            const tmp = document.createElement('div');
            tmp.innerHTML = this._entryHtml(next, 0, true).trim();
            body.insertBefore(tmp.firstChild, body.firstChild);
        }, 3000);
    },

    render() {
        const container = document.getElementById('view-landing');
        if (!container) return;

        container.innerHTML = `
            <div class="landing-page">
                <div class="landing-bg">
                    <div class="landing-grid"></div>
                    <div class="orb orb-1"></div>
                    <div class="orb orb-2"></div>
                    <div class="orb orb-3"></div>
                </div>

                <div class="landing-content">
                    <nav class="landing-nav">
                        <div class="landing-logo">
                            <div class="landing-logo-icon">S</div>
                            <span class="landing-logo-text">SyndiMatch</span>
                        </div>
                        <div class="landing-nav-links">
                            <a href="#how" class="landing-nav-link">How it works</a>
                            <a href="#why" class="landing-nav-link">Why agents</a>
                            <a href="#dashboards" class="landing-nav-link">Dashboards</a>
                            <a href="/overview" class="landing-nav-cta">Enter platform</a>
                        </div>
                    </nav>

                    <!-- ============================================================
                         Hero
                         Left: tight copy + single CTA + trust marker
                         Right: live agent activity feed (the actual product story)
                         ============================================================ -->
                    <section class="landing-hero">
                        <div class="hero-content">
                            <div class="hero-badge">
                                <span class="hero-badge-dot"></span>
                                Closed institutional beta
                            </div>
                            <h1 class="hero-title">
                                Loan syndication,<br>
                                <span class="gradient">settled in hours.</span>
                            </h1>
                            <p class="hero-subtitle">
                                Autonomous AI agents originate, negotiate, allocate, and settle syndicated loans on behalf of institutional participants — with a logged audit trail on every decision.
                            </p>
                            <div class="hero-cta-group">
                                <a href="#dashboards" class="hero-cta hero-cta-primary">
                                    Try the demo
                                    <span aria-hidden="true">→</span>
                                </a>
                                <a href="#how" class="hero-cta-text">
                                    How it works
                                </a>
                            </div>
                            <div class="hero-trust">
                                <span class="hero-trust-dot"></span>
                                <span>Every AI decision is logged. <a href="/agent-decisions.html">See the trail →</a></span>
                            </div>
                        </div>

                        <div class="hero-visual">
                            <div class="agent-feed" role="region" aria-label="Live agent activity">
                                <header class="agent-feed-header">
                                    <div class="agent-feed-title">
                                        <span class="agent-feed-pulse" aria-hidden="true"></span>
                                        Agent Activity
                                    </div>
                                    <span class="agent-feed-status">Live · 5 agents</span>
                                </header>
                                <div class="agent-feed-body" id="agent-feed-body"></div>
                                <footer class="agent-feed-footer">
                                    <span>Sample feed — your institution sees only its own agents.</span>
                                </footer>
                            </div>
                        </div>
                    </section>

                    <!-- ============================================================
                         Why agents — replaces sticker badges with cleaner eyebrows
                         ============================================================ -->
                    <section class="landing-why" id="why">
                        <div class="section-header">
                            <span class="section-eyebrow">— The problem</span>
                            <h2 class="section-title">Syndication today is paperwork at the speed of phone calls.</h2>
                            <p class="section-subtitle">
                                A $4.7 trillion market still runs on spreadsheets, emails, and bilateral calls. The cost is measured in weeks of idle capital, opaque pricing, and reconciliation risk.
                            </p>
                        </div>

                        <div class="problem-grid">
                            <div class="problem-card">
                                <div class="problem-icon">⏱</div>
                                <h3 class="problem-title">Weeks of delays</h3>
                                <p class="problem-desc">
                                    A typical syndication takes 4–6 weeks. Manual coordination across arrangers, participants, and legal teams ties up capital and personnel.
                                </p>
                            </div>
                            <div class="problem-card">
                                <div class="problem-icon">◐</div>
                                <h3 class="problem-title">Opaque pricing</h3>
                                <p class="problem-desc">
                                    Price discovery happens in bilateral calls. Information asymmetry leads to mispriced risk and suboptimal allocation.
                                </p>
                            </div>
                            <div class="problem-card">
                                <div class="problem-icon">◇</div>
                                <h3 class="problem-title">Settlement risk</h3>
                                <p class="problem-desc">
                                    T+10 to T+20 settlement windows leave counterparty risk on the table and tie up capital that could be redeployed.
                                </p>
                            </div>
                        </div>

                        <div class="section-header" style="margin-top: 5rem;">
                            <span class="section-eyebrow section-eyebrow-positive">— The fix</span>
                            <h2 class="section-title">AI agents negotiate, allocate, and settle continuously.</h2>
                            <p class="section-subtitle">
                                Each institution gets its own agent operating against its mandate. Decisions are explicit, logged, and reviewable.
                            </p>
                        </div>

                        <div class="solution-grid">
                            <div class="solution-card">
                                <div class="solution-icon">◉</div>
                                <h3 class="solution-title">Autonomous negotiation</h3>
                                <p class="solution-desc">
                                    Agents evaluate credit, portfolio fit, and yield against your mandate in milliseconds. They bid and counter without waking up your team.
                                </p>
                            </div>
                            <div class="solution-card">
                                <div class="solution-icon">◎</div>
                                <h3 class="solution-title">Transparent price discovery</h3>
                                <p class="solution-desc">
                                    Multi-round Dutch auction with real-time visibility. All participants see the same clearing-price signal at the same instant.
                                </p>
                            </div>
                            <div class="solution-card">
                                <div class="solution-icon">⚡</div>
                                <h3 class="solution-title">Atomic settlement</h3>
                                <p class="solution-desc">
                                    x402 programmable payments move funds only when every closing condition is met. T+0 settlement, recorded on-chain.
                                </p>
                            </div>
                        </div>
                    </section>

                    <!-- ============================================================
                         How it works — adds a small agent log preview under each step
                         to carry the feed vocabulary downward through the page
                         ============================================================ -->
                    <section class="landing-how" id="how">
                        <div class="section-header">
                            <span class="section-eyebrow">— Process</span>
                            <h2 class="section-title">From announcement to settlement, in hours.</h2>
                            <p class="section-subtitle">
                                Four agent roles, one continuous workflow. Each step emits a decision record.
                            </p>
                        </div>

                        <div class="workflow-steps">
                            <div class="workflow-step">
                                <div class="step-number">01</div>
                                <h3 class="step-title">Originate</h3>
                                <p class="step-desc">Lead arranger structures the deal — terms, pricing guidance, target allocation.</p>
                                <div class="step-log">
                                    <span class="step-log-agent agent-originator">Originator</span>
                                    <span class="step-log-action">Drafted term sheet for Acme Holdings, $500M</span>
                                </div>
                            </div>
                            <div class="workflow-step">
                                <div class="step-number">02</div>
                                <h3 class="step-title">Analyze</h3>
                                <p class="step-desc">Each participant's agent evaluates credit, mandate fit, and bidding strategy.</p>
                                <div class="step-log">
                                    <span class="step-log-agent agent-participant">Participant</span>
                                    <span class="step-log-action">Apollo: portfolio fit 0.82, bid recommended</span>
                                </div>
                            </div>
                            <div class="workflow-step">
                                <div class="step-number">03</div>
                                <h3 class="step-title">Negotiate</h3>
                                <p class="step-desc">Real-time Dutch auction. Spread tightens as the book builds.</p>
                                <div class="step-log">
                                    <span class="step-log-agent agent-negotiation">Negotiation</span>
                                    <span class="step-log-action">Round 3 cleared at 425 bps, 1.4× covered</span>
                                </div>
                            </div>
                            <div class="workflow-step">
                                <div class="step-number">04</div>
                                <h3 class="step-title">Settle</h3>
                                <p class="step-desc">Allocations finalized, docs generated, atomic settlement via x402.</p>
                                <div class="step-log">
                                    <span class="step-log-agent agent-settlement">Settlement</span>
                                    <span class="step-log-action">$475M allocated to 12 participants, T+0</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- ============================================================
                         Dashboards — kept as-is structurally (functional CTA)
                         Cleaner copy, eyebrow instead of sticker badge.
                         ============================================================ -->
                    <section class="landing-dashboards" id="dashboards">
                        <div class="section-header">
                            <span class="section-eyebrow">— Try it</span>
                            <h2 class="section-title">Three views of the same syndication.</h2>
                            <p class="section-subtitle">
                                Sign-in not required for the demo. Pick the role you'd play in a real syndication and watch the agents work.
                            </p>
                        </div>

                        <div class="dashboard-grid">
                            <a href="/originator" class="dashboard-card originator">
                                <div class="dashboard-icon">🏦</div>
                                <div class="dashboard-role">Lead arranger</div>
                                <h3 class="dashboard-title">Originator</h3>
                                <p class="dashboard-desc">
                                    Structure deals, set pricing guidance, monitor subscription levels in real time.
                                </p>
                                <ul class="dashboard-features">
                                    <li>Create syndications</li>
                                    <li>Live subscription tracking</li>
                                    <li>Bid analysis &amp; allocation</li>
                                    <li>Fee collection</li>
                                </ul>
                                <div class="dashboard-cta">
                                    Enter as originator <span>→</span>
                                </div>
                            </a>

                            <a href="/participant" class="dashboard-card participant">
                                <div class="dashboard-icon">📈</div>
                                <div class="dashboard-role">Institutional investor</div>
                                <h3 class="dashboard-title">Participant</h3>
                                <p class="dashboard-desc">
                                    Browse the pipeline. Your agent bids against your mandate around the clock.
                                </p>
                                <ul class="dashboard-features">
                                    <li>Syndication pipeline</li>
                                    <li>AI bid recommendations</li>
                                    <li>Portfolio exposure</li>
                                    <li>Automated participation</li>
                                </ul>
                                <div class="dashboard-cta">
                                    Enter as participant <span>→</span>
                                </div>
                            </a>

                            <a href="/overview" class="dashboard-card admin">
                                <div class="dashboard-icon">⚙</div>
                                <div class="dashboard-role">Platform administrator</div>
                                <h3 class="dashboard-title">Admin</h3>
                                <p class="dashboard-desc">
                                    See every agent, every deal, every payment in one command center.
                                </p>
                                <ul class="dashboard-features">
                                    <li>Platform analytics</li>
                                    <li>Agent orchestration view</li>
                                    <li>Payment flow monitoring</li>
                                    <li>System health</li>
                                </ul>
                                <div class="dashboard-cta">
                                    Enter as admin <span>→</span>
                                </div>
                            </a>
                        </div>
                    </section>

                    <!-- ============================================================
                         Trust row — replaces emoji tech-stack with quiet text labels
                         ============================================================ -->
                    <section class="landing-tech">
                        <div class="tech-label">Built on</div>
                        <div class="tech-grid">
                            <div class="tech-item">LangGraph</div>
                            <div class="tech-dot" aria-hidden="true"></div>
                            <div class="tech-item">x402 Protocol</div>
                            <div class="tech-dot" aria-hidden="true"></div>
                            <div class="tech-item">Coinbase CDP</div>
                            <div class="tech-dot" aria-hidden="true"></div>
                            <div class="tech-item">MongoDB Atlas</div>
                            <div class="tech-dot" aria-hidden="true"></div>
                            <div class="tech-item">LMA standard</div>
                        </div>
                    </section>

                    <footer class="landing-footer">
                        <div class="footer-content">
                            <div class="footer-logo">
                                <div class="footer-logo-icon">S</div>
                                <span class="footer-logo-text">SyndiMatch</span>
                            </div>
                            <div class="footer-links">
                                <a href="/originator" class="footer-link">Originator</a>
                                <a href="/participant" class="footer-link">Participant</a>
                                <a href="/analytics" class="footer-link">Analytics</a>
                                <a href="/agent-decisions.html" class="footer-link">AI decisions</a>
                                <a href="/terms.html" class="footer-link">Terms</a>
                                <a href="/privacy.html" class="footer-link">Privacy</a>
                            </div>
                        </div>
                        <div class="footer-copy">
                            &copy; 2026 Cadinal LLC. SyndiMatch — AI-powered loan syndication, closed institutional beta.<br>
                            Demo prototype — not for production use.
                        </div>
                    </footer>
                </div>
            </div>
        `;

        // Smooth scroll for in-page anchors
        container.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            });
        });

        // Boot the agent feed
        this._startFeedRotation();
    }
};

window.LandingPage = LandingPage;
