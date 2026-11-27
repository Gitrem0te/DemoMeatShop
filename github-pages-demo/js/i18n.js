const translations = {
    en: {
        dashboard: 'Dashboard', inventory: 'Inventory', sales: 'Sales',
        history: 'Sales History', users: 'Users', reports: 'Reports',
        analytics: 'Analytics', notifications: 'Notifications',
        profile: 'Profile', admin: 'Admin', logout: 'Log out',
        login: 'Sign in', email: 'Email', password: 'Password',
        search: 'Search', save: 'Save', cancel: 'Cancel',
        addProduct: 'Add product', addStock: 'Add stock',
        noRecords: 'No records found.', loading: 'Loading…',
        language: 'Language', english: 'English', filipino: 'Filipino',
        unauthorized: 'You do not have permission to access this page.'
    },
    fil: {
        dashboard: 'Dashboard', inventory: 'Imbentaryo', sales: 'Benta',
        history: 'Kasaysayan ng Benta', users: 'Mga User', reports: 'Mga Ulat',
        analytics: 'Analitika', notifications: 'Mga Abiso',
        profile: 'Profile', admin: 'Admin', logout: 'Mag-logout',
        login: 'Mag-sign in', email: 'Email', password: 'Password',
        search: 'Maghanap', save: 'I-save', cancel: 'Kanselahin',
        addProduct: 'Magdagdag ng produkto', addStock: 'Magdagdag ng stock',
        noRecords: 'Walang nahanap na tala.', loading: 'Naglo-load…',
        language: 'Wika', english: 'English', filipino: 'Filipino',
        unauthorized: 'Wala kang pahintulot na buksan ang pahinang ito.'
    }
};

export function currentLanguage() {
    return localStorage.getItem('meatshop-language') === 'fil' ? 'fil' : 'en';
}

export function t(key) {
    return translations[currentLanguage()][key] || translations.en[key] || key;
}

export function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.dataset.i18n;
        if (key) element.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const key = element.dataset.i18nPlaceholder;
        if (key) element.setAttribute('placeholder', t(key));
    });
    document.documentElement.lang = currentLanguage();
}

export function setLanguage(language) {
    localStorage.setItem('meatshop-language', language === 'fil' ? 'fil' : 'en');
    applyTranslations();
    window.dispatchEvent(new CustomEvent('languagechange', { detail: currentLanguage() }));
}
