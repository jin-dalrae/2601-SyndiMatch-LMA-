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
            const button = event.target.closest('[data-allocation-decision]');
            if (button) this.recordDecision(button.dataset.allocationDecision);
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

    _humanize(value) {
        return String(value || 'not recorded').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    },

    _participantName(participantId, bid) {
        return bid?.institution_name || window.SyndiData?.participants?.find(item => item.id === participantId)?.name || participantId;
    },

    _allocationRows(syndication) {
        const bidsByParticipant = new Map((syndication.bids || []).map(bid => [bid.participant_agent_id, bid]));
        const allocations = syndication.allocations || [];
        if (!allocations.length) return '<tr><td colspan="4" class="allocation-empty">No allocation proposal has been recorded.</td></tr>';
        return allocations.map(allocation => {
            const bid = bidsByParticipant.get(allocation.participantId);
            return `<tr>
                <td><strong>${this._escape(this._participantName(allocation.participantId, bid))}</strong><span>${this._escape(allocation.participantId)}</span></td>
                <td>${this._formatAmount(bid?.bid_amount)}</td>
                <td><strong>${this._formatAmount(allocation.finalAllocation)}</strong></td>
                <td>${this._escape(allocation.finalSpread)} bps</td>
            </tr>`;
        }).join('');
    },

    _activeSyndication() {
        const syndications = window.SyndiData?.syndications || [];
        const activeId = window.AppState?.get('activeSyndicationId') || window.AppState?.get('currentSyndicationId');
        return syndications.find(item => item.id === activeId) || syndications[0] || null;
    },

    async loadDecisionReceipts(syndicationId) {
        if (!syndicationId || !window.API || this.receiptState[syndicationId]?.loaded) return;

        this.receiptState[syndicationId] = { loading: true, loaded: false, receipts: [] };
        const [response, events] = await Promise.all([
            API.get('server', `/syndications/${encodeURIComponent(syndicationId)}/decision-receipts`),
            API.get('server', `/syndication-events/${encodeURIComponent(syndicationId)}`)
        ]);
        this.receiptState[syndicationId] = {
            loading: false,
            loaded: true,
            receipts: Array.isArray(response?.receipts) ? response.receipts : [],
            events: Array.isArray(events) ? events : [],
            disclosure: response?.disclosure || 'Decision receipts are unavailable because no workflow evidence could be loaded.'
        };

        if (window.AppState?.get('currentView') === 'deal-room') this.render();
    },

    async recordDecision(syndicationId) {
        if (!syndicationId || !window.API) return;
        let session = await API.get('server', '/auth/me');
        if (!session?.actor) {
            const authenticated = await this._requestReviewerLogin();
            if (!authenticated) return;
            session = await API.get('server', '/auth/me');
        }
        const proposal = await API.get('server', `/syndications/${encodeURIComponent(syndicationId)}/allocation-proposal`);
        if (!proposal?.allocationFingerprint || !Number.isInteger(proposal?.allocationVersion)) {
            window.App?.showToast('The allocation proposal could not be integrity-checked.', 'error');
            return;
        }
        const review = await this._requestAllocationDecision(proposal);
        if (!review) return;

        const result = await API.post('server', `/syndications/${encodeURIComponent(syndicationId)}/allocation-approval`, {
            decision: review.decision,
            reason: review.reason,
            allocationVersion: proposal.allocationVersion,
            allocationFingerprint: proposal.allocationFingerprint
        });

        if (result?.approvalId || result?.approval_id) {
            if (review.decision === 'rejected') {
                window.App?.showToast('Allocation rejected. The reason was recorded in the audit trail.', 'info');
            } else {
                const settlement = await API.post('server', `/syndications/${encodeURIComponent(syndicationId)}/continue`, {});
                const settled = settlement?.mode === 'simulation' && settlement?.fundsMoved === false;
                window.App?.showToast(settled
                    ? 'Decision recorded and simulation-only settlement completed.'
                    : 'Decision recorded; settlement remains pending.', settled ? 'success' : 'info');
            }
            API.invalidateCache('/all-data');
            API.invalidateCache('/syndications');
            delete this.receiptState[syndicationId];
            await window.SyndiData?.refresh();
            this.render();
        } else {
            window.App?.showToast('No proposed allocation is ready for approval.', 'error');
        }
    },

    _requestAllocationDecision(proposal) {
        return new Promise(resolve => {
            document.getElementById('allocation-review-dialog')?.remove();
            const dialog = document.createElement('dialog');
            dialog.id = 'allocation-review-dialog';
            dialog.className = 'allocation-review-dialog';
            const fingerprint = this._escape(proposal.allocationFingerprint || 'Not recorded');
            dialog.innerHTML = `
                <form method="dialog" class="allocation-review-form">
                    <span class="deal-room-eyebrow">Credit committee control</span>
                    <h2>Record allocation decision</h2>
                    <p>Bind the decision to this exact proposal. Override and rejection require an attributable rationale.</p>
                    <dl>
                        <div><dt>Proposal</dt><dd>Version ${this._escape(proposal.allocationVersion)}</dd></div>
                        <div><dt>Allocated</dt><dd>${this._formatAmount(proposal.allocatedAmount)}</dd></div>
                        <div><dt>Residual</dt><dd>${this._formatAmount(proposal.residualAmount)}</dd></div>
                        <div class="fingerprint-row"><dt>Fingerprint</dt><dd title="${fingerprint}">${fingerprint}</dd></div>
                    </dl>
                    <fieldset>
                        <legend>Decision</legend>
                        <label><input type="radio" name="decision" value="approved" checked><span><strong>Approve</strong><small>Accept the proposal as calculated</small></span></label>
                        <label><input type="radio" name="decision" value="override"><span><strong>Approve with exception</strong><small>Accept with a documented committee exception</small></span></label>
                        <label><input type="radio" name="decision" value="rejected"><span><strong>Reject</strong><small>Return the allocation for revision</small></span></label>
                    </fieldset>
                    <label class="decision-reason">Committee rationale<textarea name="reason" rows="3" maxlength="1000" placeholder="Required for exception or rejection"></textarea></label>
                    <p class="allocation-review-error" role="alert"></p>
                    <div class="allocation-review-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Record decision</button></div>
                </form>`;
            document.body.appendChild(dialog);
            const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
            dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
            dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
            dialog.querySelector('form').addEventListener('submit', event => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const decision = String(data.get('decision') || '');
                const reason = String(data.get('reason') || '').trim();
                if ((decision === 'override' || decision === 'rejected') && !reason) {
                    dialog.querySelector('.allocation-review-error').textContent = 'A committee rationale is required for this decision.';
                    dialog.querySelector('textarea').focus();
                    return;
                }
                finish({ decision, reason });
            });
            dialog.showModal();
        });
    },

    _requestReviewerLogin() {
        return new Promise(resolve => {
            document.getElementById('reviewer-login-dialog')?.remove();
            const dialog = document.createElement('dialog');
            dialog.id = 'reviewer-login-dialog';
            dialog.className = 'reviewer-login-dialog';
            dialog.innerHTML = `
                <form method="dialog" class="reviewer-login-form">
                    <span class="deal-room-eyebrow">Controlled action</span>
                    <h2>Reviewer authentication</h2>
                    <p>Enter the credit-committee reviewer password. The password is exchanged for a secure HttpOnly session and is not stored by the browser.</p>
                    <label>Reviewer password<input name="password" type="password" minlength="12" autocomplete="current-password" required></label>
                    <p class="reviewer-login-error" role="alert"></p>
                    <div><button value="cancel" type="button" data-cancel>Cancel</button><button value="login" type="submit">Authenticate</button></div>
                </form>`;
            document.body.appendChild(dialog);
            const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
            dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
            dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
            dialog.querySelector('form').addEventListener('submit', async event => {
                event.preventDefault();
                const password = new FormData(event.currentTarget).get('password');
                const submit = event.currentTarget.querySelector('[type="submit"]');
                submit.disabled = true;
                const result = await API.post('server', '/auth/login', { password });
                if (result?.actor) return finish(true);
                submit.disabled = false;
                dialog.querySelector('.reviewer-login-error').textContent = 'Authentication failed. Check the reviewer password.';
            });
            dialog.showModal();
            dialog.querySelector('input').focus();
        });
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

    _eventRows(events = []) {
        if (!events.length) return '<p class="workflow-event-empty">No workflow events recorded.</p>';
        return events.slice(-6).reverse().map(event => `
            <li><i></i><div><strong>${this._humanize(event.event_type)}</strong><span>${this._escape(event.actor || 'System')} · ${this._escape(new Date(event.created_at || event.timestamp).toLocaleString())}</span></div></li>
        `).join('');
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
        const receiptState = this.receiptState[syndication.id] || { loading: true, loaded: false, receipts: [], events: [] };
        const approvalReady = Array.isArray(syndication.allocations) && syndication.allocations.length > 0;
        const approvalPending = approvalReady && (!syndication.allocationStatus || syndication.allocationStatus === 'pending_approval');
        const allocationApproved = syndication.allocationStatus === 'approved' || syndication.status === 'settled';
        const settlementComplete = syndication.status === 'settled';
        const allocatedAmount = (syndication.allocations || []).reduce((sum, row) => sum + Number(row.finalAllocation || 0), 0);
        const targetAmount = Number(syndication.target || 0) * 1_000_000;
        const residualAmount = Math.max(0, targetAmount - allocatedAmount);
        if (!receiptState.loaded && !receiptState.loading) this.loadDecisionReceipts(syndication.id);
        if (!this.receiptState[syndication.id]) this.loadDecisionReceipts(syndication.id);
        const receiptCount = receiptState.loaded ? receiptState.receipts.length : bids.length;

        container.innerHTML = `
            <section class="deal-room">
                <header class="deal-room-header">
                    <div>
                        <span class="deal-room-eyebrow">Credit Desk / ${this._escape(syndication.id)}</span>
                        <h1>${this._escape(syndication.borrower || 'Unnamed borrower')}</h1>
                        <p>${this._escape(syndication.industry || 'Industry not recorded')} · ${this._escape(syndication.rating || 'NR')} · ${this._humanize(syndication.status)}</p>
                    </div>
                    <div class="deal-room-disclosure">
                        <strong>Controlled simulation</strong>
                        <span>Canonical D1 records · no funds move</span>
                    </div>
                </header>

                <div class="workflow-progress" aria-label="Workflow progress">
                    <div class="credit-workflow-step complete"><i>1</i><span>Book formed<small>${bids.length} recorded bids</small></span></div>
                    <div class="credit-workflow-step ${approvalReady ? 'complete' : 'current'}"><i>2</i><span>Allocation proposed<small>${approvalReady ? `Version ${this._escape(syndication.allocationVersion)}` : 'Not yet created'}</small></span></div>
                    <div class="credit-workflow-step ${allocationApproved ? 'complete' : (approvalPending ? 'current' : '')}"><i>3</i><span>Human approval<small>${approvalPending ? 'Action required' : (allocationApproved ? 'Recorded' : 'Gate closed')}</small></span></div>
                    <div class="credit-workflow-step ${settlementComplete ? 'complete' : (allocationApproved ? 'current' : '')}"><i>4</i><span>Simulated close<small>${settlementComplete ? 'Receipt recorded' : 'No funds move'}</small></span></div>
                </div>

                <div class="deal-kpis">
                    <div><span>Syndication target</span><strong>${this._formatAmount(syndication.target)}</strong></div>
                    <div><span>Recorded demand</span><strong>${this._formatAmount(bids.reduce((sum, bid) => sum + Number(bid.bid_amount || 0), 0))}</strong></div>
                    <div><span>Book coverage</span><strong>${subscription.toFixed(0)}%</strong></div>
                    <div><span>Proposed / residual</span><strong>${this._formatAmount(allocatedAmount)} <em>/ ${this._formatAmount(residualAmount)}</em></strong></div>
                </div>

                <div class="deal-room-grid">
                    <section class="deal-room-card book-card">
                        <div class="deal-room-card-heading">
                            <div><span>Allocation proposal</span><h2>Recommended lender book</h2></div>
                            <span class="record-badge">Version ${this._escape(syndication.allocationVersion || '—')}</span>
                        </div>
                        <div class="allocation-table-wrap"><table class="allocation-table">
                            <thead><tr><th>Participant</th><th>Bid</th><th>Proposed</th><th>Final spread</th></tr></thead>
                            <tbody>${this._allocationRows(syndication)}</tbody>
                        </table></div>
                        <p class="deal-room-note">The proposal is deterministic, concentration-capped, fingerprinted, and read from canonical workflow state.</p>
                    </section>

                    <section class="deal-room-card approval-card">
                        <div class="deal-room-card-heading">
                            <div><span>Control point</span><h2>Credit committee review</h2></div>
                            <span class="approval-icon">${approvalPending ? 'Ready for review' : this._escape(syndication.allocationStatus || 'Awaiting proposal')}</span>
                        </div>
                        <p>${approvalReady
        ? 'A proposed allocation may be approved, overridden with a reason, or rejected. The action is recorded separately from the agent proposal.'
        : 'The approval gate remains closed until the workflow creates a proposed allocation.'}</p>
                        <div class="approval-checks">
                            <span>✓ Policy-constrained proposal</span>
                            <span>✓ Attributable human decision</span>
                            <span>✓ Simulation-only settlement</span>
                        </div>
                        ${approvalPending ? `<button class="approval-button" data-allocation-decision="${this._escape(syndication.id)}">Review exact proposal</button>` : ''}
                    </section>
                </div>

                <section class="deal-room-card decision-replay-card">
                    <div class="deal-room-card-heading">
                            <div><span>Decision evidence</span><h2>Why did each participant bid?</h2></div>
                        <span class="record-badge">${receiptCount} receipts</span>
                    </div>
                    <p class="decision-replay-intro">${this._escape(receiptState.disclosure || 'Each receipt links an outcome to the workflow evidence available at the time. Missing rationale is disclosed rather than inferred.')}</p>
                    <div class="decision-receipt-grid">${this._receiptRows(receiptState.receipts, receiptState.loading)}</div>
                    <div class="workflow-audit"><div><span class="deal-room-eyebrow">Workflow audit</span><h3>Recorded control events</h3></div><ol>${this._eventRows(receiptState.events)}</ol></div>
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
            .deal-room-header h1 { margin:.25rem 0; font-size:2rem; letter-spacing:-.025em; }
            .deal-room-header p, .deal-room-note, .decision-replay-intro, .approval-card > p { color:var(--text-secondary); }
            .deal-room-disclosure { border-left:2px solid #f59e0b; padding:.15rem 0 .15rem .85rem; display:grid; gap:.12rem; text-align:right; }
            .deal-room-disclosure strong { color:#92400e; font-size:.77rem; text-transform:uppercase; letter-spacing:.055em; }
            .deal-room-disclosure span { color:var(--text-muted); font-size:.75rem; }
            .record-badge, .approval-icon { border-radius:999px; padding:.32rem .65rem; font-size:.72rem; font-weight:700; }
            .record-badge { background:#eff6ff; color:var(--primary-dark); }
            .approval-icon { background:#f1f5f9; color:var(--text-secondary); white-space:nowrap; }
            .workflow-progress { display:grid; grid-template-columns:repeat(4,1fr); margin-bottom:1rem; border:1px solid var(--border-color); border-radius:var(--radius-xl); background:var(--bg-card); overflow:hidden; }
            .credit-workflow-step { display:flex; align-items:center; gap:.65rem; padding:.85rem 1rem; color:var(--text-muted); position:relative; }
            .credit-workflow-step + .credit-workflow-step { border-left:1px solid var(--border-light); }
            .credit-workflow-step i { display:grid; place-items:center; width:1.65rem; height:1.65rem; flex:0 0 auto; border:1px solid #cbd5e1; border-radius:50%; font-size:.7rem; font-style:normal; font-weight:800; }
            .credit-workflow-step span { display:grid; font-size:.78rem; font-weight:700; }
            .credit-workflow-step small { font-size:.68rem; font-weight:500; color:var(--text-muted); }
            .credit-workflow-step.complete i { color:#fff; border-color:#059669; background:#059669; }
            .credit-workflow-step.complete { color:#065f46; }
            .credit-workflow-step.current { color:var(--primary-dark); background:#eff6ff; }
            .credit-workflow-step.current i { color:#fff; border-color:var(--primary); background:var(--primary); }
            .deal-kpis { display:grid; grid-template-columns:repeat(4,1fr); margin-bottom:1rem; border:1px solid var(--border-color); border-radius:var(--radius-xl); background:var(--bg-card); }
            .deal-kpis > div { padding:1rem 1.1rem; }
            .deal-kpis > div + div { border-left:1px solid var(--border-light); }
            .deal-kpis span { display:block; color:var(--text-muted); font-size:.71rem; font-weight:650; margin-bottom:.2rem; text-transform:uppercase; letter-spacing:.035em; }
            .deal-kpis strong { font-size:1.15rem; letter-spacing:-.02em; }
            .deal-kpis em { color:var(--text-muted); font-size:.82rem; font-style:normal; font-weight:600; }
            .deal-room-grid { display:grid; grid-template-columns:1.35fr .9fr; gap:1rem; margin-bottom:1rem; }
            .deal-room-card { background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-xl); padding:1.25rem; box-shadow:var(--shadow-card); }
            .deal-room-card-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
            .deal-room-card-heading h2 { font-size:1.12rem; margin:.18rem 0 0; }
            .book-metrics { display:grid; grid-template-columns:repeat(3,1fr); border-block:1px solid var(--border-light); margin:1rem 0; }
            .book-metrics div { padding:.75rem .75rem .75rem 0; }
            .book-metrics div + div { border-left:1px solid var(--border-light); padding-left:.75rem; }
            .book-metrics span, .coverage-row span { display:block; color:var(--text-muted); font-size:.75rem; margin-bottom:.2rem; }
            .book-metrics strong { color:var(--text-primary); font-size:1rem; }
            .allocation-table-wrap { overflow-x:auto; }
            .allocation-table { width:100%; border-collapse:collapse; font-size:.8rem; margin:.2rem 0 .85rem; }
            .allocation-table th { padding:.55rem .65rem; border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:.67rem; letter-spacing:.045em; text-align:left; text-transform:uppercase; }
            .allocation-table td { padding:.72rem .65rem; border-bottom:1px solid var(--border-light); color:var(--text-secondary); }
            .allocation-table td:first-child span { display:block; color:var(--text-muted); font-size:.67rem; margin-top:.1rem; }
            .allocation-table td strong { color:var(--text-primary); }
            .allocation-empty { color:var(--text-muted); text-align:center; padding:1.5rem!important; }
            .coverage-row { display:flex; justify-content:space-between; font-size:.85rem; margin-top:.8rem; }
            .coverage-row span { margin:0; }
            .coverage-track { height:.5rem; border-radius:999px; background:#e2e8f0; overflow:hidden; margin:.45rem 0 .8rem; }
            .coverage-fill { height:100%; background:linear-gradient(90deg, var(--primary), #60a5fa); }
            .deal-room-note { font-size:.77rem; margin:0; }
            .approval-card > p { font-size:.88rem; line-height:1.55; margin:0 0 1rem; }
            .approval-checks { display:grid; gap:.5rem; font-size:.8rem; color:#047857; }
            .approval-button { margin-top:1rem; width:100%; border:0; border-radius:.5rem; background:var(--primary); color:#fff; cursor:pointer; font-weight:700; padding:.65rem .8rem; }.approval-button:hover { background:var(--primary-dark); }
            .reviewer-login-dialog { max-width:28rem; border:0; border-radius:1rem; padding:0; box-shadow:0 24px 70px rgba(15,23,42,.3); }
            .reviewer-login-dialog::backdrop { background:rgba(15,23,42,.58); backdrop-filter:blur(3px); }
            .reviewer-login-form { display:grid; gap:1rem; padding:1.5rem; }
            .reviewer-login-form h2,.reviewer-login-form p { margin:0; }
            .reviewer-login-form label { display:grid; gap:.45rem; font-size:.82rem; font-weight:700; }
            .reviewer-login-form input { border:1px solid var(--border); border-radius:.55rem; padding:.7rem; font:inherit; }
            .reviewer-login-form > div { display:flex; justify-content:flex-end; gap:.6rem; }
            .reviewer-login-form button { border:0; border-radius:.5rem; padding:.6rem .85rem; cursor:pointer; }
            .reviewer-login-form button[type="submit"] { background:var(--primary); color:#fff; font-weight:700; }
            .reviewer-login-error { color:#b91c1c; min-height:1.2rem; font-size:.8rem; }
            .allocation-review-dialog { width:min(94vw,38rem); border:0; border-radius:1rem; padding:0; box-shadow:0 24px 70px rgba(15,23,42,.3); }
            .allocation-review-dialog::backdrop { background:rgba(15,23,42,.58); backdrop-filter:blur(3px); }
            .allocation-review-form { display:grid; gap:1rem; padding:1.5rem; }
            .allocation-review-form h2,.allocation-review-form p { margin:0; }
            .allocation-review-form > p { color:var(--text-secondary); font-size:.84rem; }
            .allocation-review-form dl { display:grid; grid-template-columns:repeat(3,1fr); margin:0; border:1px solid var(--border-color); border-radius:.7rem; overflow:hidden; }
            .allocation-review-form dl > div { padding:.65rem .75rem; }
            .allocation-review-form dl > div + div { border-left:1px solid var(--border-light); }
            .allocation-review-form .fingerprint-row { grid-column:1/-1; border-left:0; border-top:1px solid var(--border-light); }
            .allocation-review-form dt { color:var(--text-muted); font-size:.66rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
            .allocation-review-form dd { margin:.15rem 0 0; font-size:.82rem; font-weight:700; }
            .allocation-review-form .fingerprint-row dd { overflow:hidden; color:var(--text-secondary); font-family:monospace; font-size:.72rem; text-overflow:ellipsis; white-space:nowrap; }
            .allocation-review-form fieldset { display:grid; gap:.5rem; border:0; padding:0; }
            .allocation-review-form legend { margin-bottom:.45rem; font-size:.78rem; font-weight:700; }
            .allocation-review-form fieldset label { display:flex; align-items:flex-start; gap:.65rem; padding:.7rem .75rem; border:1px solid var(--border-color); border-radius:.65rem; cursor:pointer; }
            .allocation-review-form fieldset label:has(input:checked) { border-color:var(--primary); background:#eff6ff; }
            .allocation-review-form fieldset input { margin-top:.2rem; accent-color:var(--primary); }
            .allocation-review-form fieldset span { display:grid; }
            .allocation-review-form fieldset strong { font-size:.82rem; }
            .allocation-review-form fieldset small { color:var(--text-muted); font-size:.72rem; }
            .decision-reason { display:grid; gap:.4rem; font-size:.78rem; font-weight:700; }
            .decision-reason textarea { resize:vertical; border:1px solid var(--border-color); border-radius:.6rem; padding:.7rem; font:inherit; }
            .allocation-review-error { color:#b91c1c!important; min-height:1.2rem; font-size:.78rem!important; }
            .allocation-review-actions { display:flex; justify-content:flex-end; gap:.6rem; }
            .allocation-review-actions button { border:0; border-radius:.5rem; padding:.65rem .9rem; cursor:pointer; }
            .allocation-review-actions button[type="submit"] { color:#fff; background:var(--primary); font-weight:700; }
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
            .workflow-audit { display:grid; grid-template-columns:14rem 1fr; gap:1rem; margin-top:1.25rem; padding-top:1.1rem; border-top:1px solid var(--border-light); }
            .workflow-audit h3 { margin:.2rem 0 0; font-size:.95rem; }
            .workflow-audit ol { display:grid; gap:.65rem; margin:0; padding:0; list-style:none; }
            .workflow-audit li { display:flex; align-items:flex-start; gap:.65rem; }
            .workflow-audit li i { width:.48rem; height:.48rem; flex:0 0 auto; margin-top:.3rem; border-radius:50%; background:var(--primary); box-shadow:0 0 0 4px #eff6ff; }
            .workflow-audit li div { display:grid; }
            .workflow-audit li strong { font-size:.78rem; }
            .workflow-audit li span,.workflow-event-empty { color:var(--text-muted); font-size:.7rem; }
            .deal-room-empty-state { min-height:50vh; display:flex; flex-direction:column; justify-content:center; max-width:640px; }.deal-room-empty-state h1 { margin:.5rem 0; }.deal-room-empty-state p { color:var(--text-secondary); margin-bottom:1rem; }.deal-room-button { align-self:flex-start; border:0; border-radius:.5rem; background:var(--primary); color:white; padding:.7rem 1rem; font-weight:700; cursor:pointer; }
            .deal-room-empty { color:var(--text-secondary); font-size:.88rem; padding:1rem 0; }
            @media (max-width: 900px) { .workflow-progress, .deal-kpis { grid-template-columns:repeat(2,1fr); }.credit-workflow-step:nth-child(3), .deal-kpis > div:nth-child(3) { border-left:0; border-top:1px solid var(--border-light); } }
            @media (max-width: 760px) { .deal-room { padding:1rem; }.deal-room-header, .deal-room-card-heading { flex-direction:column; }.deal-room-disclosure { text-align:left; }.deal-room-grid { grid-template-columns:1fr; }.book-metrics { grid-template-columns:1fr; }.book-metrics div + div { border-left:0; border-top:1px solid var(--border-light); padding-left:0; }.workflow-audit { grid-template-columns:1fr; } }
            @media (max-width: 520px) { .workflow-progress, .deal-kpis { grid-template-columns:1fr; }.credit-workflow-step + .credit-workflow-step, .credit-workflow-step:nth-child(3), .deal-kpis > div + div, .deal-kpis > div:nth-child(3) { border-left:0; border-top:1px solid var(--border-light); } }
        `;
        document.head.appendChild(style);
    }
};

window.DealRoom = DealRoom;
