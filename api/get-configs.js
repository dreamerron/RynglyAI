// ===================================================
// RinglyAI — Get Configs Endpoint (Admin)
// ===================================================

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Very basic auth check: we check if they passed a token header or cookie
    // Since we just set a cookie in admin-login, we check for it
    const cookies = req.headers.cookie || '';
    const hasAdminToken = cookies.includes('admin_token=') || req.headers.authorization?.includes('Bearer');

    if (!hasAdminToken || !process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(503).json({ error: 'Database not configured' });
    }

    try {
        // Fetch all configs from Supabase, ordered by newest first
        const dbResponse = await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?select=*&order=created_at.desc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!dbResponse.ok) {
            throw new Error(`Supabase error: ${dbResponse.statusText}`);
        }

        const data = await dbResponse.json();

        return res.status(200).json({ success: true, configs: data });

    } catch (error) {
        console.error('Admin API error:', error);
        return res.status(500).json({ error: 'Failed to fetch customer data', details: error.message });
    }
};
