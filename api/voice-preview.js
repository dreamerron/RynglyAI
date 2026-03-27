// ===================================================
// WeDeskAI — Voice Preview via Vapi Voice Library
// ===================================================
// Uses VAPI_PRIVATE_KEY (already set) — no extra ElevenLabs key needed
// GET /api/voice-preview?voice=alex

const VOICE_MAP = {
    'alex':   'pNInz6obpgDQGcFmaJgB',
    'sarah':  '21m00Tcm4TlvDq8ikWAM',
    'james':  'VR6AewLTigWG4xSOukaG',
    'emma':   'EXAVITQu4vr4xnSDxMaL',
    'daniel': 'onwK4e9ZLuTAKqWW03F9',
    'maya':   'XB0fDUnXU5powFXDhCwa',
    'chris':  'iP95p4xoKVk53GoZ742B',
    'sofia':  'ThT5KcBeYPX3keUQqHPh',
    'marcus': 'N2lVS1w4EtoT3dr4eOWO',
    'lily':   'pFZP5JQG7iQjIQuC4Bku',
    'raj':    'TX3LPaxmHKxFdv7VOQHJ',
    'aiko':   'XrExE9yKIg1WjnnlVkGX'
};

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    const voiceKey = req.query?.voice;
    if (!voiceKey) return res.status(400).json({ error: 'Missing voice parameter' });

    const elevenLabsId = VOICE_MAP[voiceKey];
    if (!elevenLabsId) return res.status(400).json({ error: `Unknown voice: ${voiceKey}` });

    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    if (!vapiKey) return res.status(503).json({ error: 'VAPI_PRIVATE_KEY not configured' });

    try {
        // Fetch Vapi voice library — includes previewUrl for each voice
        const libraryRes = await fetch('https://api.vapi.ai/voice-library?limit=100', {
            headers: { 'Authorization': `Bearer ${vapiKey}` }
        });

        if (!libraryRes.ok) {
            const err = await libraryRes.text();
            return res.status(502).json({ error: 'Vapi voice library error', details: err });
        }

        const library = await libraryRes.json();
        const voices = Array.isArray(library) ? library : (library.results || library.voices || []);

        // Find the matching voice by ElevenLabs voiceId
        const match = voices.find(v =>
            v.voiceId === elevenLabsId ||
            v.voice_id === elevenLabsId ||
            v.id === elevenLabsId
        );

        if (!match || !match.previewUrl) {
            return res.status(404).json({ error: 'Preview not available for this voice' });
        }

        // Proxy the audio so the browser doesn't need to handle CORS
        const audioRes = await fetch(match.previewUrl);
        if (!audioRes.ok) {
            return res.status(502).json({ error: 'Failed to fetch preview audio' });
        }

        const audioBuffer = await audioRes.arrayBuffer();
        res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', audioBuffer.byteLength);
        return res.status(200).send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('Voice preview error:', error);
        return res.status(500).json({ error: 'Internal error', details: error.message });
    }
};
