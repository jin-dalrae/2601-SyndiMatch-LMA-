// ========================================
// Alerts Component
// ========================================

const AlertsComponent = {
    init() {
        this.render();
        this.setupToggle();
    },

    render() {
        const container = document.getElementById('alerts-content');
        if (!container) return;

        const alertGroups = [
            { level: 'critical', title: 'CRITICAL', icon: '🔴', alerts: SyndiData.alerts.critical },
            { level: 'warning', title: 'WARNING', icon: '🟡', alerts: SyndiData.alerts.warning },
            { level: 'info', title: 'INFO', icon: '🟢', alerts: SyndiData.alerts.info }
        ];

        container.innerHTML = alertGroups.map(group => `
            <div class="alert-group">
                <div class="alert-group-title ${group.level}">
                    ${group.icon} ${group.title}
                </div>
                ${group.alerts.map(alert => `
                    <div class="alert-item ${group.level}">
                        <div class="alert-content">
                            <div class="alert-message">[${alert.syndId}] ${alert.message}</div>
                            <div class="alert-meta">${alert.meta}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');

        // Update badge count
        const totalCritical = SyndiData.alerts.critical.length + SyndiData.alerts.warning.length;
        const badge = document.getElementById('alert-count');
        if (badge) badge.textContent = totalCritical;
    },

    setupToggle() {
        const toggle = document.getElementById('alerts-toggle');
        const sidebar = document.getElementById('alerts-sidebar');
        const close = document.getElementById('alerts-close');

        toggle?.addEventListener('click', () => sidebar?.classList.add('open'));
        close?.addEventListener('click', () => sidebar?.classList.remove('open'));
    }
};
