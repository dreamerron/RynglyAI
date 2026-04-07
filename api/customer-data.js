// ===================================================
// WeDeskAI — Fetch Dashboard Data (Auth'd)
// ===================================================

module.exports = async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(503).json({ error: 'Database not configured' });
    }

    // Verify user
    let user, userEmail;
    try {
        const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!authRes.ok) throw new Error('Invalid or expired token');
        user = await authRes.json();
        userEmail = user.email;
    } catch (error) {
        return res.status(401).json({ error: error.message });
    }

    // ── POST: Create appointment ──
    if (req.method === 'POST') {
        try {
            const { action, client_name, client_phone, date, service, notes } = req.body;

            if (action !== 'create_appointment') {
                return res.status(400).json({ error: 'Unknown action' });
            }

            if (!client_name || !date) {
                return res.status(400).json({ error: 'client_name and date are required' });
            }

            const apptRes = await fetch(`${supabaseUrl}/rest/v1/appointments`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    user_email: userEmail,
                    client_name,
                    client_phone: client_phone || null,
                    date,
                    service: service || null,
                    notes: notes || null
                })
            });

            if (!apptRes.ok) {
                const errText = await apptRes.text();
                throw new Error(`Failed to create appointment: ${errText}`);
            }

            const appt = await apptRes.json();

            // After creating appointment, send SMS notification to business owner
            let businessPhone = null;
            try {
                const cfgRes = await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?customer_email=eq.${encodeURIComponent(userEmail)}&select=phone`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (cfgRes.ok) {
                    const cfgs = await cfgRes.json();
                    if (cfgs && cfgs.length > 0) businessPhone = cfgs[0].phone;
                }
            } catch (e) {
                console.error('Failed to fetch business phone for SMS:', e);
            }

            if (businessPhone) {
                const twilioSid = process.env.TWILIO_ACCOUNT_SID;
                const twilioToken = process.env.TWILIO_AUTH_TOKEN;
                const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
                if (twilioSid && twilioToken && twilioPhone) {
                    const client = require('twilio')(twilioSid, twilioToken);
                    const smsBody = `📅 New appointment booked!\nClient: ${client_name}\nDate: ${new Date(date).toLocaleString()}\nService: ${service || 'N/A'}\nCheck dashboard for details.`;
                    try {
                        await client.messages.create({
                            body: smsBody,
                            from: twilioPhone,
                            to: businessPhone
                        });
                        console.log('Appointment SMS sent to', businessPhone);
                    } catch (smsErr) {
                        console.error('Failed to send appointment SMS:', smsErr.message);
                    }
                }
            }

            return res.status(201).json({ success: true, appointment: appt[0] || appt });

        } catch (error) {
            console.error('Appointment API error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // ── GET: Fetch all dashboard data ──
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Fetch all receptionist configs tied to this email
        const configsRes = await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?customer_email=eq.${encodeURIComponent(userEmail)}&order=created_at.desc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!configsRes.ok) throw new Error('Failed to fetch configs');
        const configs = await configsRes.json();

        // 2. Fetch call logs
        let logs = [];
        if (configs.length > 0) {
            const idsList = configs.map(c => c.id).join(',');
            const logsRes = await fetch(`${supabaseUrl}/rest/v1/call_logs?config_id=in.(${idsList})&order=created_at.desc&limit=50`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (logsRes.ok) {
                logs = await logsRes.json();
            }
        }

        // 3. Fetch appointments
        let appointments = [];
        const apptsRes = await fetch(`${supabaseUrl}/rest/v1/appointments?user_email=eq.${encodeURIComponent(userEmail)}&order=date.desc&limit=100`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (apptsRes.ok) {
            appointments = await apptsRes.json();
        }

        return res.status(200).json({ success: true, configs, logs, appointments });

    } catch (error) {
        console.error('Customer API error:', error);
        return res.status(401).json({ error: error.message });
    }
};
