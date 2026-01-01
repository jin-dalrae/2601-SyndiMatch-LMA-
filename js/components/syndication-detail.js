// ========================================
// Syndication Detail Component - Enhanced
// ========================================

const SyndicationDetailComponent = {
    currentSyndication: null,
    bidInterval: null,

    init() {
        this.setupModal();
    },

    setupModal() {
        const overlay = document.getElementById('modal-overlay');
        const closeBtn = overlay?.querySelector('.modal-close');

        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
        closeBtn?.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    },

    open(syndId) {
        const synd = SyndiData.syndications.find(s => s.id === syndId);
        if (!synd) return;

        this.currentSyndication = synd;
        const overlay = document.getElementById('modal-overlay');

        document.getElementById('modal-loan-id').textContent = synd.id;
        document.getElementById('modal-borrower').textContent = synd.borrower;

        this.renderHeader(synd);
        this.renderAIIntro(synd);
        this.renderAgentFlow(synd);
        this.renderBiddingFeed(synd);
        this.renderAuctionChart(synd);
        this.renderParticipantGrid(synd);
        this.renderAllocationSection(synd);
        this.renderPaymentSchedule(synd);

        overlay.classList.add('open');
        this.startLiveBids();
    },

    close() {
        document.getElementById('modal-overlay').classList.remove('open');
        this.stopLiveBids();
        this.currentSyndication = null;
    },

    renderHeader(synd) {
        const container = document.getElementById('detail-header');
        container.innerHTML = `
            <div class="detail-stat">
                <div class="detail-stat-label">Amount</div>
                <div class="detail-stat-value highlight">${Utils.formatCurrency(synd.amount * 1000000)}</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">Rating</div>
                <div class="detail-stat-value">${synd.rating}</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">Industry</div>
                <div class="detail-stat-value">${synd.industry}</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">Spread</div>
                <div class="detail-stat-value">${synd.spread} bps</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">Subscription</div>
                <div class="detail-stat-value" style="color: var(--success)">${synd.subscription}%</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">Status</div>
                <div class="detail-stat-value"><span class="status-badge ${synd.status}">${synd.status}</span></div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">Originator</div>
                <div class="detail-stat-value">${synd.originator || 'JPMorgan Chase'}</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-label">Tenor</div>
                <div class="detail-stat-value">${synd.tenor || '5Y'}</div>
            </div>
        `;
    },

    // AI-Generated Introduction (under 50 words)
    renderAIIntro(synd) {
        const container = document.getElementById('detail-header');
        const aiIntros = {
            'open': `New opportunity from ${synd.originator || 'JPMorgan'}. ${synd.rating} rated ${synd.industry} borrower at ${synd.spread}bps. Strong fundamentals support attractive risk-adjusted returns.`,
            'negotiating': `Active auction in Round ${synd.round}. Current subscription at ${synd.subscription}% with ${synd.spread}bps clearing spread. Multiple institutional bidders competing.`,
            'settlement': `Auction closed. Proceeding to documentation and compliance verification. Allocations confirmed for ${Math.round(synd.subscription * 0.08)} participants.`,
            'funding': `Settlement complete. Collecting commitment fees via x402 USDC. Expected funding within 48 hours.`,
            'completed': `Successfully syndicated ${Utils.formatCurrency(synd.amount * 1000000)} at ${synd.spread}bps. All payments received. Deal performance tracking initiated.`
        };

        const intro = aiIntros[synd.status] || aiIntros['open'];

        const introDiv = document.createElement('div');
        introDiv.className = 'ai-intro-section';
        introDiv.innerHTML = `
            <div class="ai-intro">
                <span class="ai-badge">🤖 AI Summary</span>
                <p>${intro}</p>
            </div>
        `;
        container.parentNode.insertBefore(introDiv, container.nextSibling);
    },

    renderAgentFlow(synd) {
        const container = document.getElementById('agent-flow');
        const stages = [
            { name: 'Originator', icon: '🏦', type: 'originator', status: 'Broadcast ✓', active: false, reason: 'Loan opportunity broadcast to 47 participants.' },
            { name: 'Negotiation', icon: '⚡', type: 'negotiation', status: `Round ${synd.round}/${synd.maxRounds}`, active: synd.status === 'negotiating', reason: `Dutch auction at ${synd.spread}bps. ${synd.subscription}% subscribed.` },
            { name: 'Settlement', icon: '📋', type: 'settlement', status: synd.status === 'settlement' ? 'Active' : 'Pending', active: synd.status === 'settlement', reason: 'Confirming allocations and legal docs.' },
            { name: 'Payment', icon: '💰', type: 'payment', status: synd.status === 'funding' ? 'Collecting' : 'Pending', active: synd.status === 'funding', reason: '0.5% commitment fee via x402 USDC.' }
        ];

        container.innerHTML = stages.map((stage, i) => `
            <div class="agent-node" title="${stage.reason}">
                <div class="agent-icon ${stage.type} ${stage.active ? 'active' : ''}">${stage.icon}</div>
                <div class="agent-name">${stage.name}</div>
                <div class="agent-status">${stage.status}</div>
                <div class="agent-reason">${stage.reason}</div>
            </div>
            ${i < stages.length - 1 ? `<div class="agent-connector ${stage.active ? 'active' : ''}"></div>` : ''}
        `).join('');
    },

    renderBiddingFeed(synd) {
        const container = document.getElementById('bidding-feed');

        // Generate bidding reasons
        const bidReasons = [
            'Strong yield exceeds 9% target. Sector fits mandate.',
            'BB+ rating within risk tolerance. Conservative allocation.',
            'Attractive spread compensates for credit risk.',
            'Diversification benefit. Low correlation to portfolio.',
            'Relationship bid. Strategic originator partnership.'
        ];

        container.innerHTML = `
            <div class="bid-feed-header">
                <span>Live Activity</span>
                <span class="live-indicator">● LIVE</span>
            </div>
            ${SyndiData.bids.map((bid, i) => `
            <div class="bid-item">
                <div class="bid-main">
                    <span class="bid-time">${bid.time}</span>
                    <span class="bid-participant">${bid.participant}</span>
                    <span class="bid-action ${bid.action.toLowerCase()}">${bid.action}</span>
                    <span class="bid-amount">${bid.amount ? Utils.formatCurrency(bid.amount * 1000000) : '—'}</span>
                    <span class="bid-spread">${bid.spread ? `${bid.spread} bps` : ''}</span>
                </div>
                ${bid.action === 'BID' ? `<div class="bid-reason">🤖 ${bidReasons[i % bidReasons.length]}</div>` : ''}
            </div>
        `).join('')}
        `;
    },

    renderAuctionChart(synd) {
        const container = document.getElementById('auction-chart');
        const rounds = Array.from({ length: synd.maxRounds }, (_, i) => i + 1);
        const subs = [0, 37, 68, synd.subscription, synd.subscription];

        container.innerHTML = `
            <div class="auction-stats">
                <div class="auction-stat">
                    <div class="auction-stat-value spread">${synd.spread} bps</div>
                    <div class="auction-stat-label">Current Spread</div>
                </div>
                <div class="auction-stat">
                    <div class="auction-stat-value subscription">${synd.subscription}%</div>
                    <div class="auction-stat-label">Subscription</div>
                </div>
            </div>
            <div class="auction-visual">
                <div class="auction-bars">
                    ${rounds.slice(0, synd.round).map((r, i) => `
                        <div class="auction-bar sub-bar" style="height: ${subs[i]}%">
                            <span class="auction-bar-label">${subs[i]}%</span>
                        </div>
                    `).join('')}
                </div>
                <div class="auction-rounds">
                    ${rounds.map(r => `
                        <span class="auction-round ${r === synd.round ? 'active' : ''}">${r <= synd.round ? `R${r}` : '—'}</span>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderParticipantGrid(synd) {
        const container = document.getElementById('participant-grid');
        const participants = SyndiData.participants.slice(0, 8);

        // Selection reasons
        const selectionReasons = [
            'Competitive bid with strong track record.',
            'Strategic relationship with originator.',
            'Aggressive pricing within allocation cap.',
            'Reliable payment history (100% on-time).',
            'Capacity matches remaining availability.'
        ];

        container.innerHTML = `
            <table class="participant-table">
                <thead>
                    <tr>
                        <th>Participant</th>
                        <th>Type</th>
                        <th>Bid Amount</th>
                        <th>Spread</th>
                        <th>Allocation</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${participants.map((p, i) => {
            const bid = SyndiData.bids.find(b => b.participant === p.name);
            const allocated = synd.status !== 'open' && bid;
            const allocationPct = allocated ? Utils.randomBetween(70, 100) : 0;
            return `
                            <tr class="${allocated ? 'allocated' : ''}">
                                <td>
                                    <span class="participant-name">${p.name}</span>
                                    ${allocated ? `<div class="selection-reason">🤖 ${selectionReasons[i % selectionReasons.length]}</div>` : ''}
                                </td>
                                <td><span class="participant-type">${p.type}</span></td>
                                <td>${bid?.amount ? Utils.formatCurrency(bid.amount * 1000000) : '—'}</td>
                                <td>${bid?.spread || '—'}</td>
                                <td>${allocated ? `${allocationPct}%` : '—'}</td>
                                <td>
                                    <span class="participant-status">
                                        <span class="participant-status-dot ${allocated ? 'success' : bid ? 'active' : 'pending'}"></span>
                                        ${allocated ? 'Allocated' : bid ? 'Bidding' : 'Viewing'}
                                    </span>
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;
    },

    renderAllocationSection(synd) {
        const section = document.getElementById('allocation-section');
        if (synd.status === 'open' || synd.status === 'negotiating') {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        const container = document.getElementById('allocation-chart');

        const allocations = [
            { name: 'Apollo Global', amount: 75, pct: 18.75 },
            { name: 'CalPERS', amount: 60, pct: 15.0 },
            { name: 'BNP Paribas', amount: 50, pct: 12.5 },
            { name: 'MUFG Bank', amount: 45, pct: 11.25 },
            { name: 'Palmer Square', amount: 40, pct: 10.0 },
            { name: 'Others (6)', amount: 130, pct: 32.5 }
        ];

        container.innerHTML = `
            <div class="allocation-summary">
                <div class="allocation-total">
                    <span class="allocation-label">Total Allocated</span>
                    <span class="allocation-value">${Utils.formatCurrency(synd.amount * 1000000 * synd.subscription / 100)}</span>
                </div>
                <div class="allocation-participants">
                    <span class="allocation-label">Participants</span>
                    <span class="allocation-value">${Math.round(synd.subscription * 0.08)}</span>
                </div>
            </div>
            <div class="allocation-bars">
                ${allocations.map(a => `
                    <div class="allocation-bar-row">
                        <span class="allocation-name">${a.name}</span>
                        <div class="allocation-bar-track">
                            <div class="allocation-bar-fill" style="width: ${a.pct * 3}%"></div>
                        </div>
                        <span class="allocation-amount">$${a.amount}M</span>
                        <span class="allocation-pct">${a.pct}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderPaymentSchedule(synd) {
        // Create payment schedule section if not exists
        let paymentSection = document.querySelector('.payment-schedule-section');
        if (!paymentSection) {
            paymentSection = document.createElement('section');
            paymentSection.className = 'detail-section payment-schedule-section';
            paymentSection.innerHTML = `
                <h3 class="detail-section-title">Payment Schedule</h3>
                <div id="payment-schedule"></div>
            `;
            document.getElementById('allocation-section').after(paymentSection);
        }

        if (synd.status === 'open' || synd.status === 'negotiating') {
            paymentSection.style.display = 'none';
            return;
        }

        paymentSection.style.display = 'block';
        const container = document.getElementById('payment-schedule');

        const schedule = [
            { type: 'Commitment Fee', rate: '0.5%', amount: synd.amount * 5000, due: 'Upon Allocation', status: synd.status === 'completed' ? 'Paid' : 'Pending', method: 'x402 USDC' },
            { type: 'Arrangement Fee', rate: '0.25%', amount: synd.amount * 2500, due: 'Funding Date', status: synd.status === 'completed' ? 'Paid' : 'Scheduled', method: 'x402 USDC' },
            { type: 'Principal', rate: '—', amount: synd.amount * 1000000 * synd.subscription / 100, due: 'Funding Date', status: synd.status === 'completed' ? 'Funded' : 'Scheduled', method: 'x402 USDC' }
        ];

        container.innerHTML = `
            <table class="payment-schedule-table">
                <thead>
                    <tr>
                        <th>Payment Type</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Method</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${schedule.map(p => `
                        <tr>
                            <td><strong>${p.type}</strong></td>
                            <td>${p.rate}</td>
                            <td>${Utils.formatCurrency(p.amount)}</td>
                            <td>${p.due}</td>
                            <td><span class="x402-method">${p.method}</span></td>
                            <td><span class="payment-status ${p.status.toLowerCase()}">${p.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    startLiveBids() {
        const participants = ['Goldman Sachs', 'Morgan Stanley', 'Credit Suisse', 'Deutsche Bank', 'Barclays', 'HSBC', 'UBS'];
        const reasons = [
            'Yield target met. Sector fits strategy.',
            'Conservative allocation within limits.',
            'Attractive spread for rating class.',
            'Portfolio diversification benefit.',
            'Strategic relationship bid.'
        ];

        this.bidInterval = setInterval(() => {
            if (!this.currentSyndication) return;

            const container = document.getElementById('bidding-feed');
            const now = new Date();
            const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            const participant = participants[Math.floor(Math.random() * participants.length)];
            const amount = Utils.randomBetween(25, 200);
            const spread = Utils.randomBetween(400, 450);
            const reason = reasons[Math.floor(Math.random() * reasons.length)];

            const newBid = document.createElement('div');
            newBid.className = 'bid-item new';
            newBid.innerHTML = `
                <div class="bid-main">
                    <span class="bid-time">${time}</span>
                    <span class="bid-participant">${participant}</span>
                    <span class="bid-action bid">BID</span>
                    <span class="bid-amount">${Utils.formatCurrency(amount * 1000000)}</span>
                    <span class="bid-spread">${spread} bps</span>
                </div>
                <div class="bid-reason">🤖 ${reason}</div>
            `;
            container.insertBefore(newBid, container.querySelector('.bid-item'));

            setTimeout(() => newBid.classList.remove('new'), 5000);
        }, 5000);
    },

    stopLiveBids() {
        if (this.bidInterval) {
            clearInterval(this.bidInterval);
            this.bidInterval = null;
        }
    }
};

