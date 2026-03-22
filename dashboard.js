// ===================================================
// RinglyAI — Customer Dashboard Scripts
// ===================================================

let supabaseClient = null;
let currentUser = null;
let dashboardData = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch Supabase anon key securely
    try {
        const envRes = await fetch('/api/env');
        const env = await envRes.json();

        if (env.supabaseUrl && env.supabaseAnonKey) {
            supabaseClient = window.supabase.createClient(env.supabaseUrl, env.supabaseAnonKey);
        } else {
            document.getElementById('authMessage').innerText = 'System not configured yet.';
            return;
        }
    } catch (e) {
        console.error('Failed to init Supabase:', e);
        return;
    }

    // 2. Check current session
    const { data: { session } } = await supabaseClient.auth.getSession();

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            loadDashboard(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuth();
        }
    });

    if (session) {
        loadDashboard(session.user);
    } else {
        showAuth();
    }

    // 3. Login Form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = document.getElementById('btnLogin');
        const msg = document.getElementById('authMessage');

        btn.disabled = true;
        btn.innerHTML = 'Signing in...';
        msg.className = 'auth-msg';
        msg.innerText = '';

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            msg.innerText = error.message;
            msg.classList.add('error');
            btn.innerHTML = 'Sign In';
            btn.disabled = false;
        }
        // Success handled by onAuthStateChange
    });

    // 4. Register Form
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirm').value;
        const btn = document.getElementById('btnRegister');
        const msg = document.getElementById('authMessage');

        if (password !== confirm) {
            msg.innerText = 'Passwords do not match.';
            msg.className = 'auth-msg error';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = 'Creating account...';
        msg.className = 'auth-msg';
        msg.innerText = '';

        const { error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) {
            msg.innerText = error.message;
            msg.classList.add('error');
            btn.innerHTML = 'Create Account';
            btn.disabled = false;
        } else {
            msg.innerText = '✅ Account created! Check your email to verify, then sign in.';
            msg.classList.add('success');
            btn.innerHTML = 'Create Account';
            btn.disabled = false;
            // Switch to login tab after short delay
            setTimeout(() => switchAuthTab('login'), 2000);
        }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
    });
});

// =====================================================
// SOCIAL LOGIN (Google OAuth)
// =====================================================
async function signInWithGoogle() {
    if (!supabaseClient) {
        document.getElementById('authMessage').innerText = 'System not configured yet.';
        return;
    }

    const msg = document.getElementById('authMessage');
    msg.className = 'auth-msg';
    msg.innerText = '';

    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/dashboard.html'
        }
    });

    if (error) {
        msg.innerText = error.message;
        msg.classList.add('error');
    }
    // Success: browser redirects to Google, then back to dashboard
}

// =====================================================
// AUTH TAB SWITCHING
// =====================================================
function switchAuthTab(tab) {
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
    document.getElementById('loginForm').style.display = tab === 'login' ? '' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? '' : 'none';
    document.getElementById('authMessage').innerText = '';
}

// =====================================================
// APP STATE
// =====================================================
function showAuth() {
    document.getElementById('appScreen').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'none';
    document.getElementById('authScreen').classList.add('visible');
}

async function loadDashboard(user) {
    currentUser = user;
    document.getElementById('authScreen').classList.remove('visible');
    document.getElementById('appScreen').style.display = 'block';
    document.getElementById('btnLogout').style.display = 'block';

    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    document.getElementById('userGreeting').innerText = `Welcome, ${name}`;

    // Populate account tab
    document.getElementById('accountName').innerText = name;
    document.getElementById('accountEmail').innerText = user.email;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        const res = await fetch('/api/customer-data', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to fetch data');

        dashboardData = data;

        // Hide loader, show content
        document.getElementById('dashboardLoader').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';

        // Render everything
        renderStats(data);
        renderAssistants(data.configs);
        renderRecentCalls(data.logs);
        renderAllCalls(data.logs);
        renderAppointments(data.appointments || []);
        renderAccountPlan(data.configs);

    } catch (err) {
        console.error(err);
        document.getElementById('dashboardLoader').innerHTML =
            `<p style="color:#ef4444;">Error loading dashboard: ${err.message}</p>`;
    }
}

