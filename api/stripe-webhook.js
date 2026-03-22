// ===================================================
// RinglyAI — Stripe Webhook Handler
// ===================================================
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//           SUPABASE_URL, SUPABASE_ANON_KEY

module.exports.config = { api: { bodyParser: false } };

const crypto = require('crypto');
const twilio = require('twilio');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    // Read raw body for signature verification
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    // Verify webhook signature
    if (webhookSecret && sig) {
        try {
            verifyStripeSignature(rawBody, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).json({ error: 'Invalid signature' });
        }
    }

    const event = JSON.parse(rawBody);

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const configId = session.metadata?.config_id;
        const plan = session.metadata?.plan;

        console.log(`✅ Payment successful for config ${configId}, plan: ${plan}`);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        try {
            // Update config status — 'trial' if trial period, otherwise 'paid'
            if (configId && supabaseUrl && supabaseKey) {
                const subscription = session.subscription;
                let status = 'paid';

                // Check if subscription has a trial (fetch from Stripe)
                if (subscription && stripeKey) {
                    try {
                        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscription}`, {
                            headers: { 'Authorization': `Bearer ${stripeKey}` }
                        });
                        const subData = await subRes.json();
                        if (subData.trial_end) {
                            status = 'trial';
                        }
                    } catch (e) {
                        console.log('Could not check trial status:', e.message);
                    }
                }

                await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${configId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status,
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: session.subscription
                    })
                });

                // Fetch the full config to provision
                const configRes = await fetch(
                    `${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${configId}&select=*`,
                    {
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`
                        }
                    }
                );

                const configs = await configRes.json();

                if (configs.length > 0) {
                    const config = configs[0];
                    // Trigger provisioning
                    await provisionReceptionist(config, supabaseUrl, supabaseKey);
                }
            }
        } catch (error) {
            console.error('Webhook processing error:', error);
            // Still return 200 to Stripe so it doesn't retry
        }
    }

    // Handle subscription cancelled
    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            await fetch(
                `${supabaseUrl}/rest/v1/receptionist_configs?stripe_subscription_id=eq.${subscription.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'cancelled' })
                }
            );
        }
    }

    // Handle subscription updated (trial ended → active)
    if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        // Trial → active transition
        if (subscription.status === 'active' && !subscription.trial_end && supabaseUrl && supabaseKey) {
            await fetch(
                `${supabaseUrl}/rest/v1/receptionist_configs?stripe_subscription_id=eq.${subscription.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'active' })
                }
            );
        }
    }

    return res.status(200).json({ received: true });
};

