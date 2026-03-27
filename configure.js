/* ===================================================
   WeDeskAI — Configurator Wizard Logic (Full Wizard Redesign)
   =================================================== */

// =====================================================
// STATE
// =====================================================
let selectedProduct = null; // 'voice' | 'sms'
let currentStepIndex = 0;
let selectedPlan = null;
let generatedScript = null;
let isEditMode = false;
let smsRules = [{ keyword: '', reply: '' }];

// =====================================================
// CONSTANTS
// =====================================================
const VOICE_STEPS = ['step1', 'step2', 'step3voice', 'step4voice'];
const SMS_STEPS   = ['step1', 'step2', 'step3sms'];

const PLAN_TIERS = {
    starter:   { level: 0, label: 'Essential',      price: '$69/mo',  type: 'voice' },
    growth:    { level: 1, label: 'Professional',    price: '$99/mo',  type: 'voice' },
    sms_basic: { level: 0, label: 'SMS Starter',     price: '$29/mo',  type: 'sms'   },
    sms_pro:   { level: 1, label: 'SMS Growth',      price: '$59/mo',  type: 'sms'   },
    sms_scale: { level: 2, label: 'SMS Scale',       price: '$149/mo', type: 'sms'   }
};

// =====================================================
// HELPERS
// =====================================================
function getCurrentSteps() {
    return selectedProduct === 'sms' ? SMS_STEPS : VOICE_STEPS;
}

function getStepId() {
    return getCurrentSteps()[currentStepIndex];
}

// =====================================================
// PRODUCT GATE
// =====================================================
function selectProduct(product) {
    selectedProduct = product;

    // Swap gate for wizard
    document.getElementById('productGate').style.display = 'none';
    document.getElementById('wizardContainer').style.display = '';
    document.getElementById('wizardNav').style.display = '';

    if (product === 'voice') {
        document.getElementById('voicePlansContainer').style.display = '';
        document.getElementById('smsPlansContainer').style.display = 'none';
        document.getElementById('wizardTitle').innerHTML = 'Build Your <span class="gradient-text">AI Receptionist</span>';
        document.getElementById('wizardSubtitle').textContent = '4 easy steps. Takes under 2 minutes.';
        document.getElementById('productBadge').textContent = '📞 AI Voice Receptionist';
    } else {
        document.getElementById('smsPlansContainer').style.display = '';
        document.getElementById('voicePlansContainer').style.display = 'none';
        document.getElementById('wizardTitle').innerHTML = 'Set Up Your <span class="gradient-text">SMS AI Frontdesk</span>';
        document.getElementById('wizardSubtitle').textContent = '3 easy steps. Takes under 2 minutes.';
        document.getElementById('productBadge').textContent = '💬 SMS AI Frontdesk';
    }

    // Reset state
    currentStepIndex = 0;
    selectedPlan = null;
    generatedScript = null;

    renderProgressBar();
    showCurrentStep();
}

// =====================================================
// PROGRESS BAR
// =====================================================
function renderProgressBar() {
    const steps = getCurrentSteps();
    const labels = {
        step1:      'Plan',
        step2:      'Business Info',
        step3voice: 'Phone Number',
        step4voice: 'Script',
        step3sms:   'SMS Rules'
    };

    let html = '';
    steps.forEach((stepId, i) => {
        html += `
            <div class="progress-step" data-index="${i}">
                <div class="step-circle">${i + 1}</div>
                <span class="step-label">${labels[stepId] || stepId}</span>
            </div>`;
        if (i < steps.length - 1) {
            html += `<div class="progress-line" id="pline${i}"><div class="line-fill"></div></div>`;
        }
    });

    document.getElementById('progressBar').innerHTML = html;
    updateProgressBar();
}

function updateProgressBar() {
    const steps = document.querySelectorAll('.progress-step');
    const totalSteps = getCurrentSteps().length;

    steps.forEach((step, i) => {
        step.classList.remove('active', 'completed');
        if (i < currentStepIndex) {
            step.classList.add('completed');
            step.querySelector('.step-circle').textContent = '✓';
        } else if (i === currentStepIndex) {
            step.classList.add('active');
            step.querySelector('.step-circle').textContent = i + 1;
        } else {
            step.querySelector('.step-circle').textContent = i + 1;
        }
    });

    for (let i = 0; i < totalSteps - 1; i++) {
        const line = document.getElementById(`pline${i}`);
        if (line) line.classList.toggle('filled', i < currentStepIndex);
    }
}