// =====================================================
// DASHBOARD TAB SWITCHING
// =====================================================
function switchDashTab(tab) {
    document.querySelectorAll('.dash-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tab)
    );
    document.querySelectorAll('.tab-panel').forEach(p =>
        p.classList.toggle('active', p.id === `panel${tab.charAt(0).toUpperCase() + tab.slice(1)}`)
    );
}

// =====================================================
// RENDER: Stats
// =====================================================
function renderStats(data) {
    const logs = data.logs || [];
    const configs = data.configs || [];
    const appointments = data.appointments || [];

    document.getElementById('statTotalCalls').innerText = logs.length;
    document.getElementById('statAssistants').innerText = configs.length;
    document.getElementById('statAppointments').innerText = appointments.length;

    // Average duration
    if (logs.length > 0) {
        const totalSec = logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
        const avg = Math.round(totalSec / logs.length);
        const mins = Math.floor(avg / 60);
        const secs = avg % 60;
        document.getElementById('statAvgDuration').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// =====================================================
// RENDER: Assistants
// =====================================================
function renderAssistants(configs) {
    const container = document.getElementById('assistantsList');

    if (!configs || configs.length === 0) {
        container.innerHTML = `<div class="loading-box">No AI Receptionists found. <br><a href="configure.html" style="color:var(--accent-cyan);margin-top:8px;display:inline-block;">Build one now →</a></div>`;
        return;
    }

    container.innerHTML = configs.map(c => `
        <div class="assistant-card">
            <div class="assistant-header">
                <h4 style="font-size:1.1rem;margin:0;">${c.business_name || 'My Business'}</h4>
                <div class="badge ${c.status}">${c.status}</div>
            </div>
            <div class="assistant-details">
                <p><strong>Plan:</strong> ${c.plan}</p>
                <p><strong>Phone:</strong> ${c.assigned_phone || '<i>Pending Provisioning</i>'}</p>
                ${c.voice_id ? `<p><strong>Voice:</strong> <span style="text-transform:capitalize;">${c.voice_id}</span></p>` : ''}
                ${c.status === 'live' || c.status === 'paid' || c.status === 'trial' || c.status === 'active' ?
            `<button class="btn btn-outline btn-small" style="width:100%; margin-top:12px;" onclick="manageSubscription()">Manage Subscription</button>`
            : `<a href="configure.html" class="btn btn-primary btn-small" style="width:100%; margin-top:12px; display:inline-block; text-align:center;">Finish Setup</a>`
        }
            </div>
        </div>
    `).join('');
}

// =====================================================
// RENDER: Calls
// =====================================================
function renderRecentCalls(logs) {
    renderCallList(logs?.slice(0, 5) || [], 'recentCallsList');
}

function renderAllCalls(logs) {
    renderCallList(logs || [], 'callLogsList');
}

function renderCallList(logs, containerId) {
    const container = document.getElementById(containerId);

    if (!logs || logs.length === 0) {
        container.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--text-secondary);">No calls received yet.</div>`;
        return;
    }

    container.innerHTML = logs.map(log => {
        const date = new Date(log.created_at).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        const mins = Math.floor((log.duration_seconds || 0) / 60);
        const secs = (log.duration_seconds || 0) % 60;
        const durStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        return `
            <div class="log-item">
                <div class="log-main">
                    <div class="log-phone">${log.customer_phone || 'Unknown Call'}</div>
                    <div class="log-meta">${date} • Duration: ${durStr}</div>
                    <div class="log-summary">${log.summary || 'No summary available.'}</div>
                </div>
                <div class="log-actions">
                    <button class="btn btn-outline btn-small" onclick="viewTranscript(\`${log.transcript?.replace(/"/g, '&quot;') || 'No transcript'}\`)">
                        Transcript
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// =====================================================
// RENDER: Calendar / Appointments
// =====================================================
function renderAppointments(appointments) {
    const container = document.getElementById('appointmentsList');

    if (!appointments || appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <p>No appointments yet</p>
                <span>Appointments booked by your AI receptionist will appear here.</span>
            </div>`;
        return;
    }

    // Sort by date (upcoming first)
    const sorted = [...appointments].sort((a, b) => new Date(a.date) - new Date(b.date));

    container.innerHTML = sorted.map(appt => {
        const date = new Date(appt.date);
        const dateStr = date.toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric'
        });
        const timeStr = date.toLocaleTimeString(undefined, {
            hour: 'numeric', minute: '2-digit'
        });
        const isPast = date < new Date();

        return `
            <div class="appointment-card ${isPast ? 'past' : ''}">
                <div class="appt-date-badge">
                    <div class="appt-day">${date.getDate()}</div>
                    <div class="appt-month">${date.toLocaleString('default', { month: 'short' })}</div>
                </div>
                <div class="appt-details">
                    <div class="appt-name">${appt.client_name || 'Client'}</div>
                    <div class="appt-time">${timeStr} · ${appt.service || 'Appointment'}</div>
                    ${appt.notes ? `<div class="appt-notes">${appt.notes}</div>` : ''}
                </div>
                <div class="appt-status ${isPast ? 'completed' : 'upcoming'}">
                    ${isPast ? 'Completed' : 'Upcoming'}
                </div>
            </div>
        `;
    }).join('');
}

