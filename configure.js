/* ===================================================
   RinglyAI — Configurator Wizard Logic
   =================================================== */

// =====================================================
// DATA — Voices, Styles, Plan config
// =====================================================
const VOICES = [
    // Basic tier (starter)
    { id: 'alex', name: 'Alex', gender: 'male', desc: 'Warm & professional', emoji: '👨‍💼', tier: 'starter' },
    { id: 'sarah', name: 'Sarah', gender: 'female', desc: 'Friendly & confident', emoji: '👩‍💼', tier: 'starter' },
    { id: 'james', name: 'James', gender: 'male', desc: 'Calm & authoritative', emoji: '🧑‍💼', tier: 'starter' },
    { id: 'emma', name: 'Emma', gender: 'female', desc: 'Energetic & approachable', emoji: '👩', tier: 'starter' },
    // Growth tier
    { id: 'daniel', name: 'Daniel', gender: 'male', desc: 'Deep & reassuring', emoji: '👨', tier: 'growth' },
    { id: 'maya', name: 'Maya', gender: 'female', desc: 'Smooth & articulate', emoji: '👩‍🦰', tier: 'growth' },
    { id: 'chris', name: 'Chris', gender: 'male', desc: 'Upbeat & conversational', emoji: '🧑', tier: 'growth' },
    { id: 'sofia', name: 'Sofia', gender: 'female', desc: 'Bilingual EN/ES', emoji: '💃', tier: 'growth' },
    // Enterprise tier
    { id: 'marcus', name: 'Marcus', gender: 'male', desc: 'Executive gravitas', emoji: '🤵', tier: 'enterprise' },
    { id: 'lily', name: 'Lily', gender: 'female', desc: 'Soothing & empathetic', emoji: '🧑‍⚕️', tier: 'enterprise' },
    { id: 'raj', name: 'Raj', gender: 'male', desc: 'Multilingual specialist', emoji: '🧑‍💻', tier: 'enterprise' },
    { id: 'aiko', name: 'Aiko', gender: 'female', desc: 'Multilingual EN/JP/KR', emoji: '👩‍🎤', tier: 'enterprise' }
];

const STYLES = [
    // Basic tier
    { id: 'professional', name: 'Professional', emoji: '💼', desc: 'Polished and business-like', tier: 'starter' },
    { id: 'friendly', name: 'Friendly', emoji: '😊', desc: 'Warm, welcoming, and casual', tier: 'starter' },
    { id: 'concise', name: 'Concise', emoji: '⚡', desc: 'Efficient and straight to the point', tier: 'starter' },
    // Growth tier
    { id: 'energetic', name: 'Energetic', emoji: '🚀', desc: 'High-energy and enthusiastic', tier: 'growth' },
    { id: 'empathetic', name: 'Empathetic', emoji: '💛', desc: 'Caring, patient, and understanding', tier: 'growth' },
    { id: 'luxury', name: 'Luxury', emoji: '✨', desc: 'Premium concierge-level service', tier: 'growth' },
    // Enterprise tier
    { id: 'custom', name: 'Custom', emoji: '🎨', desc: 'Write your own personality', tier: 'enterprise' }
];

const PLAN_TIERS = {
    starter: { level: 0, label: 'Essentials', price: '$149/mo' },
    growth: { level: 1, label: 'Professional', price: '$349/mo' },
    enterprise: { level: 2, label: 'Scale', price: '$699/mo' }
};

const TIER_ORDER = ['starter', 'growth', 'enterprise'];

// =====================================================
// STATE
// =====================================================
let currentStep = 1;
let selectedPlan = null;
let selectedVoice = null;
let selectedStyle = null;
let generatedScript = null;

// =====================================================
// INIT — read URL params, set up mobile nav
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Pre-select plan from URL
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    if (planParam && PLAN_TIERS[planParam]) {
        selectPlan(planParam);
    }

    // Handle Stripe redirect results
    if (params.get('success') === 'true') {
        showCheckoutResult('success');
    } else if (params.get('cancelled') === 'true') {
        showCheckoutResult('cancelled');
    }

    // Mobile nav toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');
    mobileToggle.addEventListener('click', () => {
        mobileToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });
});

// =====================================================
// PLAN SELECTION
// =====================================================
function selectPlan(planId) {
    selectedPlan = planId;

    // Reset voice/style if plan changes
    selectedVoice = null;
    selectedStyle = null;

    // UI — highlight selected card
    document.querySelectorAll('.plan-select-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.plan === planId);
    });
}

