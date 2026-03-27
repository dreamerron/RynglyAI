/* ===================================================
   WeDeskAI — Configurator Wizard Logic
   =================================================== */

// =====================================================
// DATA — Plan config
// =====================================================

const PLAN_TIERS = {
    starter: { level: 0, label: 'Essentials', price: '$69/mo', type: 'voice' },
    growth: { level: 1, label: 'Professional', price: '$99/mo', type: 'voice' },
    enterprise: { level: 2, label: 'Scale', price: 'Custom', type: 'voice' },
    sms_basic: { level: 0, label: 'Text Basic', price: '$29/mo', type: 'sms' },
    sms_pro: { level: 1, label: 'Text Pro', price: '$59/mo', type: 'sms' },
    bundle: { level: 1, label: 'Voice + Text', price: '$129/mo', type: 'bundle' }
};

// =====================================================
// STATE
// =====================================================
let currentStep = 1;
let selectedPlan = null;
let generatedScript = null;
let isEditMode = false;

// =====================================================
// INIT — read URL params, set up mobile nav
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Pre-select plan from URL
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    if (planParam && PLAN_TIERS[planParam]) {
        // Switch plan type toggle if needed
        const planType = PLAN_TIERS[planParam].type;
        if (planType === 'sms') {
            switchPlanType('sms');
        } else if (planType === 'bundle') {
            switchPlanType('bundle');
        }
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

    // UI — highlight selected card across all grids
    document.querySelectorAll('.plan-select-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.plan === planId);
    });
}

// Plan type toggle (Voice / SMS / Bundle)
function switchPlanType(type) {
    // Reset selection when switching type
    selectedPlan = null;
    document.querySelectorAll('.plan-select-card').forEach(c => c.classList.remove('selected'));

    // Toggle buttons
    document.getElementById('toggleVoice').classList.toggle('active', type === 'voice');
    document.getElementById('toggleSms').classList.toggle('active', type === 'sms');
    document.getElementById('toggleBundle').classList.toggle('active', type === 'bundle');

    // Toggle plan grids
    document.getElementById('voicePlanCards').style.display = type === 'voice' ? '' : 'none';
    document.getElementById('smsPlanCards').style.display = type === 'sms' ? '' : 'none';
    document.getElementById('bundlePlanCards').style.display = type === 'bundle' ? '' : 'none';
}

// =====================================================
// SELECTION SUMMARY CHIPS
// =====================================================
function renderSummaryChips(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (selectedPlan) {
        container.innerHTML = `<div class="summary-chip"><span class="chip-label">Plan:</span> ${PLAN_TIERS[selectedPlan].label} (${PLAN_TIERS[selectedPlan].price})</div>`;
    }
}