// =====================================================
// STEP DISPLAY
// =====================================================
function showCurrentStep() {
    const stepId = getStepId();

    // Hide all wizard steps
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));

    // Show target step
    const target = document.getElementById(stepId);
    if (target) target.classList.add('active');

    updateProgressBar();

    // Back button — hidden on first step
    document.getElementById('btnBack').style.visibility = currentStepIndex === 0 ? 'hidden' : 'visible';

    // Next button text
    const btnNext = document.getElementById('btnNext');
    if (stepId === 'step4voice') {
        if (generatedScript) {
            btnNext.innerHTML = '🚀 Start Free Trial';
        } else {
            btnNext.innerHTML = `✨ Generate Script
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>`;
        }
    } else if (stepId === 'step3sms') {
        btnNext.innerHTML = '🚀 Start Free Trial';
    } else {
        btnNext.innerHTML = `Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
            </svg>`;
    }

    // Step-specific setup
    if (stepId === 'step2') {
        renderSummaryChips('step2Summary');
    } else if (stepId === 'step3voice') {
        renderSummaryChips('step3vSummary');
        // CRM field only for Professional (level >= 1)
        const planLevel = PLAN_TIERS[selectedPlan]?.level || 0;
        document.getElementById('crmGroup').style.display = planLevel >= 1 ? 'block' : 'none';
    } else if (stepId === 'step4voice') {
        renderSummaryChips('step4Summary');
    } else if (stepId === 'step3sms') {
        renderSummaryChips('step3sSummary');
        renderSmsRules();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================
// NAVIGATION
// =====================================================
function nextStep() {
    const stepId = getStepId();

    if (stepId === 'step1') {
        if (!selectedPlan) {
            alert('Please select a plan to continue.');
            return;
        }
    } else if (stepId === 'step2') {
        if (!validateBizForm()) return;
    } else if (stepId === 'step3voice') {
        // Optional fields — always proceed
    } else if (stepId === 'step4voice') {
        if (generatedScript) {
            showFinalConfirmation();
            return;
        }
        generateScript();
        return;
    } else if (stepId === 'step3sms') {
        showFinalConfirmation();
        return;
    }

    currentStepIndex++;
    showCurrentStep();
}

function prevStep() {
    if (currentStepIndex === 0) {
        // Go back to product gate
        document.getElementById('wizardContainer').style.display = 'none';
        document.getElementById('wizardNav').style.display = 'none';
        document.getElementById('productGate').style.display = '';
        selectedPlan = null;
        generatedScript = null;
        document.querySelectorAll('.plan-select-card').forEach(c => c.classList.remove('selected'));
    } else {
        currentStepIndex--;
        showCurrentStep();
    }
}

// =====================================================
// PLAN SELECTION
// =====================================================
function selectPlan(planId) {
    selectedPlan = planId;
    document.querySelectorAll('.plan-select-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.plan === planId);
    });
}

// =====================================================
// SUMMARY CHIPS
// =====================================================
function renderSummaryChips(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (selectedPlan && PLAN_TIERS[selectedPlan]) {
        container.innerHTML = `<div class="summary-chip"><span class="chip-label">Plan:</span> ${PLAN_TIERS[selectedPlan].label} (${PLAN_TIERS[selectedPlan].price})</div>`;
    } else {
        container.innerHTML = '';
    }
}

// =====================================================
// SMS RULES
// =====================================================
function renderSmsRules() {
    const container = document.getElementById('smsRulesContainer');
    if (!container) return;

    let html = '';
    smsRules.forEach((rule, i) => {
        html += `
        <div class="sms-rule-item" id="smsRule${i}">
            <div class="sms-rule-fields">
                <div class="form-group">
                    <label>When customer texts:</label>
                    <input type="text" value="${escapeHtml(rule.keyword)}" placeholder="e.g., HOURS"
                        oninput="smsRules[${i}].keyword = this.value.toUpperCase(); this.value = this.value.toUpperCase();">
                </div>
                <div class="form-group">
                    <label>AI replies with:</label>
                    <textarea rows="2" placeholder="e.g., We're open Mon-Fri 9am-5pm"
                        oninput="smsRules[${i}].reply = this.value">${escapeHtml(rule.reply)}</textarea>
                </div>
            </div>
            ${smsRules.length > 1 ? `<button type="button" class="btn-remove-rule" onclick="removeSmsRule(${i})" title="Remove rule">×</button>` : ''}
        </div>`;
    });
    container.innerHTML = html;
}

