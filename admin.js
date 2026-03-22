// ===================================================
// RinglyAI — Admin Dashboard JS
// ===================================================

let ALL_CONFIGS = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check if token exists in session storage
    if (sessionStorage.getItem('admin_token')) {
        showDashboard();
    }

    // Login Form Submit
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('adminPassword').value;
        const btn = document.getElementById('btnLogin');
        const err = document.getElementById('loginError');

        btn.disabled = true;
        btn.innerHTML = 'Verifying...';
        err.innerHTML = '';

        try {
            const res = await fetch('/api/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            const data = await res.json();

            if (res.ok && data.token) {
                sessionStorage.setItem('admin_token', data.token);
                showDashboard();
            } else {
                throw new Error(data.error || 'Invalid credentials');
            }
        } catch (error) {
            err.innerHTML = error.message;
            btn.innerHTML = 'Access Dashboard';
            btn.disabled = false;
        }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', () => {
        sessionStorage.removeItem('admin_token');
        document.getElementById('dashboardScreen').style.display = 'none';
        document.getElementById('loginScreen').classList.add('visible');
        document.getElementById('btnLogout').style.display = 'none';
        document.getElementById('adminPassword').value = '';
    });

    // Search & Filters
    document.getElementById('searchInput').addEventListener('input', renderTable);
    document.getElementById('statusFilter').addEventListener('change', renderTable);
    document.getElementById('planFilter').addEventListener('change', renderTable);
    document.getElementById('btnRefresh').addEventListener('click', loadData);
});

function showDashboard() {
    document.getElementById('loginScreen').classList.remove('visible');
    document.getElementById('dashboardScreen').style.display = 'block';
    document.getElementById('btnLogout').style.display = 'block';
    loadData();
}

async function loadData() {
    const tableBody = document.getElementById('customersBody');
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-state">Syncing data from Supabase...</td></tr>';

    try {
        const token = sessionStorage.getItem('admin_token');
        const res = await fetch('/api/get-configs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            document.getElementById('btnLogout').click();
            return;
        }

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to fetch data');
        }

        ALL_CONFIGS = data.configs || [];
        updateStats();
        renderTable();

    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-state" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
}

function updateStats() {
    document.getElementById('statTotal').innerText = ALL_CONFIGS.length;
    const paid = ALL_CONFIGS.filter(c => ['paid', 'live', 'trial', 'active'].includes(c.status)).length;
    document.getElementById('statPaid').innerText = paid;
}

function renderTable() {
    const tbody = document.getElementById('customersBody');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const statusFilt = document.getElementById('statusFilter').value;
    const planFilt = document.getElementById('planFilter').value;

    let filtered = ALL_CONFIGS.filter(c => {
        // Text Match
        const matchText = (
            (c.customer_email || '').toLowerCase().includes(search) ||
            (c.business_name || '').toLowerCase().includes(search) ||
            (c.phone || '').toLowerCase().includes(search)
        );
        // Status Match
        const matchStatus = statusFilt === 'all' || c.status === statusFilt;
        // Plan Match
        const matchPlan = planFilt === 'all' || c.plan === planFilt;

        return matchText && matchStatus && matchPlan;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-state">No matching records found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const date = new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        return `
            <tr>
                <td><div class="td-sub">${date}</div></td>
                <td>
                    <div class="td-main">${c.customer_email}</div>
                </td>
                <td>
                    <div class="td-main">${c.business_name || '-'}</div>
                    <div class="td-sub">${c.industry || '-'} • ${c.country}</div>
                    ${c.phone ? `<div class="td-sub" style="margin-top:4px;">📞 ${c.phone}</div>` : ''}
                </td>
                <td>
                    <div class="badge plan-${c.plan}">${c.plan}</div><br>
                    <div class="badge ${c.status}">${c.status}</div>
                </td>
                <td>
                    ${c.voice_id ? `<div class="td-main" style="text-transform: capitalize;">${c.voice_id} (${c.language})</div>` : '<div class="td-main">SMS/Text</div>'}
                    ${c.style ? `<div class="td-sub" style="text-transform: capitalize;">Style: ${c.style}</div>` : ''}
                    ${c.script ? `<div class="script-snippet">${c.script}</div>` : ''}
                </td>
                <td>
                    <div class="td-sub"><b>ID:</b> ${c.stripe_session_id ? c.stripe_session_id.substring(0, 14) + '...' : '-'}</div>
                </td>
                <td>
                    ${c.booking_link ? `<div class="td-sub">📅 <a href="${c.booking_link}" target="_blank" style="color:var(--primary);">Booking Link</a></div>` : '<div class="td-sub" style="opacity:0.5;">No Booking Link</div>'}
                    ${c.crm_link ? `<div class="td-sub" style="margin-top:4px;">🔗 <span title="${c.crm_link}" style="cursor:help;">CRM Connected</span></div>` : '<div class="td-sub" style="opacity:0.5; margin-top:4px;">No CRM</div>'}
                </td>
            </tr>
        `;
    }).join('');
}
