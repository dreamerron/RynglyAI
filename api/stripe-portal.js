// ===================================================
// WeDeskAI — Stripe Customer Portal Session
// ===================================================

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
        return res.status(503).json({ error: 'Stripe is not configured' });
    }

    try {
        // 1. Verify user's JWT
        const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!authRes.ok) {
            throw new Error('Invalid or expired token');
        }

        const user = await authRes.json();
        const userEmail = user.email;

        // 2. Fetch the user's latest Stripe Customer ID from their receptionist_configs
        const configsRes = await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?customer_email=eq.${encodeURIComponent(userEmail)}&select=stripe_customer_id&order=created_at.desc&limit=50`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`
            }
        });

        const configs = await configsRes.json();
        let customerId = null;

        // Find the first valid stripe_customer_id they have
        for (let c of configs) {
            if (c.stripe_customer_id) {
                customerId = c.stripe_customer_id;
                break;
            }
        }

        if (!customerId) {
            // Fallback: If no direct stripe customer id in db, look up via Stripe API by email
            const searchRes = await fetch(`https://api.stripe.com/v1/customers/search?query=email:"${userEmail}"`, {
                headers: { 'Authorization': `Bearer ${stripeKey}` }
            });
            const searchData = await searchRes.json();

            if (searchData.data && searchData.data.length > 0) {
                customerId = searchData.data[0].id;
            } else {
                return res.status(404).json({ error: 'No active Stripe billing profile found.' });
            }
        }

        const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, '') || 'https://your-domain.com';

        // 3. Create Stripe Portal Session
        const params = new URLSearchParams();
        params.append('customer', customerId);
        params.append('return_url', `${origin}/dashboard.html`);

        const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const portalData = await portalRes.json();

        if (!portalRes.ok) {
            throw new Error(portalData.error?.message || 'Stripe Portal error');
        }

        return res.status(200).json({ success: true, url: portalData.url });

    } catch (error) {
        console.error('Portal API error:', error);
        return res.status(500).json({ error: error.message });
    }
};
