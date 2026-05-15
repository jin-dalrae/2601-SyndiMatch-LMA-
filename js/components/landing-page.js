/**
 * SyndiMatch Landing Page Component
 * Professional landing page with links to all dashboards
 */
const LandingPage = {
    init() {
        // Subscribe to view changes
        if (window.AppState) {
            AppState.subscribe('currentView', (view) => {
                if (view === 'landing') {
                    this.render();
                    this.showLandingMode();
                } else {
                    this.hideLandingMode();
                }
            });

            // Check if we're already on landing view (initial load)
            const currentView = AppState.get('currentView');
            if (currentView === 'landing') {
                this.render();
                this.showLandingMode();
            }
        }

        // Also listen for route changes directly
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
    },

    render() {
        const container = document.getElementById('view-landing');
        if (!container) return;

        container.innerHTML = `
            <div class="landing-page">
                <!-- Animated Background -->
                <div class="landing-bg">
                    <div class="landing-grid"></div>
                    <div class="orb orb-1"></div>
                    <div class="orb orb-2"></div>
                    <div class="orb orb-3"></div>
                </div>

                <!-- Content -->
                <div class="landing-content">
                    <!-- Navigation -->
                    <nav class="landing-nav">
                        <div class="landing-logo">
                            <div class="landing-logo-icon">S</div>
                            <span class="landing-logo-text">SyndiMatch</span>
                        </div>
                        <div class="landing-nav-links">
                            <a href="#dashboards" class="landing-nav-link">Dashboards</a>
                            <a href="#why" class="landing-nav-link">Why AI Agents?</a>
                            <a href="#how" class="landing-nav-link">How It Works</a>
                            <a href="/overview" class="landing-nav-cta">Enter Platform</a>
                        </div>
                    </nav>

                    <!-- Hero Section -->
                    <section class="landing-hero">
                        <div class="hero-content">
                            <div class="hero-badge fade-in">
                                <span class="hero-badge-dot"></span>
                                AI-Powered Syndication
                            </div>
                            <h1 class="hero-title fade-in fade-in-delay-1">
                                The Future of<br>
                                <span class="gradient">Loan Syndication</span>
                            </h1>
                            <p class="hero-subtitle fade-in fade-in-delay-2">
                                SyndiMatch uses autonomous AI agents to revolutionize how syndicated loans are originated,
                                negotiated, and settled. Reduce deal cycles from weeks to hours while ensuring
                                optimal pricing and allocation.
                            </p>
                            <div class="hero-cta-group fade-in fade-in-delay-3">
                                <a href="#dashboards" class="hero-cta hero-cta-primary">
                                    Explore Dashboards
                                    <span>→</span>
                                </a>
                                <a href="#why" class="hero-cta hero-cta-secondary">
                                    Learn More
                                </a>
                            </div>
                        </div>
                        <div class="hero-visual fade-in fade-in-delay-4">
                            <div class="hero-card-stack">
                                <div class="hero-card hero-card-1">
                                    <div class="card-header">
                                        <div class="card-icon blue">🏦</div>
                                        <span class="card-status live">Originator</span>
                                    </div>
                                    <div class="card-title">Deal Creation</div>
                                    <div class="card-subtitle">Set terms & pricing guidance</div>
                                    <div class="card-features">
                                        <div class="card-feature">Create syndications</div>
                                        <div class="card-feature">Monitor subscriptions</div>
                                        <div class="card-feature">Manage allocations</div>
                                    </div>
                                </div>
                                <div class="hero-card hero-card-2">
                                    <div class="card-header">
                                        <div class="card-icon purple">🤖</div>
                                        <span class="card-status processing">AI Agents</span>
                                    </div>
                                    <div class="card-title">Autonomous Negotiation</div>
                                    <div class="card-subtitle">Real-time bid optimization</div>
                                    <div class="card-features">
                                        <div class="card-feature">Credit analysis</div>
                                        <div class="card-feature">Portfolio fit scoring</div>
                                        <div class="card-feature">Dutch auction bidding</div>
                                    </div>
                                </div>
                                <div class="hero-card hero-card-3">
                                    <div class="card-header">
                                        <div class="card-icon green">💰</div>
                                        <span class="card-status live">Settlement</span>
                                    </div>
                                    <div class="card-title">x402 Protocol</div>
                                    <div class="card-subtitle">Atomic programmable payments</div>
                                    <div class="card-features">
                                        <div class="card-feature">Instant settlement</div>
                                        <div class="card-feature">Escrow management</div>
                                        <div class="card-feature">Payment tracking</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Why AI Agents Section -->
                    <section class="landing-why" id="why">
                        <div class="section-header">
                            <div class="section-badge">The Problem</div>
                            <h2 class="section-title">Traditional Syndication is Broken</h2>
                            <p class="section-subtitle">
                                The $4.7 trillion syndicated loan market still relies on manual processes,
                                phone calls, and spreadsheets. This creates inefficiencies that cost
                                billions annually.
                            </p>
                        </div>

                        <div class="problem-grid">
                            <div class="problem-card">
                                <div class="problem-icon">⏱️</div>
                                <h3 class="problem-title">Weeks of Delays</h3>
                                <p class="problem-desc">
                                    Average syndication takes 4-6 weeks with manual coordination between
                                    arrangers, participants, and legal teams across time zones.
                                </p>
                            </div>
                            <div class="problem-card">
                                <div class="problem-icon">📊</div>
                                <h3 class="problem-title">Opaque Pricing</h3>
                                <p class="problem-desc">
                                    Price discovery happens through bilateral calls and emails, leading to
                                    information asymmetry and suboptimal allocation.
                                </p>
                            </div>
                            <div class="problem-card">
                                <div class="problem-icon">💸</div>
                                <h3 class="problem-title">Settlement Risk</h3>
                                <p class="problem-desc">
                                    T+10 to T+20 settlement windows with manual reconciliation create
                                    counterparty risk and tie up capital unnecessarily.
                                </p>
                            </div>
                        </div>

                        <div class="section-header" style="margin-top: 4rem;">
                            <div class="section-badge section-badge-success">The Solution</div>
                            <h2 class="section-title">AI Agents Change Everything</h2>
                            <p class="section-subtitle">
                                Autonomous AI agents negotiate, analyze, and execute on behalf of market participants
                                24/7, with full transparency and atomic settlement.
                            </p>
                        </div>

                        <div class="solution-grid">
                            <div class="solution-card">
                                <div class="solution-icon">🤖</div>
                                <h3 class="solution-title">Autonomous Negotiation</h3>
                                <p class="solution-desc">
                                    AI agents analyze deal terms, credit risk, and portfolio fit in milliseconds.
                                    They negotiate spreads and allocations based on your investment mandate.
                                </p>
                            </div>
                            <div class="solution-card">
                                <div class="solution-icon">🔍</div>
                                <h3 class="solution-title">Transparent Price Discovery</h3>
                                <p class="solution-desc">
                                    Dutch auction mechanism with real-time bid visibility ensures fair pricing.
                                    All participants see the same information simultaneously.
                                </p>
                            </div>
                            <div class="solution-card">
                                <div class="solution-icon">⚡</div>
                                <h3 class="solution-title">Instant Settlement</h3>
                                <p class="solution-desc">
                                    x402 protocol enables atomic, programmable payments. Funds move only when
                                    all conditions are met. T+0 settlement becomes reality.
                                </p>
                            </div>
                        </div>
                    </section>

                    <!-- How It Works -->
                    <section class="landing-how" id="how">
                        <div class="section-header">
                            <div class="section-badge">Process</div>
                            <h2 class="section-title">How SyndiMatch Works</h2>
                            <p class="section-subtitle">
                                From deal announcement to settlement in hours, not weeks.
                            </p>
                        </div>

                        <div class="workflow-steps">
                            <div class="workflow-step">
                                <div class="step-number">1</div>
                                <h3 class="step-title">Originate</h3>
                                <p class="step-desc">Lead arranger creates deal with terms, pricing guidance, and target allocation.</p>
                            </div>
                            <div class="workflow-step">
                                <div class="step-number">2</div>
                                <h3 class="step-title">Analyze</h3>
                                <p class="step-desc">Participant AI agents evaluate credit, fit against mandate, and determine bid strategy.</p>
                            </div>
                            <div class="workflow-step">
                                <div class="step-number">3</div>
                                <h3 class="step-title">Negotiate</h3>
                                <p class="step-desc">Agents submit bids in real-time Dutch auction. Spread tightens as demand builds.</p>
                            </div>
                            <div class="workflow-step">
                                <div class="step-number">4</div>
                                <h3 class="step-title">Settle</h3>
                                <p class="step-desc">Allocations finalized, docs generated, and atomic settlement via x402 protocol.</p>
                            </div>
                        </div>
                    </section>

                    <!-- Dashboard Entry Points -->
                    <section class="landing-dashboards" id="dashboards">
                        <div class="section-header">
                            <div class="section-badge">Get Started</div>
                            <h2 class="section-title">Choose Your Dashboard</h2>
                            <p class="section-subtitle">
                                Experience SyndiMatch from any perspective. No sign-up required for this demo.
                            </p>
                        </div>

                        <div class="dashboard-grid">
                            <!-- Originator Dashboard -->
                            <a href="/originator" class="dashboard-card originator">
                                <div class="dashboard-icon">🏦</div>
                                <div class="dashboard-role">Lead Arranger</div>
                                <h3 class="dashboard-title">Originator Dashboard</h3>
                                <p class="dashboard-desc">
                                    Create and manage syndications. Set pricing, monitor subscription levels,
                                    and oversee the entire deal lifecycle.
                                </p>
                                <ul class="dashboard-features">
                                    <li>Create new syndication deals</li>
                                    <li>Real-time subscription tracking</li>
                                    <li>Bid analysis and allocation</li>
                                    <li>Fee collection monitoring</li>
                                </ul>
                                <div class="dashboard-cta">
                                    Enter as Originator <span>→</span>
                                </div>
                            </a>

                            <!-- Participant Dashboard -->
                            <a href="/participant" class="dashboard-card participant">
                                <div class="dashboard-icon">📈</div>
                                <div class="dashboard-role">Institutional Investor</div>
                                <h3 class="dashboard-title">Participant Dashboard</h3>
                                <p class="dashboard-desc">
                                    Browse active syndications, analyze opportunities, and let your AI agent
                                    bid according to your investment mandate.
                                </p>
                                <ul class="dashboard-features">
                                    <li>View syndication pipeline</li>
                                    <li>AI-powered bid recommendations</li>
                                    <li>Portfolio exposure analysis</li>
                                    <li>Automated participation</li>
                                </ul>
                                <div class="dashboard-cta">
                                    Enter as Participant <span>→</span>
                                </div>
                            </a>

                            <!-- Admin Dashboard -->
                            <a href="/overview" class="dashboard-card admin">
                                <div class="dashboard-icon">⚙️</div>
                                <div class="dashboard-role">Platform Administrator</div>
                                <h3 class="dashboard-title">Admin Dashboard</h3>
                                <p class="dashboard-desc">
                                    Monitor platform health, view all agent activity, analyze market trends,
                                    and manage system configuration.
                                </p>
                                <ul class="dashboard-features">
                                    <li>Platform-wide analytics</li>
                                    <li>Agent orchestration view</li>
                                    <li>Payment flow monitoring</li>
                                    <li>System health metrics</li>
                                </ul>
                                <div class="dashboard-cta">
                                    Enter as Admin <span>→</span>
                                </div>
                            </a>
                        </div>
                    </section>

                    <!-- Tech Stack -->
                    <section class="landing-tech">
                        <div class="tech-grid">
                            <div class="tech-item">
                                <span>🧠</span> LangGraph Agents
                            </div>
                            <div class="tech-item">
                                <span>⛓️</span> x402 Protocol
                            </div>
                            <div class="tech-item">
                                <span>🔐</span> CDP Wallet
                            </div>
                            <div class="tech-item">
                                <span>📊</span> Real-time Analytics
                            </div>
                            <div class="tech-item">
                                <span>🌐</span> LMA Standard Compliant
                            </div>
                        </div>
                    </section>

                    <!-- Footer -->
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
                                <a href="#why" class="footer-link">About</a>
                                <a href="/terms.html" class="footer-link">Terms</a>
                                <a href="/privacy.html" class="footer-link">Privacy</a>
                            </div>
                        </div>
                        <div class="footer-copy">
                            &copy; 2026 Cadinal LLC. SyndiMatch — AI-powered loan syndication, closed beta.<br>
                            Demo prototype — not for production use.
                        </div>
                    </footer>
                </div>
            </div>
        `;

        // Smooth scroll for in-page anchor links (like #dashboards, #why, #how)
        container.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const href = anchor.getAttribute('href');
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }
};

// Export globally
window.LandingPage = LandingPage;
