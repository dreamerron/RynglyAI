/* ===================================================
   RinglyAI — Landing Page JavaScript
   =================================================== */

// =====================================================
// CONFIGURATION
// =====================================================
// Backend API endpoint — update this to your deployed URL in production
const API_URL = 'http://localhost:3000/api/call-me';

// Vapi credentials (used as fallback for direct client-side calls)
const VAPI_CONFIG = {
    ASSISTANT_ID: '3015c8af-a34f-4f28-8047-f68990092f87',    // Alex Assistant
    PHONE_NUMBER_ID: 'ad2048fc-2bad-4364-b93a-d87fc43a1e9f'  // +18039257360
};

// =====================================================
// DOM References
// =====================================================
const modalOverlay = document.getElementById('modalOverlay');
const modalForm = document.getElementById('modalForm');
const modalSuccess = document.getElementById('modalSuccess');
const modalError = document.getElementById('modalError');
const errorMessage = document.getElementById('errorMessage');
const demoForm = document.getElementById('demoForm');
const submitBtn = document.getElementById('submitBtn');
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');
const navbar = document.getElementById('navbar');

// =====================================================
// Modal Controls
// =====================================================
function openModal() {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    // Reset after animation completes
    setTimeout(() => {
        resetModal();
    }, 400);
}

function resetModal() {
    modalForm.style.display = '';
    modalSuccess.style.display = 'none';
    modalError.style.display = 'none';
    demoForm.reset();
    setLoading(false);
}

function showSuccess() {
    modalForm.style.display = 'none';
    modalSuccess.style.display = '';
    modalError.style.display = 'none';
}

function showError(message) {
    modalForm.style.display = 'none';
    modalSuccess.style.display = 'none';
    modalError.style.display = '';
    errorMessage.textContent = message || "We couldn't initiate the call. Please try again.";
}

function setLoading(loading) {
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    if (loading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-flex';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
    } else {
        btnText.style.display = '';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '';
    }
}

// Close modal on overlay click
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
    }
});

// =====================================================
// Form Submission & Vapi Call
// =====================================================
async function handleSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('userName').value.trim();
    const countryCode = document.getElementById('countryCode').value;
    const phone = document.getElementById('userPhone').value.trim();

    // Basic validation
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    if (!name) {
        alert('Please enter your name.');
        return;
    }
    if (cleanPhone.length < 7 || !/^\d+$/.test(cleanPhone)) {
        alert('Please enter a valid phone number.');
        return;
    }

    const fullNumber = countryCode + cleanPhone;
    setLoading(true);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                phoneNumber: fullNumber
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.details || 'Call initiation failed');
        }

        showSuccess();
    } catch (err) {
        console.error('Call error:', err);
        showError(err.message || "Something went wrong. Please check your connection and try again.");
    }
}


// =====================================================
// Mobile Navigation
// =====================================================
mobileToggle.addEventListener('click', () => {
    mobileToggle.classList.toggle('active');
    navLinks.classList.toggle('active');
});

// Close mobile nav on link click
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        mobileToggle.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// =====================================================
// Navbar Scroll Effect
// =====================================================
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
}, { passive: true });

// =====================================================
// Fade-in on Scroll (Intersection Observer)
// =====================================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            // Staggered delay for siblings
            const delay = index * 100;
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, delay);
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// =====================================================
// Nav CTA — trigger modal
// =====================================================
document.querySelector('.nav-cta').addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
});
