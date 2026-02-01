// Internationalization system
const i18n = {
    currentLang: localStorage.getItem('language') || 'en',
    translations: {},
    
    async init() {
        // Load both language files
        await this.loadLanguage('en');
        await this.loadLanguage('ja');
        
        // Apply saved or default language
        this.setLanguage(this.currentLang);
    },
    
    async loadLanguage(lang) {
        try {
            const response = await fetch(`/locales/${lang}.json`);
            this.translations[lang] = await response.json();
        } catch (error) {
            console.error(`Failed to load ${lang} translations:`, error);
            // Fallback to empty object to prevent crashes
            this.translations[lang] = {};
        }
    },
    
    t(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLang];
        
        for (const k of keys) {
            value = value?.[k];
        }
        
        // If translation not found in current language, try English as fallback
        if (!value && this.currentLang !== 'en') {
            let fallbackValue = this.translations['en'];
            for (const k of keys) {
                fallbackValue = fallbackValue?.[k];
            }
            // Return fallback or the key itself if nothing found
            return fallbackValue || key;
        }
        
        // Return value or key if nothing found (prevents undefined/null display)
        return value || key;
    },
    
    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('language', lang);
        this.updateUI();
        this.updateToggleButton();
    },
    
    updateUI() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            // Always update with the translation (which may be the key itself as fallback)
            element.textContent = translation;
        });
        
        // Update all placeholders with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            // Always update with the translation
            element.placeholder = translation;
        });
        
        // Update page title
        document.title = this.currentLang === 'ja' ? 'ビタミン英語' : 'Vitamin English';
    },
    
    updateToggleButton() {
        const toggle = document.getElementById('lang-toggle');
        if (toggle) {
            toggle.textContent = this.currentLang === 'en' ? '🇯🇵 日本語' : '🇺🇸 English';
            toggle.setAttribute('aria-label', `Switch to ${this.currentLang === 'en' ? 'Japanese' : 'English'}`);
        }
    },
    
    toggleLanguage() {
        const newLang = this.currentLang === 'en' ? 'ja' : 'en';
        this.setLanguage(newLang);
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
});
