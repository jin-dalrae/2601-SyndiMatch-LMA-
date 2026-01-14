/**
 * Origination Form Component
 * Creates a live syndication via API and triggers the agent run.
 */
const OriginationForm = {
    init() {
        const form = document.getElementById('origination-form');
        const demoBtn = document.getElementById('btn-originate-demo');
        if (!form) return;

        // Disable form if current role is not an originator
        this._syncRoleGate();
        const roleDropdown = document.getElementById('role-dropdown');
        if (roleDropdown) {
            roleDropdown.addEventListener('change', () => this._syncRoleGate());
        }

        form.addEventListener('submit', (e) => this.handleSubmit(e));
        if (demoBtn) demoBtn.addEventListener('click', (e) => this.handleDemo(e));
    },

    async handleSubmit(e) {
        e.preventDefault();
        const statusEl = document.getElementById('origination-status');
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        const roleDropdown = document.getElementById('role-dropdown');
        const role = roleDropdown ? roleDropdown.value : '';
        if (!role.startsWith('originator:')) {
            statusEl.textContent = 'Only Originator roles can create deals.';
            return;
        }

        payload.originator_agent_id = role.replace('originator:', '') || payload.originator_agent_id || 'OA-001';
        payload.role = role;

        // Normalize numbers
        payload.amount = Number(payload.amount) || 0;
        payload.spread = Number(payload.spread) || 0;
        payload.rating = payload.rating || 'NR';
        payload.industry = payload.industry || 'Unknown';
        payload.originator = this._resolveOriginatorName(payload.originator_agent_id);

        try {
            statusEl.textContent = 'Creating...';
            const synd = await API.post('server', '/syndications', payload);
            if (!synd) throw new Error('API did not return a syndication');

            // Push into SyndiData for immediate UI reflection
            if (typeof SyndiData !== 'undefined') {
                SyndiData.syndications = SyndiData.syndications || [];
                const entry = {
                    id: synd._id || synd.syndication_id,
                    borrower: synd.borrower,
                    amount: synd.amount,
                    rating: synd.rating,
                    originator: synd.originator,
                    spread: synd.spread,
                    subscription: synd.subscription || 0,
                    status: synd.status || 'open',
                    round: synd.round || 1,
                    timeRemaining: '48h'
                };
                SyndiData.syndications.unshift(entry);
                window.dispatchEvent(new CustomEvent('newSyndication', { detail: entry }));
            }

            statusEl.textContent = 'Created. Running agents...';

            // Trigger LangGraph run via WebSocket (AgentOrchestration)
            if (window.AgentOrchestration && window.AgentOrchestration.ws) {
                window.AgentOrchestration.ws.send(JSON.stringify({
                    type: 'run_syndication',
                    originator_id: payload.originator_agent_id || 'OA-001',
                    syndication_id: synd._id || synd.syndication_id,
                    step_mode: false
                }));
            }

            // Navigate to the orchestration page for the new deal
            if (window.App) {
                window.location.hash = `${synd._id || synd.syndication_id}/orchestration`;
            }

            statusEl.textContent = 'Live. Agents running.';
        } catch (err) {
            console.error(err);
            statusEl.textContent = `Error: ${err.message}`;
        }
    },

    handleDemo(e) {
        e.preventDefault();
        const form = document.getElementById('origination-form');
        if (!form) return;
        const presets = {
            borrower: 'NovaGrid Energy',
            amount: 420,
            spread: 410,
            rating: 'BBB-',
            industry: 'Energy',
            originator_agent_id: 'OA-002'
        };
        Object.entries(presets).forEach(([k, v]) => {
            const field = form.querySelector(`[name="${k}"]`);
            if (field) field.value = v;
        });
    },

    _resolveOriginatorName(id) {
        const map = {
            'OA-001': 'JPMorgan Chase',
            'OA-002': 'Bank of America',
            'OA-003': 'Citigroup',
            'OA-004': 'Goldman Sachs',
            'OA-005': 'Wells Fargo',
            'OA-006': 'BNP Paribas',
            'OA-007': 'Barclays',
            'OA-008': 'MUFG Bank'
        };
        return map[id] || 'Unknown Originator';
    },

    _syncRoleGate() {
        const form = document.getElementById('origination-form');
        const demoBtn = document.getElementById('btn-originate-demo');
        const statusEl = document.getElementById('origination-status');
        const roleDropdown = document.getElementById('role-dropdown');

        const role = roleDropdown ? roleDropdown.value : '';
        const isOriginator = role.startsWith('originator:');

        if (form) {
            Array.from(form.elements).forEach(el => {
                if (el.type !== 'button' && el.type !== 'submit') {
                    el.disabled = !isOriginator;
                }
            });
        }
        if (demoBtn) demoBtn.disabled = !isOriginator;

        if (!isOriginator) {
            statusEl.textContent = 'Switch to an Originator role to create deals.';
        } else {
            statusEl.textContent = '';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => OriginationForm.init());