// =====================================================
// VOICE RENDERING
// =====================================================
function renderVoices() {
    const grid = document.getElementById('voiceGrid');
    const planLevel = PLAN_TIERS[selectedPlan].level;

    grid.innerHTML = VOICES.map(voice => {
        const voiceTierLevel = TIER_ORDER.indexOf(voice.tier);
        const locked = voiceTierLevel > planLevel;
        const isSelected = selectedVoice === voice.id;

        return `
            <div class="voice-card ${isSelected ? 'selected' : ''} ${locked ? 'locked' : ''}"
                 data-voice="${voice.id}"
                 onclick="${locked ? '' : `selectVoice('${voice.id}')`}">
                ${locked ? `<div class="lock-badge">🔒 ${PLAN_TIERS[TIER_ORDER[voiceTierLevel]].label}</div>` : ''}
                <div class="voice-avatar">${voice.emoji}</div>
                <div class="voice-info">
                    <h4>${voice.name}</h4>
                    <p>${voice.desc} · ${voice.gender === 'male' ? '♂ Male' : '♀ Female'}</p>
                </div>
                <button class="voice-play-btn" onclick="event.stopPropagation(); playVoicePreview('${voice.id}')" ${locked ? 'disabled' : ''}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                </button>
            </div>`;
    }).join('');
}

function selectVoice(voiceId) {
    selectedVoice = voiceId;
    renderVoices();
}

function playVoicePreview(voiceId) {
    // Placeholder — in production, play actual audio samples
    const voice = VOICES.find(v => v.id === voiceId);
    alert(`🔊 Playing preview for "${voice.name}" — (Audio samples coming soon!)`);
}

// =====================================================
// STYLE RENDERING
// =====================================================
function renderStyles() {
    const grid = document.getElementById('styleGrid');
    const planLevel = PLAN_TIERS[selectedPlan].level;

    grid.innerHTML = STYLES.map(style => {
        const styleTierLevel = TIER_ORDER.indexOf(style.tier);
        const locked = styleTierLevel > planLevel;
        const isSelected = selectedStyle === style.id;

        return `
            <div class="style-card ${isSelected ? 'selected' : ''} ${locked ? 'locked' : ''}"
                 data-style="${style.id}"
                 onclick="${locked ? '' : `selectStyle('${style.id}')`}">
                ${locked ? `<div class="lock-badge">🔒 ${PLAN_TIERS[TIER_ORDER[styleTierLevel]].label}</div>` : ''}
                <span class="style-emoji">${style.emoji}</span>
                <h4>${style.name}</h4>
                <p>${style.desc}</p>
            </div>`;
    }).join('');

    // Show/hide custom textarea
    const customArea = document.getElementById('customStyleArea');
    if (selectedStyle === 'custom' && planLevel >= 2) {
        customArea.classList.add('visible');
    } else {
        customArea.classList.remove('visible');
    }
}

function selectStyle(styleId) {
    selectedStyle = styleId;
    renderStyles();
}

// =====================================================
// SELECTION SUMMARY CHIPS
// =====================================================
function renderSummaryChips(containerId) {
    const container = document.getElementById(containerId);
    let chips = '';

    if (selectedPlan) {
        chips += `<div class="summary-chip"><span class="chip-label">Plan:</span> ${PLAN_TIERS[selectedPlan].label} (${PLAN_TIERS[selectedPlan].price})</div>`;
    }
    if (selectedVoice) {
        const voice = VOICES.find(v => v.id === selectedVoice);
        chips += `<div class="summary-chip"><span class="chip-label">Voice:</span> ${voice.emoji} ${voice.name}</div>`;
    }
    if (selectedStyle) {
        const style = STYLES.find(s => s.id === selectedStyle);
        chips += `<div class="summary-chip"><span class="chip-label">Style:</span> ${style.emoji} ${style.name}</div>`;
    }

    container.innerHTML = chips;
}

// =====================================================
// STEP NAVIGATION
// =====================================================
function updateProgressBar() {
    const steps = document.querySelectorAll('.progress-step');
    const lines = [
        document.getElementById('line1'),
        document.getElementById('line2'),
        document.getElementById('line3')
    ];

    steps.forEach((step, i) => {
        const num = i + 1;
        step.classList.remove('active', 'completed');
        if (num < currentStep) {
            step.classList.add('completed');
            step.querySelector('.step-circle').textContent = '✓';
        } else if (num === currentStep) {
            step.classList.add('active');
            step.querySelector('.step-circle').textContent = num;
        } else {
            step.querySelector('.step-circle').textContent = num;
        }
    });

    lines.forEach((line, i) => {
        line.classList.toggle('filled', i < currentStep - 1);
    });
}

