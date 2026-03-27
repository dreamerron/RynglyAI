// ===================================================
// WeDeskAI — Admin Login Endpoint
// ===================================================

const crypto = require('crypto');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        return res.status(503).json({ error: 'ADMIN_PASSWORD not set in environment' });
    }

    if (!password || password !== adminPassword) {
        return res.status(401).json({ error: 'Invalid master password' });
    }

    // Generate a simple token (in production, use JWT or proper session auth)
    const token = crypto.createHmac('sha256', adminPassword)
        .update(Date.now().toString())
        .digest('hex');

    // We'll trust any signed-in user for the duration of their session on the frontend
    // For Vercel Serverless, we should ideally set a secure cookie
    // But for a simple internal tool, returning a token works.

    // We'll set a cookie for the get-configs endpoint to read
    res.setHeader('Set-Cookie', `admin_token=${token}; HttpOnly; Path=/; Max-Age=3600; Secure; SameSite=Strict`);

    return res.status(200).json({ success: true, token });
};
