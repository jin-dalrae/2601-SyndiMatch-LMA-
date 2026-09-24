/**
 * SyndiMatch Deal Room
 * A review-first workspace for a single canonical syndication. Displayed
 * values come from workflow records; unavailable evidence is shown as such.
 */
const DealRoom = {
    initialized: false,
    receiptState: {},

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.injectStyles();
        window.addEventListener('syndiDataRefresh', () => this.render());
        window.addEventListener('routeChanged', (event) => {
            if (event.detail?.view === 'deal-room') this.render();
        });
        document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-allocation-approval]');
            if (button) this.recordApproval(button.dataset.allocationApproval);
        });
    },

    _escape(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[char]));
    },

    _formatAmount(value) {
        const amount = Number(value || 0);
        if (!Number.isFinite(amount)) return 'Not recorded';
        return new Intl.NumberFormat('en-US', {
            style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact'
        }).format(amount >= 1_000_000 ? amount : amount * 1_000_000);
    },

    _activeSyndication() {
        const syndications = window.SyndiData?.syndications || [];
        const activeId = window.AppState?.get('activeSyndicationId') || window.AppState?.get('currentSyndicationId');
        return syndications.find(item => item.id === activeId) || syndications[0] || null;
    },

    async loadDecisionReceipts(syndicationId) {
        if (!syndicationId || !window.API || this.receiptState[syndicationId]?.loaded) return;

        this.receiptState[syndicationId] = { loading: true, loaded: false, receipts: [] };
        const response = await API.get('server', `/syndications/${encodeURIComponent(syndicationId)}/decision-receipts`);
        this.receiptState[syndicationId] = {
            loading: false,
            loaded: true,
            receipts: Array.isArray(response?.receipts) ? response.receipts : [],
            disclosure: response?.disclosure || 'Decision receipts are unavailable because no workflow evidence could be loaded.'
        };

        if (window.AppState?.get('currentView') === 'deal-room') this.render();
    },

    async recordApproval(syndicationId) {
        if (!syndicationId || !window.API) return;
        const approver = window.RoleRouter?.currentAgentId || 'platform-admin-demo';
        const confirmed = window.confirm('Record approval for the proposed allocation? This action will be added to the demo audit trail.');
        if (!confirmed) return;

        const result = await API.post('server', `/syndications/${encodeURIComponent(syndicationId)}/allocation-approval`, {
            approver,
            decision: 'approved'
        });

        if (result?.approval_id) {
            window.App?.showToast('Allocation approval recorded in the audit trail.', 'info');
            API.invalidateCache('/all-data');
            API.invalidateCache('/syndications');
            await window.SyndiData?.refresh();
            this.render();
        } else {
            window.App?.showToast('No proposed allocation is ready for approval.', 'error');
        }
    },

    _receiptRows(receipts = [], loading = false) {
        if (loading) {
            return '<div class="deal-room-empty">Loading recorded decision evidence…</div>';
        }
        if (!receipts.length) {
            return '<div class="deal-room-empty">No participant decisions have been recorded for this deal.</div>';
        }
        return receipts.slice(0, 8).map((receipt, index) => {
            const policyResults = receipt.policy_results || [];
            const policyLabel = policyResults.length
                ? policyResults.map(result => `${result.rule}: ${result.result}`).join(' · ')
                : 'No policy result was recorded.';
            return `
                <article class="decision-receipt">
                    <div class="decision-receipt-head">
                        <span class="decision-number">${this._escape(receipt.decision_id || `Decision ${index + 1}`)}</span>
                        <span class="decision-status">${this._escape(receipt.outcome || 'recorded')}</span>
                    </div>
                    <h3>${this._escape(receipt.actor || receipt.agent_id || 'Participant agent')}</h3>
                    <p class="decision-recommendation">${this._escape(receipt.recommendation || 'No recommendation was recorded.')}</p>
                    <p class="decision-rationale">${this._escape(receipt.rationale || 'No rationale was recorded for this decision.')}</p>
                    <div class="decision-policy"><span>Policy evidence</span><strong>${this._escape(policyLabel)}</strong></div>
                </article>
            `;
        }).join('');
    },

    render() {
        const container = document.getElementById('view-deal-room');
        if (!container) return;
        const syndication = this._activeSyndication();
        if (!syndication) {
            container.innerHTML = `
                <section class="deal-room deal-room-empty-state">
                    <span class="deal-room-eyebrow">Deal Room</span>
                    <h1>No workflow record selected</h1>
                    <p>Create or load a syndication to inspect its policy checks, book build, and approval trail.</p>
                    <button class="deal-room-button" onclick="Router.navigate('/originate')">Create a deal</button>
                </section>`;
            return;
        }

        const subscription = Number(syndication.subscription || 0);
        const bids = syndication.bids || [];
        const receiptState = this.receiptState[syndication.id] || { loading: true, loaded: false, receipts: [] };
        const status = this._escape(syndication.status || 'open');
        const approvalReady = Array.isArray(syndication.allocations) && syndication.allocations.length > 0;
        if (!receiptState.loaded && !receiptState.loading) this.loadDecisionReceipts(syndication.id);
        if (!this.receiptState[syndication.id]) this.loadDecisionReceipts(syndication.id);
        const receiptCount = receiptState.loaded ? receiptState.receipts.length : bids.length;

        container.innerHTML = `
            <section class="deal-room">
                <header class="deal-room-header">
                    <div>
                        <span class="deal-room-eyebrow">Deal Room · Review-first workflow</span>
                        <h1>${this._escape(syndication.borrower || 'Unnamed borrower')}</h1>
                        <p>${this._escape(syndication.id)} · ${this._escape(syndication.industry || 'Industry not recorded')} · ${this._escape(syndication.rating || 'NR')}</p>
                    </div>
                    <div class="deal-room-statuses">
                        <span class="deal-room-status">${status}</span>
                        <span class="deal-room-simulation">Simulation · no funds move</span>
                    </div>
                </header>

                <div class="deal-room-grid">
                    <section class="deal-room-card book-card">
                        <div class="deal-room-card-heading">
                            <div><span>01 · Book build</span><h2>Recorded market state</h2></div>
                            <span class="record-badge">Workflow data</span>
                        </div>
                        <div class="book-metrics">
                            <div><span>Facility</span><strong>${this._formatAmount(syndication.amount)}</strong></div>
                            <div><span>Clearing / current spread</span><strong>${this._escape(syndication.spread || '—')} bps</strong></div>
                            <div><span>Recorded decisions</span><strong>${receiptCount}</strong></div>
                        </div>
                        <div class="coverage-row"><span>Subscription</span><strong>${subscription.toFixed(0)}%</strong></div>
                        <div class="coverage-track"><div class="coverage-fill" style="width: ${Math.max(0, Math.min(subscription, 100))}%"></div></div>
                        <p class="deal-room-note">Coverage and pricing are read from the selected workflow record. They are not live market data.</p>
                    </section>

                    <section class="deal-room-card approval-card">
                        <div class="deal-room-card-heading">
                            <div><span>02 · Control point</span><h2>Allocation approval</h2></div>
                            <span class="approval-icon">${approvalReady ? 'Ready for review' : 'Awaiting proposal'}</span>
                        </div>
                        <p>${approvalReady
        ? 'A proposed allocation may be approved, overridden with a reason, or rejected. The action is recorded separately from the agent proposal.'
        : 'The approval gate remains closed until the workflow creates a proposed allocation.'}</p>
                        <div class="approval-checks">
                            <span>✓ Policy-constrained proposal</span>
                            <span>✓ Attributable human decision</span>
                            <span>✓ Simulation-only settlement</span>
                        </div>
                        ${approvalReady ? `<button class="approval-button" data-allocation-approval="${this._escape(syndication.id)}">Record allocation approval</button>` : ''}
                    </section>
                </div>

                <section class="deal-room-card decision-replay-card">
                    <div class="deal-room-card-heading">
                        <div><span>03 · Decision Replay</span><h2>Why did the agents act?</h2></div>
                        <span class="record-badge">Evidence view</span>
                    </div>
                    <p class="decision-replay-intro">${this._escape(receiptState.disclosure || 'Each receipt links an outcome to the workflow evidence available at the time. Missing rationale is disclosed rather than inferred.')}</p>
                    <div class="decision-receipt-grid">${this._receiptRows(receiptState.receipts, receiptState.loading)}</div>
                </section>
            </section>
        `;
    },

    injectStyles() {
        if (document.getElementById('deal-room-styles')) return;
        const style = document.createElement('style');
        style.id = 'deal-room-styles';
        style.textContent = `
            .deal-room { max-width: 1240px; margin: 0 auto; padding: 2rem; }
            .deal-room-header { display:flex; justify-content:space-between; gap:1.5rem; align-items:flex-start; margin-bottom:1.5rem; }
            .deal-room-eyebrow, .deal-room-card-heading > div > span { color:var(--primary); font-size:.72rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
            .deal-room-header h1 { margin:.25rem 0; font-size:2rem; }
            .deal-room-header p, .deal-room-note, .decision-replay-intro, .approval-card > p { color:var(--text-secondary); }
            .deal-room-statuses { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:.5rem; }
            .deal-room-status, .deal-room-simulation, .record-badge, .approval-icon { border-radius:999px; padding:.32rem .65rem; font-size:.72rem; font-weight:700; }
            .deal-room-status { background:var(--success-bg); color:#047857; text-transform:capitalize; }
            .deal-room-simulation { background:var(--warning-bg); color:#92400e; }
            .record-badge { background:#eff6ff; color:var(--primary-dark); }
            .approval-icon { background:#f1f5f9; color:var(--text-secondary); white-space:nowrap; }
            .deal-room-grid { display:grid; grid-template-columns:1.35fr .9fr; gap:1rem; margin-bottom:1rem; }
            .deal-room-card { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-xl); padding:1.25rem; box-shadow:var(--shadow-card); }
            .deal-room-card-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
            .deal-room-card-heading h2 { font-size:1.12rem; margin:.18rem 0 0; }
            .book-metrics { display:grid; grid-template-columns:repeat(3,1fr); border-block:1px solid var(--border-light); margin:1rem 0; }
            .book-metrics div { padding:.75rem .75rem .75rem 0; }
            .book-metrics div + div { border-left:1px solid var(--border-light); padding-left:.75rem; }
            .book-metrics span, .coverage-row span { display:block; color:var(--text-muted); font-size:.75rem; margin-bottom:.2rem; }
            .book-metrics strong { color:var(--text-primary); font-size:1rem; }
            .coverage-row { display:flex; justify-content:space-between; font-size:.85rem; margin-top:.8rem; }
            .coverage-row span { margin:0; }
            .coverage-track { height:.5rem; border-radius:999px; background:#e2e8f0; overflow:hidden; margin:.45rem 0 .8rem; }
            .coverage-fill { height:100%; background:linear-gradient(90deg, var(--primary), #60a5fa); }
            .deal-room-note { font-size:.77rem; margin:0; }
            .approval-card > p { font-size:.88rem; line-height:1.55; margin:0 0 1rem; }
            .approval-checks { display:grid; gap:.5rem; font-size:.8rem; color:#047857; }
            .approval-button { margin-top:1rem; width:100%; border:0; border-radius:.5rem; background:var(--primary); color:#fff; cursor:pointer; font-weight:700; padding:.65rem .8rem; }.approval-button:hover { background:var(--primary-dark); }
            .decision-replay-card { margin-top:1rem; }
            .decision-replay-intro { font-size:.85rem; margin:-.25rem 0 1rem; }
            .decision-receipt-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:.75rem; }
            .decision-receipt { border:1px solid var(--border-light); background:#fbfdff; padding:1rem; border-radius:var(--radius-lg); }
            .decision-receipt-head { display:flex; justify-content:space-between; gap:.5rem; color:var(--text-muted); font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; }
            .decision-status { color:var(--primary-dark); font-weight:700; }
            .decision-receipt h3 { font-size:.95rem; margin:.55rem 0 .25rem; }
            .decision-recommendation { color:var(--primary-dark); font-size:.84rem; font-weight:700; margin:0 0 .55rem; }
            .decision-rationale { color:var(--text-secondary); font-size:.8rem; line-height:1.45; margin:0 0 .85rem; }
            .decision-policy { border-top:1px solid var(--border-light); padding-top:.65rem; display:flex; flex-direction:column; gap:.12rem; font-size:.72rem; }
            .decision-policy span { color:var(--text-muted); }.decision-policy strong { color:#047857; }
            .deal-room-empty-state { min-height:50vh; display:flex; flex-direction:column; justify-content:center; max-width:640px; }.deal-room-empty-state h1 { margin:.5rem 0; }.deal-room-empty-state p { color:var(--text-secondary); margin-bottom:1rem; }.deal-room-button { align-self:flex-start; border:0; border-radius:.5rem; background:var(--primary); color:white; padding:.7rem 1rem; font-weight:700; cursor:pointer; }
            .deal-room-empty { color:var(--text-secondary); font-size:.88rem; padding:1rem 0; }
            @media (max-width: 760px) { .deal-room { padding:1rem; }.deal-room-header, .deal-room-card-heading { flex-direction:column; }.deal-room-statuses { justify-content:flex-start; }.deal-room-grid { grid-template-columns:1fr; }.book-metrics { grid-template-columns:1fr; }.book-metrics div + div { border-left:0; border-top:1px solid var(--border-light); padding-left:0; } }
        `;
        document.head.appendChild(style);
    }
};

window.DealRoom = DealRoom;