// ── Provision the AI receptionist via Vapi & Twilio ──
async function provisionReceptionist(config, supabaseUrl, supabaseKey) {
    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

    if (!vapiKey) {
        console.error('VAPI_PRIVATE_KEY not set — skipping provisioning');
        return;
    }

    let twilioClient = null;
    if (twilioAccountSid && twilioAuthToken) {
        twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    } else {
        console.warn('Twilio credentials missing — will not provision a phone number automatically');
    }

    // Voice mapping: wizard voice → ElevenLabs voice ID
    const VOICE_MAP = {
        'alex': { voiceId: 'pNInz6obpgDQGcFmaJgB' },
        'sarah': { voiceId: '21m00Tcm4TlvDq8ikWAM' },
        'james': { voiceId: 'VR6AewLTigWG4xSOukaG' },
        'emma': { voiceId: 'EXAVITQu4vr4xnSDxMaL' },
        'daniel': { voiceId: 'onwK4e9ZLuTAKqWW03F9' },
        'maya': { voiceId: 'XB0fDUnXU5powFXDhCwa' },
        'chris': { voiceId: 'iP95p4xoKVk53GoZ742B' },
        'sofia': { voiceId: 'ThT5KcBeYPX3keUQqHPh' },
        'marcus': { voiceId: 'N2lVS1w4EtoT3dr4eOWO' },
        'lily': { voiceId: 'pFZP5JQG7iQjIQuC4Bku' },
        'raj': { voiceId: 'TX3LPaxmHKxFdv7VOQHJ' },
        'aiko': { voiceId: 'XrExE9yKIg1WjnnlVkGX' }
    };

    const voiceConfig = VOICE_MAP[config.voice_id] || VOICE_MAP['alex'];

    try {
        // Update status to provisioning
        await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${config.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'provisioning' })
        });

        // Create Vapi assistant
        const assistantRes = await fetch('https://api.vapi.ai/assistant', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vapiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `${config.business_name} Receptionist`,
                firstMessage: config.greeting || `Thank you for calling ${config.business_name}! How can I help you today?`,
                model: {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'system',
                        content: config.script || `You are the AI receptionist for ${config.business_name}.`
                    }]
                },
                voice: {
                    provider: '11labs',
                    voiceId: voiceConfig.voiceId,
                    stability: 0.5,
                    similarityBoost: 0.75
                },
                maxDurationSeconds: 600,
                endCallMessage: 'Thank you for calling! Have a great day.',
                silenceTimeoutSeconds: 30
            })
        });

        const assistant = await assistantRes.json();

        if (!assistantRes.ok) {
            throw new Error(assistant.message || 'Failed to create Vapi assistant');
        }

        let twilioNumberStr = null;

        // ── Provision Twilio Number & Bind to Vapi ──
        if (twilioClient) {
            try {
                // 1. Search for an available local number in their specified country
                const targetCountry = config.country || 'US';
                const availableNumbers = await twilioClient.availablePhoneNumbers(targetCountry).local.list({
                    voiceEnabled: true,
                    smsEnabled: true,
                    limit: 1
                });

                if (availableNumbers && availableNumbers.length > 0) {
                    const numberToBuy = availableNumbers[0].phoneNumber;

                    // 2. Buy the number
                    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
                        phoneNumber: numberToBuy,
                        friendlyName: `RinglyAI - ${config.business_name}`
                    });

                    twilioNumberStr = purchasedNumber.phoneNumber;
                    console.log(`📞 Purchased Twilio number: ${twilioNumberStr}`);

                    // 3. Bind the Twilio number to the Vapi Assistant
                    const vapiPhoneRes = await fetch('https://api.vapi.ai/phone-number', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${vapiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            provider: 'twilio',
                            number: twilioNumberStr,
                            twilioAccountSid: twilioAccountSid,
                            twilioAuthToken: twilioAuthToken,
                            assistantId: assistant.id,
                            name: `RinglyAI - ${config.business_name}`
                        })
                    });

                    if (!vapiPhoneRes.ok) {
                        const vapiPhoneErr = await vapiPhoneRes.json();
                        console.error('Failed to bind Twilio to Vapi:', vapiPhoneErr);
                        // We do not throw here, so we still save the assistant ID at the very least
                    } else {
                        console.log(`🔗 Successfully bound Twilio number to Vapi assistant.`);
                    }
                } else {
                    console.error('No Twilio numbers available to purchase in US.');
                }
            } catch (twilioErr) {
                console.error('Error during Twilio provisioning:', twilioErr);
            }
        }

        // Update config with assistant ID, Twilio number, and set status to live
        const patchPayload = {
            status: 'live',
            vapi_assistant_id: assistant.id
        };
        if (twilioNumberStr) {
            patchPayload.twilio_number = twilioNumberStr;
        }

        await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${config.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(patchPayload)
        });

        console.log(`✅ Provisioned: ${config.business_name} → assistant ${assistant.id} | Phone: ${twilioNumberStr || 'None'}`);

    } catch (error) {
        console.error('Provisioning error:', error);

        // Mark as failed
        await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${config.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'failed' })
        });
    }
}

// ── Helper: Read raw body from request ──
function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

// ── Helper: Verify Stripe webhook signature ──
function verifyStripeSignature(payload, sigHeader, secret) {
    const parts = sigHeader.split(',').reduce((acc, part) => {
        const [key, val] = part.split('=');
        acc[key] = val;
        return acc;
    }, {});

    const timestamp = parts['t'];
    const signature = parts['v1'];

    if (!timestamp || !signature) {
        throw new Error('Missing timestamp or signature');
    }

    // Check if timestamp is within 5 min tolerance
    const tolerance = 300;
    const now = Math.floor(Date.now() / 1000);
    if (now - parseInt(timestamp) > tolerance) {
        throw new Error('Timestamp outside tolerance');
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

    if (expected !== signature) {
        throw new Error('Signature mismatch');
    }
}
