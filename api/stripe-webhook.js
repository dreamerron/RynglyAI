// ===================================================
// RinglyAI — Stripe Webhook Handler
// ===================================================
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//           SUPABASE_URL, SUPABASE_ANON_KEY

// Stripe requires raw body for webhook signature verification
module.exports.config = { api: { bodyParser: false } };

const crypto = require('crypto');

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
            // Update config status to 'paid'
            if (configId && supabaseUrl && supabaseKey) {
                await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${configId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'paid',
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

    return res.status(200).json({ received: true });
};

// ── Provision the AI receptionist via Vapi ──
async function provisionReceptionist(config, supabaseUrl, supabaseKey) {
    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    if (!vapiKey) {
        console.error('VAPI_PRIVATE_KEY not set — skipping provisioning');
        return;
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

        // Update config with assistant ID and set status to live
        await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${config.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'live',
                vapi_assistant_id: assistant.id
            })
        });

        console.log(`✅ Provisioned: ${config.business_name} → assistant ${assistant.id}`);

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
