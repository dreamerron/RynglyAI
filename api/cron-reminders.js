const fetch = require('node-fetch');
const twilio = require('twilio');

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !process.env.IS_LOCAL) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;

    if (!supabaseUrl || !supabaseKey || !twilioSid || !twilioToken) {
        return res.status(500).json({ error: 'Missing environment variables' });
    }

    const client = twilio(twilioSid, twilioToken);

    try {
        // Calculate the target windows for 24 hours and 1 hour from now
        // We use a small buffer (+/- 15 mins) to catch anything within this cron's cycle
        const now = new Date();
        const bufferMs = 15 * 60 * 1000; // 15 mins

        const target24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const target24hStart = new Date(target24h.getTime() - bufferMs).toISOString();
        const target24hEnd = new Date(target24h.getTime() + bufferMs).toISOString();

        const target1h = new Date(now.getTime() + 60 * 60 * 1000);
        const target1hStart = new Date(target1h.getTime() - bufferMs).toISOString();
        const target1hEnd = new Date(target1h.getTime() + bufferMs).toISOString();

        const queryUrl = `${supabaseUrl}/rest/v1/appointments?select=*&or=(and(date.gte.${target24hStart},date.lte.${target24hEnd},reminder_24h_sent.is.false),and(date.gte.${target1hStart},date.lte.${target1hEnd},reminder_1h_sent.is.false))&client_phone.neq.null`;

        const apptsRes = await fetch(queryUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!apptsRes.ok) {
            const err = await apptsRes.text();
            throw new Error(`Supabase error: ${err}`);
        }

        const appointments = await apptsRes.json();
        let textsSent = 0;

        for (const appt of appointments) {
            // Fetch the business config manually to avoid throwing foreign key errors
            const configRes = await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?customer_email=eq.${appt.user_email}&select=business_name,phone`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            const configData = await configRes.json();
            const config = configData[0];

            // Determine which reminder this is based on the boolean flags and the date
            const apptDate = new Date(appt.date);
            const is24h = !appt.reminder_24h_sent && (apptDate > new Date(now.getTime() + 12 * 60 * 60 * 1000));
            const is1h = !appt.reminder_1h_sent && !is24h;

            const businessName = config ? config.business_name : 'Our Office';
            const fromNumber = config ? config.phone : null;

            if (!fromNumber) continue; // Can't text without the business's Twilio number

            try {
                let messageBody = '';
                if (is24h) {
                    messageBody = `Hi ${appt.client_name}, this is a reminder from ${businessName} that your appointment is coming up in exactly 24 hours on ${apptDate.toLocaleString()}. We look forward to seeing you!`;
                } else {
                    messageBody = `Hi ${appt.client_name}, this is a reminder from ${businessName} that your appointment is in 1 hour. See you soon!`;
                }

                await client.messages.create({
                    body: messageBody,
                    from: fromNumber,
                    to: appt.client_phone
                });

                textsSent++;

                // Mark the reminder as sent in the DB
                const payload = is24h ? { reminder_24h_sent: true } : { reminder_1h_sent: true };
                
                await fetch(`${supabaseUrl}/rest/v1/appointments?id=eq.${appt.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

            } catch (smsError) {
                console.error(`Failed to send SMS to ${appt.client_phone}:`, smsError.message);
            }
        }

        return res.status(200).json({ success: true, processed: appointments.length, sent: textsSent });
    } catch (error) {
        console.error('Cron Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