// =====================================================
// STEP NAVIGATION
// =====================================================
function updateProgressBar() {
    const steps = document.querySelectorAll('.progress-step');
    const lines = [
        document.getElementById('line1'),
        document.getElementById('line2')
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
        if (line) line.classList.toggle('filled', i < currentStep - 1);
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
    if (step === 3) {
        if (generatedScript) {
            btnNext.innerHTML = '🚀 Start Free Trial';
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
        renderSummaryChips('step2Summary');
    }
    if (step === 3) {
        renderSummaryChips('step3Summary');

        // Hide CRM if not Enterprise (planGate)
        const crmGroup = document.getElementById('crmGroup');
        const planLevel = PLAN_TIERS[selectedPlan]?.level || 0;
        crmGroup.style.display = planLevel >= 2 ? 'block' : 'none';
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
    if (currentStep === 1) {
        if (!selectedPlan) {
            alert('Please select a plan to continue.');
            return;
        }
    } else if (currentStep === 2) {
        if (!validateBizForm()) return;
    } else if (currentStep === 3) {
        if (generatedScript) {
            showFinalConfirmation();
            return;
        }
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
        voiceName: 'Alex',
        style: 'Professional'
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
        btnNext.innerHTML = '🚀 Start Free Trial';
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
        btnNext.innerHTML = '🚀 Start Free Trial';
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
            voiceId: 'alex',
            style: 'professional',
            language: 'en',
            businessName: document.getElementById('bizName').value.trim(),
            industry: document.getElementById('bizIndustry').value,
            hours: document.getElementById('bizHours').value.trim() || null,
            phone: document.getElementById('bizPhone').value.trim() || null,
            services: document.getElementById('bizServices').value.trim(),
            faqs: document.getElementById('bizFaqs').value.trim() || null,
            country: document.getElementById('bizCountry').value,
            bookingLink: document.getElementById('bookingLink').value.trim() || null,
            crmLink: document.getElementById('crmLink').value.trim() || null,
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
        alert(`🎉 Configuration saved!\n\n📋 Plan: ${PLAN_TIERS[selectedPlan].label}\n🏢 Business: ${payload.businessName}\n\nWe'll reach out to ${payload.customerEmail} to finalize setup!`);

    } catch (err) {
        console.error('Save error:', err);
        alert('Something went wrong saving your configuration. Please try again.');
    } finally {
        btnNext.disabled = false;
        btnNext.innerHTML = '🚀 Start Free Trial';
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
                <p style="font-size: 1.1rem; margin-top: 16px;">Your 14-day free trial has started. We're provisioning your AI receptionist now.</p>
                <div style="margin-top: 32px; padding: 24px; border-radius: 16px; background: rgba(16,185,129,.08); border: 1px solid rgba(16,185,129,.2);">
                    <p style="color: var(--success); font-weight: 600; margin-bottom: 8px;">✅ What happens next:</p>
                    <ul style="text-align: left; max-width: 400px; margin: 0 auto; color: var(--text-secondary); font-size: .95rem; line-height: 2;">
                        <li>Your AI receptionist is being created (~1 min)</li>
                        <li>You'll receive a confirmation email with your phone number</li>
                        <li>Start receiving AI-answered calls immediately</li>
                        <li>No charge until your 14-day trial ends</li>
                    </ul>
                </div>
                <div style="margin-top: 32px; padding: 24px; border-radius: 16px; background: rgba(124,58,237,.08); border: 1px solid rgba(124,58,237,.2);">
                    <p style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">🔑 Access Your Dashboard</p>
                    <p style="color: var(--text-secondary); font-size: .95rem; margin-bottom: 16px;">Create an account or sign in to manage your AI receptionist, view call logs, and track appointments.</p>
                    <a href="dashboard.html" class="btn btn-primary btn-glow" style="display: inline-flex; width: 100%; justify-content: center;">Sign In / Create Account →</a>
                </div>
                <a href="index.html" style="display: inline-block; margin-top: 20px; color: var(--text-secondary); font-size: .9rem; text-decoration: underline;">← Back to WeDeskAI Home</a>
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
// SCRIPT REGENERATE / EDIT
// =====================================================
async function regenerateScript() {
    // Exit edit mode if active
    if (isEditMode) toggleEditMode();

    // Clear current script so it regenerates fresh
    generatedScript = null;
    document.getElementById('scriptPreview').classList.remove('visible');

    // Re-generate
    await generateScript();
}

function toggleEditMode() {
    isEditMode = !isEditMode;

    const fields = ['Greeting', 'Personality', 'Full'];
    const editBtnText = document.getElementById('editBtnText');
    const saveBtn = document.getElementById('btnSaveScript');

    fields.forEach(field => {
        const textDiv = document.getElementById(`script${field}`);
        const textarea = document.getElementById(`script${field}Edit`);

        if (isEditMode) {
            // Copy content to textarea and show it
            textarea.value = textDiv.textContent;
            textDiv.style.display = 'none';
            textarea.style.display = '';
        } else {
            // Switch back to read-only
            textDiv.style.display = '';
            textarea.style.display = 'none';
        }
    });

    editBtnText.textContent = isEditMode ? 'Cancel Edit' : 'Edit Manually';
    saveBtn.style.display = isEditMode ? '' : 'none';
}

function saveManualEdits() {
    const greeting = document.getElementById('scriptGreetingEdit').value.trim();
    const personality = document.getElementById('scriptPersonalityEdit').value.trim();
    const script = document.getElementById('scriptFullEdit').value.trim();

    if (!greeting && !personality && !script) {
        alert('Please fill in at least one field before saving.');
        return;
    }

    // Update state
    generatedScript = {
        greeting: greeting || generatedScript?.greeting || '',
        personality: personality || generatedScript?.personality || '',
        script: script || generatedScript?.script || ''
    };

    // Update display divs
    document.getElementById('scriptGreeting').textContent = generatedScript.greeting;
    document.getElementById('scriptPersonality').textContent = generatedScript.personality;
    document.getElementById('scriptFull').textContent = generatedScript.script;

    // Exit edit mode
    toggleEditMode();
}

// =====================================================
// INIT — show step 1
// =====================================================
showStep(1);
