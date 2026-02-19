module.exports = async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, phoneNumber } = req.body;

    if (!name || !phoneNumber) {
        return res.status(400).json({ error: 'Name and phone number are required' });
    }

    try {
        const response = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assistantId: '3015c8af-a34f-4f28-8047-f68990092f87',
                phoneNumberId: 'ad2048fc-2bad-4364-b93a-d87fc43a1e9f',
                customer: {
                    number: phoneNumber,
                    name: name
                },
                assistantOverrides: {
                    variableValues: {
                        name: name
                    }
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to create call');
        }

        res.status(200).json({
            success: true,
            callId: data.id,
            message: `Alex is calling ${name} at ${phoneNumber} now!`
        });

    } catch (error) {
        console.error('Error creating call:', error);
        res.status(500).json({
            error: 'Failed to initiate call',
            details: error.message
        });
    }
};