function addSmsRule() {
    smsRules.push({ keyword: '', reply: '' });
    renderSmsRules();
}

function removeSmsRule(index) {
    smsRules.splice(index, 1);
    renderSmsRules();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

        if (!response.ok) throw new Error('Failed to generate script');

        const data = await response.json();
        generatedScript = data;

        document.getElementById('scriptGreeting').textContent = data.greeting || '';
        document.getElementById('scriptPersonality').textContent = data.personality || '';
        document.getElementById('scriptFull').textContent = data.script || '';

        document.getElementById('scriptLoading').style.display = 'none';
        document.getElementById('scriptPreview').classList.add('visible');

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

// Local fallback script generation
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
        let payload = {
            plan: selectedPlan,
            language: 'en',
            businessName: document.getElementById('bizName').value.trim(),
            industry: document.getElementById('bizIndustry').value,
            hours: document.getElementById('bizHours').value.trim() || null,
            phone: document.getElementById('bizPhone').value.trim() || null,
            services: document.getElementById('bizServices').value.trim(),
            faqs: document.getElementById('bizFaqs').value.trim() || null,
            country: document.getElementById('bizCountry').value,
            customerEmail: document.getElementById('bizEmail').value.trim()
        };

        if (selectedProduct === 'voice') {
            payload.voiceId = 'alex';
            payload.style = 'professional';
            payload.bookingLink = document.getElementById('bookingLink').value.trim() || null;
            payload.crmLink = document.getElementById('crmLink').value.trim() || null;
            payload.greeting = generatedScript?.greeting || null;
            payload.personality = generatedScript?.personality || null;
            payload.script = generatedScript?.script || null;
        } else {
            // SMS
            payload.smsRules = smsRules.filter(r => r.keyword.trim());
            payload.smsFallback = document.getElementById('smsFallback').value.trim() || null;
            payload.bookingLink = document.getElementById('bookingLinkSms').value.trim() || null;
        }

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

        // No Stripe → show confirmation inline
        showCheckoutResult('success');

    } catch (err) {
        console.error('Save error:', err);
        alert('Something went wrong saving your configuration. Please try again.');
    } finally {
        if (btnNext) {
            btnNext.disabled = false;
            btnNext.innerHTML = selectedProduct === 'sms' || getStepId() === 'step4voice'
                ? '🚀 Start Free Trial'
                : `Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
            btnNext.style.opacity = '';
        }
    }
}

// =====================================================
// CHECKOUT RESULT HANDLING
// =====================================================
function showCheckoutResult(status) {
    const container = document.querySelector('.config-container');
    const isVoice = selectedProduct !== 'sms';

    // Calculate trial end date
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const trialEndStr = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (status === 'success') {
        container.innerHTML = `
            <div class="config-header fade-in visible" style="margin-top: 60px; text-align: center;">
                <h1>🎉 <span class="gradient-text">Your AI is Live!</span></h1>
                <p style="font-size: 1.05rem; margin-top: 12px; color: var(--text-secondary);">Your 14-day free trial has started. Setup completes in under 60 seconds.</p>
            </div>

            <div style="max-width: 560px; margin: 32px auto 0;">

                <!-- Status checklist -->
                <div style="padding: 28px; border-radius: 16px; background: rgba(16,185,129,.07); border: 1px solid rgba(16,185,129,.2); margin-bottom: 24px;">
                    <p style="font-weight: 700; font-size: 1rem; margin-bottom: 16px; color: var(--text-primary);">Activation Status</p>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: .95rem; color: var(--text-secondary);">
                        <div>✅ AI Assistant Created</div>
                        <div>✅ ${isVoice ? 'Phone Number Being Assigned' : 'SMS Number Being Configured'}</div>
                        <div>✅ ${isVoice ? 'Script Loaded' : 'Auto-Replies Configured'}</div>
                        <div>✅ Trial Started — No charge until ${trialEndStr}</div>
                    </div>
                </div>

                <!-- Test section -->
                <div style="padding: 28px; border-radius: 16px; background: rgba(124,58,237,.07); border: 1px solid rgba(124,58,237,.2); margin-bottom: 24px;">
                    <p style="font-weight: 700; font-size: 1rem; margin-bottom: 10px; color: var(--text-primary);">
                        ${isVoice ? '📞 Make a Test Call' : '💬 Test a Reply'}
                    </p>
                    <p style="color: var(--text-secondary); font-size: .92rem; margin-bottom: 0; line-height: 1.6;">
                        ${isVoice
                            ? 'Call your new number to hear Alex answer. Your number will appear in the dashboard within 60 seconds of payment.'
                            : 'Text HOURS to your number to test the auto-reply. Your number will appear in the dashboard within 60 seconds.'}
                    </p>
                </div>

                <!-- What happens next -->
                <div style="padding: 28px; border-radius: 16px; background: rgba(6,182,212,.05); border: 1px solid rgba(6,182,212,.15); margin-bottom: 28px;">
                    <p style="font-weight: 700; font-size: 1rem; margin-bottom: 12px; color: var(--text-primary);">What Happens Next</p>
                    <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: .9rem; color: var(--text-secondary);">
                        <li>→ Confirmation email sent to your inbox</li>
                        <li>→ ${isVoice ? 'Local phone number provisioned in ~60 seconds' : 'Dedicated SMS number provisioned in ~60 seconds'}</li>
                        <li>→ ${isVoice ? 'Calls start being answered immediately' : 'Auto-replies go live immediately'}</li>
                        <li>→ Access your dashboard to view logs and make changes</li>
                        <li>→ No charge until your trial ends on ${trialEndStr}</li>
                    </ul>
                </div>

                <!-- Dashboard CTA -->
                <a href="dashboard.html" class="btn btn-primary btn-glow" style="display: flex; justify-content: center; width: 100%; box-sizing: border-box;">Go to Dashboard →</a>

                <p style="text-align: center; margin-top: 16px;">
                    <a href="index.html" style="color: var(--text-muted); font-size: .88rem; text-decoration: underline;">← Back to WeDeskAI Home</a>
                </p>
            </div>`;

        // Hide nav
        const nav = document.getElementById('wizardNav');
        if (nav) nav.style.display = 'none';

    } else {
        container.innerHTML = `
            <div class="config-header fade-in visible" style="margin-top: 60px; text-align: center;">
                <h1>Payment Cancelled</h1>
                <p style="font-size: 1.05rem; margin-top: 16px; color: var(--text-secondary);">No worries — your configuration is saved. You can pick up where you left off.</p>
                <a href="configure.html" class="btn btn-primary btn-glow" style="margin-top: 32px; display: inline-flex;">Try Again</a>
            </div>`;

        const nav = document.getElementById('wizardNav');
        if (nav) nav.style.display = 'none';
    }
}

// =====================================================
// SCRIPT REGENERATE / EDIT / SAVE
// =====================================================
async function regenerateScript() {
    if (isEditMode) toggleEditMode();
    generatedScript = null;
    document.getElementById('scriptPreview').classList.remove('visible');
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
            textarea.value = textDiv.textContent;
            textDiv.style.display = 'none';
            textarea.style.display = '';
        } else {
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

    generatedScript = {
        greeting: greeting || generatedScript?.greeting || '',
        personality: personality || generatedScript?.personality || '',
        script: script || generatedScript?.script || ''
    };

    document.getElementById('scriptGreeting').textContent = generatedScript.greeting;
    document.getElementById('scriptPersonality').textContent = generatedScript.personality;
    document.getElementById('scriptFull').textContent = generatedScript.script;

    toggleEditMode();
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);

    // Handle Stripe redirect results
    if (params.get('success') === 'true' || params.get('cancelled') === 'true') {
        document.getElementById('productGate').style.display = 'none';
        document.getElementById('wizardContainer').style.display = '';
        showCheckoutResult(params.get('success') === 'true' ? 'success' : 'cancelled');
        return;
    }

    // Auto-select product from URL param
    const productParam = params.get('product');
    if (productParam === 'voice' || productParam === 'sms') {
        selectProduct(productParam);

        // Pre-select plan if also specified
        const planParam = params.get('plan');
        if (planParam && PLAN_TIERS[planParam] && PLAN_TIERS[planParam].type === productParam) {
            selectPlan(planParam);
        }
        return;
    }

    // Legacy: handle ?plan= for backwards compatibility
    const planParam = params.get('plan');
    if (planParam && PLAN_TIERS[planParam]) {
        const planType = PLAN_TIERS[planParam].type;
        if (planType === 'voice' || planType === 'sms') {
            selectProduct(planType);
            selectPlan(planParam);
            return;
        }
    }

    // Mobile nav toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');
    if (mobileToggle && navLinks) {
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
    }
});
