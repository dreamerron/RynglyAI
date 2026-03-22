// ===================================================
// RinglyAI — Environment exposure for public variables
// ===================================================

module.exports = async function handler(req, res) {
    // Only return the PUBLIC anon key, never the service_role key
    // This allows the frontend dashboard.js to init Supabase client

    return res.status(200).json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
};
