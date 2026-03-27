// ===================================================
// WeDeskAI — Vapi End-of-Call Webhook -> Call Logs
// ===================================================

const twilio = require('twilio');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload = req.body;

        // Vapi sends 'end-of-call-report' messages to this endpoint
        if (payload.message?.type === 'end-of-call-report') {
            const call = payload.message;
            const configId = call.assistantId; // Assuming we mapped assistant tags or use assistant ID

            // Wait, we need the WeDesk config UUID. 
            // In provision.js Phase 3, we should store config_id in Vapi assistant metadata if possible, 
            // but for now, we'll look up by vapi_assistant_id or use the raw data if they match.
            const vapiAssistantId = call.assistant?.id || call.assistantId;

            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY;

            // 1. Find config by Vapi Assistant ID
            let configDbId = null;
            let customerEmail = null;
            let businessPhone = null;

            if (supabaseUrl && supabaseKey) {
                const configRes = await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?vapi_assistant_id=eq.${vapiAssistantId}&select=id,customer_email,phone`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                const configs = await configRes.json();
                if (configs && configs.length > 0) {
                    configDbId = configs[0].id;
                    customerEmail = configs[0].customer_email;
                    businessPhone = configs[0].phone;
                }
            }

            // 2. Extract call details
            const customerPhone = call.customer?.number || 'Unknown Caller';
            const durationSeconds = call.endedAt && call.startedAt
                ? Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
                : 0;
            const summary = call.summary || 'Call ended.';
            const transcript = call.transcript || '';
            const recordingUrl = call.recordingUrl || null;

            // 3. Save to Call Logs Table
            if (supabaseUrl && supabaseKey && configDbId) {
                await fetch(`${supabaseUrl}/rest/v1/call_logs`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        config_id: configDbId,
                        customer_phone: customerPhone,
                        duration_seconds: durationSeconds,
                        summary: summary,
                        transcript: transcript,
                        recording_url: recordingUrl
                    })
                });
            }

            // 4. Trigger Twilio SMS if urgent and Twilio is configured
            const isUrgent = summary.toLowerCase().includes('urgent') ||
                summary.toLowerCase().includes('emergency') ||
                summary.toLowerCase().includes('call back');

            const twilioSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioToken = process.env.TWILIO_AUTH_TOKEN;
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

            if (isUrgent && businessPhone && twilioSid && twilioToken && twilioPhone) {
                const client = twilio(twilioSid, twilioToken);
                await client.messages.create({
                    body: `🚨 WeDeskAI Alert: You received an urgent call from ${customerPhone}. Summary: ${summary.substring(0, 100)}... Check dashboard for details.`,
                    from: twilioPhone,
                    to: businessPhone
                });
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
