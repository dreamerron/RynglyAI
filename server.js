const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve the landing page static files
app.use(express.static(path.join(__dirname, 'Landing page')));

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY;
console.log(`[DEBUG] API Key loaded: ${VAPI_API_KEY ? 'YES (' + VAPI_API_KEY.length + ' chars, starts with: ' + VAPI_API_KEY.substring(0, 8) + '...)' : 'NO - key is missing!'}`);

// Endpoint to trigger outbound call
app.post('/api/call-me', async (req, res) => {
    const { name, phoneNumber } = req.body;

    if (!name || !phoneNumber) {
        return res.status(400).json({ error: 'Name and phone number are required' });
    }

    try {
        const response = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
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

        res.json({
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
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`RinglyAI server running on http://localhost:${PORT}`);
});
