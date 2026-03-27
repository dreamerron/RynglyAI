module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, phoneNumber } = req.body;

    if (!name || !phoneNumber) {
        return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    if (!vapiKey) {
        console.error('VAPI_PRIVATE_KEY is not set in environment variables');
        return res.status(500).json({
            error: 'Server misconfiguration: VAPI_PRIVATE_KEY not set',
            details: 'Add VAPI_PRIVATE_KEY to your Vercel project environment variables'
        });
    }

    try {
        const vapiRes = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vapiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assistantId: '3015c8af-a34f-4f28-8047-f68990092f87',
                phoneNumberId: 'e82d9ec7-d963-40ea-9efb-93b4c8d27eab',
                customer: {
                    number: phoneNumber,
                    name: name
                },
                assistantOverrides: {
                    variableValues: { name }
                }
            })
        });

        const data = await vapiRes.json();

        if (!vapiRes.ok) {
            console.error('Vapi error:', vapiRes.status, JSON.stringify(data));
            return res.status(502).json({
                error: 'Vapi API error',
                details: data.message || data.error || JSON.stringify(data),
                vapiStatus: vapiRes.status
            });
        }

        return res.status(200).json({
            success: true,
            callId: data.id,
            message: `Alex is calling ${name} at ${phoneNumber} now!`
        });

    } catch (error) {
        console.error('Error creating call:', error);
        return res.status(500).json({
            error: 'Failed to initiate call',
            details: error.message
        });
    }
};
