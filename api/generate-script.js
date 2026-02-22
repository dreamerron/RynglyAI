module.exports = async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { businessName, industry, hours, phone, services, faqs, voiceName, style } = req.body;

    if (!businessName || !industry || !services) {
        return res.status(400).json({ error: 'Business name, industry, and services are required' });
    }

    // Prefer Gemini (free), fall back to OpenAI, then local
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
        // No API keys — use local fallback
        const greeting = `Thank you for calling ${businessName}! This is ${voiceName || 'your AI assistant'}. How can I help you today?`;
        const personality = `${voiceName || 'The assistant'} speaks in a ${(style || 'professional').toLowerCase()} tone. Knowledgeable about ${businessName}'s services, always helpful and respectful of the caller's time.`;
        const script = buildFallbackScript({ businessName, industry, hours, services, faqs, voiceName, style });

        return res.status(200).json({ greeting, personality, script });
    }

    const prompt = `You are creating an AI phone receptionist script for a business. Generate a complete receptionist configuration with three parts.

Business Details:
- Name: ${businessName}
- Industry: ${industry}
- Hours: ${hours || 'Mon-Fri 9am-5pm'}
- Phone: ${phone || 'N/A'}
- Services: ${services}
- FAQs: ${faqs || 'None provided'}
- Voice Name: ${voiceName || 'Alex'}
- Personality Style: ${style || 'Professional'}

Generate a JSON response with exactly these three fields:
1. "greeting" — A natural opening greeting (1-2 sentences) the receptionist says when answering
2. "personality" — A brief personality description (2-3 sentences) defining how the receptionist behaves
3. "script" — A detailed instruction script (10-15 sentences) covering how to handle calls, services info, scheduling, and FAQs

Make the tone match the "${style || 'Professional'}" personality style. Be specific to the ${industry} industry. Use the voice name "${voiceName || 'Alex'}" in the greeting.

Respond ONLY with valid JSON, no markdown or extra text.`;

    try {
        let content;

        if (geminiKey) {
            // ── Gemini Flash (FREE tier: 15 RPM, 1M tokens/day) ──
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a helpful assistant that generates AI receptionist scripts. Always respond with valid JSON only.\n\n${prompt}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000,
                        responseMimeType: 'application/json'
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Gemini API error');
            }

            content = data.candidates[0].content.parts[0].text;

        } else {
            // ── OpenAI fallback ──
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant that generates AI receptionist scripts. Always respond with valid JSON only.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'OpenAI API error');
            }

            content = data.choices[0].message.content;
        }

        // Parse the JSON response
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return res.status(200).json({
            greeting: parsed.greeting || '',
            personality: parsed.personality || '',
            script: parsed.script || ''
        });

    } catch (error) {
        console.error('Script generation error:', error);

        // Fallback on any error
        const greeting = `Thank you for calling ${businessName}! This is ${voiceName || 'your AI assistant'}. How can I help you today?`;
        const personality = `${voiceName || 'The assistant'} speaks in a ${(style || 'professional').toLowerCase()} tone.`;
        const script = buildFallbackScript({ businessName, industry, hours, services, faqs, voiceName, style });

        return res.status(200).json({ greeting, personality, script });
    }
};

function buildFallbackScript({ businessName, industry, hours, services, faqs, voiceName, style }) {
    const serviceList = services.split(',').map(s => s.trim()).filter(Boolean);
    const serviceText = serviceList.length > 0 ? `Our services include: ${serviceList.join(', ')}.` : '';
    const hoursText = hours ? `Our business hours are ${hours}.` : '';
    let faqText = faqs ? `\n\nFrequently Asked Questions:\n${faqs}` : '';

    return `You are ${voiceName || 'the AI receptionist'} for ${businessName} (${industry} industry).

Your personality is ${(style || 'professional').toLowerCase()}. You answer calls professionally, provide information about the business, and help callers schedule appointments.

${serviceText}
${hoursText}

When a caller asks about services, provide helpful details. When they want to schedule an appointment, ask for their name, preferred date and time, and contact number. Always confirm the details before ending the call.

If you don't know the answer to a question, let the caller know you'll have someone follow up with them.${faqText}`;
}
