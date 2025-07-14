let currentLanguage = 'en';
let translations = {};

// Function to apply translations to the page
function applyTranslations() {
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        const value = key.split('.').reduce((obj, i) => (obj ? obj[i] : null), translations);
        if (value) {
            element.textContent = value;
        } else {
            console.warn(`Translation not found for key: ${key}`);
        }
    });
}

// Function to update the UI for language switchers
function updateUI() {
    document.querySelectorAll('.lang-switcher').forEach(button => {
        if (button.getAttribute('data-lang') === currentLanguage) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// A list of supported languages.
const SUPPORTED_LANGUAGES = ['en', 'ko', 'fr'];

// Detect language from localStorage or browser settings
function detectLanguage() {
    // Clear old settings if they exist from previous versions
    if (localStorage.getItem('language')) {
        localStorage.removeItem('language');
    }

    const savedLang = localStorage.getItem('lang');
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) {
        return savedLang;
    }

    // Use navigator.languages if available, which provides a list of preferred languages.
    const browserLangs = navigator.languages || [navigator.language];
    for (const lang of browserLangs) {
        const primaryLang = lang.split('-')[0];
        if (SUPPORTED_LANGUAGES.includes(primaryLang)) {
            return primaryLang;
        }
    }

    return 'en'; // Default to English
}

// Function to change the language
function changeLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
        lang = 'en'; // Default to English if language is not supported
    }

    fetch(`i18n/${lang}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            translations = data;
            currentLanguage = lang;
            localStorage.setItem('lang', lang);
            document.documentElement.lang = lang;
            applyTranslations();
            updateUI();
        })
        .catch(error => {
            console.error('Error loading translation file:', error);
        });
}

// Initialization function
function init() {
    const initialLang = detectLanguage();
    changeLanguage(initialLang);

    document.querySelectorAll('.lang-switcher').forEach(button => {
        button.addEventListener('click', () => {
            const lang = button.getAttribute('data-lang');
            changeLanguage(lang);
        });
    });
}

// Run initialization when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