// =====================================================
// RENDER: Account
// =====================================================
function renderAccountPlan(configs) {
    const activePlan = configs?.find(c => c.status === 'live' || c.status === 'paid' || c.status === 'trial' || c.status === 'active');
    if (activePlan) {
        document.getElementById('accountPlan').innerText = activePlan.plan;
        const statusEl = document.getElementById('accountStatus');
        statusEl.innerText = activePlan.status;
        statusEl.className = `account-value badge ${activePlan.status}`;
    }
}

// =====================================================
// ACTIONS & MODALS
// =====================================================
async function manageSubscription() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const res = await fetch('/api/stripe-portal', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        const data = await res.json();

        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Portal unavailable');
        }
    } catch (e) {
        alert('Could not load billing portal: ' + e.message);
    }
}

function viewTranscript(text) {
    const modal = document.getElementById('transcriptModal');
    const body = document.getElementById('modalBody');
    body.textContent = text;
    modal.classList.add('visible');
}

function closeModal() {
    document.getElementById('transcriptModal').classList.remove('visible');
}

function confirmLogout() {
    if (confirm('Are you sure you want to log out?')) {
        supabaseClient.auth.signOut();
    }
}

// =====================================================
// APPOINTMENT MODAL
// =====================================================
function openNewAppointment() {
    document.getElementById('appointmentModal').classList.add('visible');
    // Default date to tomorrow at 10am
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    document.getElementById('apptDate').value = tomorrow.toISOString().slice(0, 16);
}

function closeAppointmentModal() {
    document.getElementById('appointmentModal').classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('appointmentForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('apptName').value.trim();
            const date = document.getElementById('apptDate').value;
            const service = document.getElementById('apptService').value.trim();
            const notes = document.getElementById('apptNotes').value.trim();

            if (!name || !date) {
                alert('Please fill in the client name and date.');
                return;
            }

            // Save to Supabase
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) throw new Error('Not authenticated');

                const res = await fetch('/api/customer-data', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'create_appointment',
                        client_name: name,
                        date,
                        service,
                        notes
                    })
                });

                if (res.ok) {
                    closeAppointmentModal();
                    form.reset();
                    // Reload dashboard data
                    loadDashboard(currentUser);
                } else {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to save');
                }
            } catch (err) {
                alert('Error saving appointment: ' + err.message);
            }
        });
    }
});
