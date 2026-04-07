module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, phoneNumber, b_phone } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    // 1. Honeypot check (Bot protection)
    if (b_phone) {
        console.warn(`Spam attempt blocked (Honeypot filled) from IP: ${clientIp}`);
        return res.status(400).json({ error: 'Spam detected. Access denied.' });
    }

    // 2. Validate USA/Canada Only (+1)
    if (!phoneNumber || !phoneNumber.startsWith('+1')) {
        return res.status(400).json({ 
            error: 'USA & Canada Only', 
            details: 'The demo is currently restricted to USA and Canada (+1) phone numbers.' 
        });
    }

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!vapiKey || !supabaseUrl || !supabaseKey) {
        console.error('Server misconfiguration: VAPI or Supabase keys not set');
        return res.status(500).json({ error: 'Server misconfiguration' });
    }

    try {
        // 3. Rate Limit Check (Supabase) - Max 3 calls per 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        // Check for calls from this IP or Phone Number in last 24h
        const checkUrl = `${supabaseUrl}/rest/v1/demo_calls?select=id&created_at=gte.${twentyFourHoursAgo}&or=(ip_address.eq.${encodeURIComponent(clientIp)},phone_number.eq.${encodeURIComponent(phoneNumber)})`;
        
        const checkRes = await fetch(checkUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (checkRes.ok) {
            const recentCalls = await checkRes.json();
            if (recentCalls.length >= 3) {
                return res.status(429).json({ 
                    error: 'Daily Limit Reached', 
                    details: 'To protect our service, the demo is limited to 3 calls per day. Please try again tomorrow or contact sales for a business demo.' 
                });
            }
        }

        // 4. Initiate the Voice Call via Vapi
        const vapiRes = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vapiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assistantId: '3015c8af-a34f-4f28-8047-f68990092f87',
                phoneNumberId: 'e82d9ec7-d963-40ea-9efb-93b4c8d27eab',
                customer: {
                    number: phoneNumber,
                    name: name
                },
                assistantOverrides: {
                    variableValues: { name }
                }
            })
        });

        const data = await vapiRes.json();

        if (!vapiRes.ok) {
            console.error('Vapi error:', vapiRes.status, JSON.stringify(data));
            const statusCode = vapiRes.status === 400 ? 400 : 502;
            return res.status(statusCode).json({
                error: 'Vapi API error',
                details: data.message || data.error || JSON.stringify(data),
                vapiStatus: vapiRes.status
            });
        }

        // 5. Log Success to Supabase
        await fetch(`${supabaseUrl}/rest/v1/demo_calls`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone_number: phoneNumber,
                ip_address: clientIp,
                status: 'initiated',
                vapi_call_id: data.id
            })
        });

        return res.status(200).json({
            success: true,
            callId: data.id,
            message: `Alex is calling ${name} at ${phoneNumber} now!`
        });

    } catch (error) {
        console.error('Demo call error:', error);
        return res.status(500).json({
            error: 'Failed to initiate call',
            details: error.message
        });
    }
};
