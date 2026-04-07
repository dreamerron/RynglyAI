// ===================================================
// WeDeskAI — Save Config + Create Stripe Checkout
// ===================================================
// Env vars needed:
//   SUPABASE_URL, SUPABASE_ANON_KEY
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_ENTERPRISE
//   STRIPE_PRICE_SMS_BASIC, STRIPE_PRICE_SMS_PRO, STRIPE_PRICE_BUNDLE

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        plan, voiceId, style, customStyle, language,
        businessName, industry, hours, phone, services, faqs, country,
        greeting, personality, script,
        customerEmail, crmLink,
        smsRules, smsFallback
    } = req.body;

    // Validate required fields (voiceId/style optional for SMS plans)
    if (!plan || !businessName || !industry || !customerEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    try {
        // ── 1. Save config to Supabase ──
        let configId = null;

        if (supabaseUrl && supabaseKey) {
            const configData = {
                status: 'draft',
                plan,
                voice_id: voiceId,
                style,
                custom_style: customStyle || null,
                language: language || 'en',
                business_name: businessName,
                industry,
                hours: hours || null,
                phone: phone || null,
                services,
                faqs: faqs || null,
                country: country || 'US',
                greeting: greeting || null,
                personality: personality || null,
                script: script || null,
                customer_email: customerEmail,
                crm_link: crmLink || null,
                sms_rules: smsRules || null,
                sms_fallback: smsFallback || null
            };

            const dbResponse = await fetch(`${supabaseUrl}/rest/v1/receptionist_configs`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(configData)
            });

            if (dbResponse.ok) {
                const rows = await dbResponse.json();
                configId = rows[0]?.id;
            } else {
                const errBody = await dbResponse.text();
                console.error('Supabase error:', errBody);
                // We keep configId = null and proceed, but we log the specific error
            }
        }

        // ── 2. Create Stripe Checkout Session ──
        if (stripeKey) {
            const priceMap = {
                starter: process.env.STRIPE_PRICE_STARTER,
                growth: process.env.STRIPE_PRICE_GROWTH,
                enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
                sms_basic: process.env.STRIPE_PRICE_SMS_BASIC,
                sms_pro: process.env.STRIPE_PRICE_SMS_PRO,
                sms_scale: process.env.STRIPE_PRICE_SMS_SCALE,
                bundle: process.env.STRIPE_PRICE_BUNDLE
            };

            const priceId = priceMap[plan];

            if (!priceId) {
                return res.status(400).json({ error: `Stripe price ID not configured for plan: ${plan}. Please check your environment variables.` });
            }

            // Build the checkout session via Stripe REST API
            const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, '') || 'https://wedeskai.com';

            const params = new URLSearchParams();
            params.append('mode', 'subscription');
            params.append('customer_email', customerEmail);
            params.append('line_items[0][price]', priceId);
            params.append('line_items[0][quantity]', '1');
            params.append('subscription_data[trial_period_days]', '14');
            params.append('payment_method_collection', 'always');
            params.append('automatic_tax[enabled]', 'true');
            params.append('success_url', `${origin}/configure.html?success=true&session_id={CHECKOUT_SESSION_ID}`);
            params.append('cancel_url', `${origin}/configure.html?cancelled=true`);
            if (configId) {
                params.append('metadata[config_id]', configId);
            }
            params.append('metadata[plan]', plan);
            params.append('metadata[business_name]', String(businessName).substring(0, 200)); // Guard against long names

            const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${stripeKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            const session = await stripeResponse.json();

            if (!stripeResponse.ok) {
                throw new Error(session.error?.message || 'Stripe Checkout error');
            }

            // Update config with Stripe session ID
            if (configId && supabaseUrl && supabaseKey) {
                await fetch(`${supabaseUrl}/rest/v1/receptionist_configs?id=eq.${configId}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ stripe_session_id: session.id })
                });
            }

            return res.status(200).json({
                success: true,
                checkoutUrl: session.url,
                configId
            });
        }

        // No Stripe key — just save config and return
        return res.status(200).json({
            success: true,
            configId,
            message: 'Configuration saved (Stripe not configured — skipping checkout)'
        });

    } catch (error) {
        console.error('Save config error:', error);
        // Important: return the actual error message in the 'error' field so the client can show it
        return res.status(500).json({ 
            error: error.message || 'Failed to save configuration', 
            details: error.stack 
        });
    }
};