function showStep(step) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    updateProgressBar();

    // Back button visibility
    document.getElementById('btnBack').style.visibility = step === 1 ? 'hidden' : 'visible';

    // Next button text
    const btnNext = document.getElementById('btnNext');
    if (step === 4) {
        if (generatedScript) {
            btnNext.innerHTML = '🎉 Looks Great!';
        } else {
            btnNext.innerHTML = `
                ✨ Generate Script
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>`;
        }
    } else {
        btnNext.innerHTML = `
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
            </svg>`;
    }

    // Render step-specific content
    if (step === 2) {
        renderVoices();
        renderSummaryChips('step2Summary');
    }
    if (step === 3) {
        renderStyles();
        renderSummaryChips('step3Summary');
    }
    if (step === 4) {
        renderSummaryChips('step4Summary');
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
    // Validation per step
    if (currentStep === 1) {
        if (!selectedPlan) {
            alert('Please select a plan to continue.');
            return;
        }
    } else if (currentStep === 2) {
        if (!selectedVoice) {
            alert('Please select a voice for your receptionist.');
            return;
        }
    } else if (currentStep === 3) {
        if (!selectedStyle) {
            alert('Please select a style for your receptionist.');
            return;
        }
    } else if (currentStep === 4) {
        if (generatedScript) {
            // Final confirmation
            showFinalConfirmation();
            return;
        }
        // Validate business form then generate
        if (!validateBizForm()) return;
        generateScript();
        return;
    }

    currentStep++;
    showStep(currentStep);
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

// =====================================================
// BUSINESS FORM VALIDATION
// =====================================================
function validateBizForm() {
    const email = document.getElementById('bizEmail').value.trim();
    const name = document.getElementById('bizName').value.trim();
    const industry = document.getElementById('bizIndustry').value;
    const services = document.getElementById('bizServices').value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address.');
        document.getElementById('bizEmail').focus();
        return false;
    }
    if (!name) {
        alert('Please enter your business name.');
        document.getElementById('bizName').focus();
        return false;
    }
    if (!industry) {
        alert('Please select your industry.');
        document.getElementById('bizIndustry').focus();
        return false;
    }
    if (!services) {
        alert('Please enter at least one service you offer.');
        document.getElementById('bizServices').focus();
        return false;
    }
    return true;
}

// =====================================================
// AI SCRIPT GENERATION
// =====================================================
async function generateScript() {
    const bizData = {
        businessName: document.getElementById('bizName').value.trim(),
        industry: document.getElementById('bizIndustry').value,
        hours: document.getElementById('bizHours').value.trim() || 'Mon-Fri 9am-5pm',
        phone: document.getElementById('bizPhone').value.trim(),
        services: document.getElementById('bizServices').value.trim(),
        faqs: document.getElementById('bizFaqs').value.trim(),
        voiceName: VOICES.find(v => v.id === selectedVoice)?.name || 'Alex',
        style: selectedStyle === 'custom'
            ? document.getElementById('customStyleText').value.trim() || 'Professional'
            : STYLES.find(s => s.id === selectedStyle)?.name || 'Professional'
    };

    // Show loading
    document.getElementById('scriptLoading').style.display = '';
    document.getElementById('scriptPreview').classList.remove('visible');
    document.getElementById('btnNext').disabled = true;
    document.getElementById('btnNext').style.opacity = '0.5';

    try {
        const response = await fetch('/api/generate-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bizData)
        });

        if (!response.ok) {
            throw new Error('Failed to generate script');
        }

        const data = await response.json();
        generatedScript = data;

        // Display
        document.getElementById('scriptGreeting').textContent = data.greeting || '';
        document.getElementById('scriptPersonality').textContent = data.personality || '';
        document.getElementById('scriptFull').textContent = data.script || '';

        document.getElementById('scriptLoading').style.display = 'none';
        document.getElementById('scriptPreview').classList.add('visible');

        // Update button
        const btnNext = document.getElementById('btnNext');
        btnNext.innerHTML = '🎉 Looks Great!';
        btnNext.disabled = false;
        btnNext.style.opacity = '';
    } catch (err) {
        console.error('Script generation error:', err);
        document.getElementById('scriptLoading').style.display = 'none';

        // Fallback — generate locally
        generatedScript = generateLocalScript(bizData);

        document.getElementById('scriptGreeting').textContent = generatedScript.greeting;
        document.getElementById('scriptPersonality').textContent = generatedScript.personality;
        document.getElementById('scriptFull').textContent = generatedScript.script;

        document.getElementById('scriptPreview').classList.add('visible');

        const btnNext = document.getElementById('btnNext');
        btnNext.innerHTML = '🎉 Looks Great!';
        btnNext.disabled = false;
        btnNext.style.opacity = '';
    }
}

