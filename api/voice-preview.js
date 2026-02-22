// ===================================================
// RinglyAI — ElevenLabs Voice Preview
// ===================================================
// Env vars needed: ELEVENLABS_API_KEY
// GET /api/voice-preview?voice=alex

// ElevenLabs voice IDs (same as used in Vapi provisioning)
const VOICE_MAP = {
    'alex': { id: 'pNInz6obpgDQGcFmaJgB', name: 'Alex' },
    'sarah': { id: '21m00Tcm4TlvDq8ikWAM', name: 'Sarah' },
    'james': { id: 'VR6AewLTigWG4xSOukaG', name: 'James' },
    'emma': { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Emma' },
    'daniel': { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
    'maya': { id: 'XB0fDUnXU5powFXDhCwa', name: 'Maya' },
    'chris': { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' },
    'sofia': { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Sofia' },
    'marcus': { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Marcus' },
    'lily': { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
    'raj': { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Raj' },
    'aiko': { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Aiko' }
};

module.exports = async function handler(req, res) {
    // Allow GET and OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const voiceKey = req.query?.voice || req.body?.voice;

    if (!voiceKey) {
        return res.status(400).json({ error: 'Missing voice parameter' });
    }

    const voice = VOICE_MAP[voiceKey];
    if (!voice) {
        return res.status(400).json({ error: `Unknown voice: ${voiceKey}` });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ error: 'ElevenLabs API key not configured' });
    }

    try {
        const previewText = `Hi there! I'm ${voice.name}, your dedicated AI receptionist. How can I help you today?`;

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: previewText,
                    model_id: 'eleven_turbo_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.2,
                        use_speaker_boost: true
                    }
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('ElevenLabs error:', err);
            return res.status(502).json({ error: 'Voice generation failed', details: err });
        }

        // Stream audio back to client
        const audioBuffer = await response.arrayBuffer();

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
        res.setHeader('Content-Length', audioBuffer.byteLength);
        return res.status(200).send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('Voice preview error:', error);
        return res.status(500).json({ error: 'Internal error', details: error.message });
    }
};
