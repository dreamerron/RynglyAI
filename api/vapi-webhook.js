// ===================================================
// WeDeskAI — Vapi End-of-Call Webhook → Call Logs,
//            SMS Summaries, CRM Webhook
// ===================================================
// Env vars: SUPABASE_URL, SUPABASE_ANON_KEY,
//           TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

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
            const vapiAssistantId = call.assistant?.id || call.assistantId;

            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY;

            // ── 1. Find config by Vapi Assistant ID ──
            let config = null;

            if (supabaseUrl && supabaseKey) {
                const configRes = await fetch(
                    `${supabaseUrl}/rest/v1/receptionist_configs?vapi_assistant_id=eq.${vapiAssistantId}&select=id,customer_email,phone,plan,crm_link,booking_link,business_name`,
                    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
                );
                const configs = await configRes.json();
                if (configs && configs.length > 0) {
                    config = configs[0];
                }
            }

            // ── 2. Extract call details ──
            const customerPhone = call.customer?.number || 'Unknown Caller';
            const durationSeconds = call.endedAt && call.startedAt
                ? Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
                : 0;
            const mins = Math.floor(durationSeconds / 60);
            const secs = durationSeconds % 60;
            const durationStr = `${mins}m ${secs}s`;
            const summary = call.summary || 'Call ended.';
            const transcript = call.transcript || '';
            const recordingUrl = call.recordingUrl || null;

            // ── 3. Save to Call Logs Table ──
            if (supabaseUrl && supabaseKey && config?.id) {
                await fetch(`${supabaseUrl}/rest/v1/call_logs`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        config_id: config.id,
                        customer_phone: customerPhone,
                        duration_seconds: durationSeconds,
                        summary: summary,
                        transcript: transcript,
                        recording_url: recordingUrl
                    })
                });
            }

            // ── 4. SMS Call Summary ──
            const twilioSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioToken = process.env.TWILIO_AUTH_TOKEN;
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
            const businessPhone = config?.phone;

            const isUrgent = summary.toLowerCase().includes('urgent') ||
                summary.toLowerCase().includes('emergency') ||
                summary.toLowerCase().includes('call back');

            // Determine if this plan gets SMS for all calls
            const isProPlan = config?.plan === 'growth' || config?.plan === 'bundle' ||
                              config?.plan === 'enterprise' || config?.plan === 'sms_pro' ||
                              config?.plan === 'sms_scale';

            const shouldSendSms = isUrgent || isProPlan;

            if (shouldSendSms && businessPhone && twilioSid && twilioToken && twilioPhone) {
                const client = twilio(twilioSid, twilioToken);

                // Truncate summary to fit in ~2 SMS segments (300 chars)
                const shortSummary = summary.length > 200 ? summary.substring(0, 197) + '...' : summary;

                let smsBody;
                if (isUrgent) {
                    smsBody = `🚨 URGENT — WeDeskAI\nCall from: ${customerPhone}\nDuration: ${durationStr}\n${shortSummary}\n\nCheck dashboard for full transcript.`;
                } else {
                    smsBody = `📞 WeDeskAI Call Summary\nFrom: ${customerPhone}\nDuration: ${durationStr}\n${shortSummary}\n\nView details: wedeskai.com/dashboard.html`;
                }

                try {
                    await client.messages.create({
                        body: smsBody,
                        from: twilioPhone,
                        to: businessPhone
                    });
                    console.log(`SMS summary sent to ${businessPhone}`);
                } catch (smsErr) {
                    console.error('SMS send failed:', smsErr.message);
                    // Don't throw — SMS failure shouldn't break the webhook
                }
            }

            // ── 5. CRM Webhook Integration ──
            if (config?.crm_link && config.crm_link.startsWith('https://')) {
                try {
                    await fetch(config.crm_link, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'call_completed',
                            business_name: config.business_name || '',
                            caller_phone: customerPhone,
                            duration_seconds: durationSeconds,
                            summary: summary,
                            transcript: transcript,
                            recording_url: recordingUrl,
                            timestamp: new Date().toISOString()
                        })
                    });
                    console.log(`CRM webhook fired to ${config.crm_link}`);
                } catch (crmErr) {
                    console.error('CRM webhook failed:', crmErr.message);
                    // Don't throw — CRM failure shouldn't break the webhook
                }
            }

            // ── 6. Auto-detect appointment from transcript ──
            if (config?.id && supabaseUrl && supabaseKey && transcript) {
                const lowerTranscript = transcript.toLowerCase();
                const hasAppointment = lowerTranscript.includes('appointment') ||
                    lowerTranscript.includes('scheduled') ||
                    lowerTranscript.includes('booking') ||
                    lowerTranscript.includes('booked for');

                if (hasAppointment) {
                    // Create a pending appointment record so the business owner sees it in the dashboard
                    await fetch(`${supabaseUrl}/rest/v1/appointments`, {
                        method: 'POST',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            user_email: config.customer_email,
                            client_name: customerPhone,
                            client_phone: customerPhone,
                            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Placeholder: tomorrow
                            service: 'AI-Booked (check transcript)',
                            notes: `Auto-detected from call. Summary: ${summary.substring(0, 200)}`
                        })
                    });

                    // Send appointment SMS notification
                    if (businessPhone && twilioSid && twilioToken && twilioPhone) {
                        const client = twilio(twilioSid, twilioToken);
                        try {
                            await client.messages.create({
                                body: `📅 WeDeskAI — New Appointment!\nCaller: ${customerPhone}\nThe caller discussed scheduling. Please check your dashboard to confirm the details.\n\nwedeskai.com/dashboard.html`,
                                from: twilioPhone,
                                to: businessPhone
                            });
                        } catch (apptSmsErr) {
                            console.error('Appointment SMS failed:', apptSmsErr.message);
                        }
                    }
                }
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