// Local fallback script generation (when API isn't available)
function generateLocalScript(data) {
    const voiceName = data.voiceName;
    const style = data.style;

    const greeting = `Thank you for calling ${data.businessName}! This is ${voiceName}, your AI assistant. How can I help you today?`;

    const personality = `${voiceName} speaks in a ${style.toLowerCase()} tone. They are knowledgeable about ${data.businessName}'s services and always aim to be helpful, accurate, and respectful of the caller's time.`;

    const serviceList = data.services.split(',').map(s => s.trim()).filter(Boolean);
    const serviceText = serviceList.length > 0
        ? `Our services include: ${serviceList.join(', ')}.`
        : '';

    const hoursText = data.hours ? `Our business hours are ${data.hours}.` : '';

    let faqText = '';
    if (data.faqs) {
        faqText = `\n\nFrequently Asked Questions:\n${data.faqs}`;
    }

    const script = `You are ${voiceName}, the AI receptionist for ${data.businessName} (${data.industry} industry).

Your personality is ${style.toLowerCase()}. You answer calls professionally, provide information about the business, and help callers schedule appointments.

${serviceText}
${hoursText}

When a caller asks about services, provide helpful details. When they want to schedule an appointment, ask for their name, preferred date and time, and contact number. Always confirm the details before ending the call.

If you don't know the answer to a question, let the caller know you'll have someone get back to them.${faqText}`;

    return { greeting, personality, script };
}

// =====================================================
// FINAL CONFIRMATION → STRIPE CHECKOUT
// =====================================================
async function showFinalConfirmation() {
    const btnNext = document.getElementById('btnNext');
    btnNext.disabled = true;
    btnNext.innerHTML = '⏳ Saving...';
    btnNext.style.opacity = '0.5';

    try {
        const payload = {
            plan: selectedPlan,
            voiceId: selectedVoice,
            style: selectedStyle,
            customStyle: selectedStyle === 'custom'
                ? document.getElementById('customStyleText').value.trim()
                : null,
            language: 'en',
            businessName: document.getElementById('bizName').value.trim(),
            industry: document.getElementById('bizIndustry').value,
            hours: document.getElementById('bizHours').value.trim() || null,
            phone: document.getElementById('bizPhone').value.trim() || null,
            services: document.getElementById('bizServices').value.trim(),
            faqs: document.getElementById('bizFaqs').value.trim() || null,
            country: document.getElementById('bizCountry').value,
            greeting: generatedScript?.greeting || null,
            personality: generatedScript?.personality || null,
            script: generatedScript?.script || null,
            customerEmail: document.getElementById('bizEmail').value.trim()
        };

        const response = await fetch('/api/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save configuration');
        }

        // Redirect to Stripe Checkout if available
        if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
            return;
        }

        // No Stripe → show confirmation
        const voice = VOICES.find(v => v.id === selectedVoice);
        const style = STYLES.find(s => s.id === selectedStyle);
        alert(`🎉 Configuration saved!\n\n📋 Plan: ${PLAN_TIERS[selectedPlan].label}\n🎙️ Voice: ${voice?.name}\n🎨 Style: ${style?.name}\n🏢 Business: ${payload.businessName}\n\nWe'll reach out to ${payload.customerEmail} to finalize setup!`);

    } catch (err) {
        console.error('Save error:', err);
        alert('Something went wrong saving your configuration. Please try again.');
    } finally {
        btnNext.disabled = false;
        btnNext.innerHTML = '🎉 Looks Great!';
        btnNext.style.opacity = '';
    }
}

// =====================================================
// CHECKOUT RESULT HANDLING
// =====================================================
function showCheckoutResult(status) {
    const container = document.querySelector('.config-container');

    if (status === 'success') {
        container.innerHTML = `
            <div class="config-header fade-in visible" style="margin-top: 60px;">
                <h1>🎉 <span class="gradient-text">You're All Set!</span></h1>
                <p style="font-size: 1.1rem; margin-top: 16px;">Your payment was successful. We're provisioning your AI receptionist now.</p>
                <div style="margin-top: 32px; padding: 24px; border-radius: 16px; background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.2);">
                    <p style="color: var(--success); font-weight: 600; margin-bottom: 8px;">✅ What happens next:</p>
                    <ul style="text-align: left; max-width: 400px; margin: 0 auto; color: var(--text-secondary); font-size: .95rem; line-height: 2;">
                        <li>Your AI receptionist is being created (~1 min)</li>
                        <li>You'll receive a confirmation email with your phone number</li>
                        <li>Start receiving AI-answered calls immediately</li>
                    </ul>
                </div>
                <a href="index.html" class="btn btn-primary btn-glow" style="margin-top: 32px; display: inline-flex;">← Back to Home</a>
            </div>`;
    } else {
        container.innerHTML = `
            <div class="config-header fade-in visible" style="margin-top: 60px;">
                <h1>Payment Cancelled</h1>
                <p style="font-size: 1.1rem; margin-top: 16px; color: var(--text-secondary);">No worries — your configuration is saved. You can pick up where you left off.</p>
                <a href="configure.html" class="btn btn-primary btn-glow" style="margin-top: 32px; display: inline-flex;">Try Again</a>
            </div>`;
    }
}

// =====================================================
// INIT — show step 1
// =====================================================
showStep(1);
