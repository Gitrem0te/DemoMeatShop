import { isSupabaseConfigured, supabase } from './supabase.js';
import { applyTranslations, currentLanguage, setLanguage, t } from './i18n.js';

const links = [
    ['dashboard.html', 'dashboard', 'dashboard'],
    ['inventory.html', 'inventory', 'inventory'],
    ['sales.html', 'sales', 'sales'],
    ['sales-history.html', 'history', 'history'],
    ['notifications.html', 'notifications', 'notifications'],
    ['reports-sales.html', 'reports', 'reports', true],
    ['analytics.html', 'analytics', 'analytics', true],
    ['users.html', 'users', 'users', true],
    ['settings-profile.html', 'profile', 'profile'],
    ['admin.html', 'admin', 'admin', true]
];

export function message(elementOrId, text, kind = 'info') {
    const element = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;
    if (!element) return;
    element.textContent = text;
    element.className = `notice notice-${kind}`;
    element.hidden = false;
}

export function clearMessage(elementOrId) {
    const element = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;
    if (element) {
        element.textContent = '';
        element.hidden = true;
    }
}

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

export function money(value) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(Number(value || 0));
}

export function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString(currentLanguage() === 'fil' ? 'fil-PH' : 'en-PH');
}

function renderShell(profile) {
    const header = document.getElementById('app-header');
    if (!header) return;
    const admin = profile.role === 'admin';
    const visibleLinks = links.filter(([, , , adminOnly]) => !adminOnly || admin);
    header.innerHTML = `
        <div class="topbar">
            <a class="brand" href="dashboard.html">Come N' Meatshop <span>Inventory & POS</span></a>
            <div class="topbar-actions">
                <label class="language-picker"><span data-i18n="language">${t('language')}</span>
                    <select id="languagePicker" aria-label="${t('language')}">
                        <option value="en">${t('english')}</option>
                        <option value="fil">${t('filipino')}</option>
                    </select>
                </label>
                <span class="user-chip">${escapeHtml(profile.full_name || profile.email)} · ${admin ? 'Admin' : 'Staff'}</span>
                <button class="button button-outline button-small" id="logoutButton" data-i18n="logout">${t('logout')}</button>
            </div>
        </div>
        <nav class="main-nav" aria-label="Main navigation">
            ${visibleLinks.map(([href, key, labelKey]) =>
                `<a href="${href}" data-i18n="${labelKey}">${t(key)}</a>`).join('')}
        </nav>`;
    const picker = document.getElementById('languagePicker');
    picker.value = currentLanguage();
    picker.addEventListener('change', () => setLanguage(picker.value));
    document.getElementById('logoutButton').addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            message('global-message', error.message, 'error');
            return;
        }
        location.replace('login.html');
    });
    applyTranslations(header);
}

export async function requireAuth({ adminOnly = false } = {}) {
    if (!isSupabaseConfigured || !supabase) {
        message('global-message', 'Add your Supabase project URL and publishable key in js/supabase.js, then reload.', 'warning');
        return null;
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        message('global-message', sessionError.message, 'error');
        return null;
    }
    const session = sessionData.session;
    if (!session) {
        location.replace('login.html');
        return null;
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
    if (error) {
        message('global-message', error.message, 'error');
        return null;
    }
    if (!profile || profile.status !== 'Active') {
        await supabase.auth.signOut();
        location.replace('login.html');
        return null;
    }
    if (adminOnly && profile.role !== 'admin') {
        message('global-message', t('unauthorized'), 'error');
        setTimeout(() => location.replace('dashboard.html'), 700);
        return null;
    }

    window.currentProfile = profile;
    renderShell(profile);
    applyTranslations();
    return profile;
}

export async function signedInProfile() {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return null;
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .maybeSingle();
    if (profileError) throw profileError;
    return profile;
}
