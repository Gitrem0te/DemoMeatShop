import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase.js';
import { escapeHtml, message, requireAuth } from './auth.js';

const page = location.pathname.split('/').pop();

async function callStaffFunction(payload) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) throw new Error('Your session expired. Sign in again.');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-staff`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Staff service returned HTTP ${response.status}.`);
    return result;
}

async function loadStaffList(profile) {
    const form = document.getElementById('user-filters');
    const params = new URLSearchParams(location.search);
    form.elements.q.value = params.get('q') || '';
    form.elements.status.value = params.get('status') || 'Active';
    if (!form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            location.search = new URLSearchParams(new FormData(form)).toString();
        });
    }
    let query = supabase.from('profiles')
        .select('id,username,email,full_name,status,language_preference')
        .eq('role', 'staff')
        .order('created_at', { ascending: false });
    if (form.elements.status.value !== 'all') query = query.eq('status', form.elements.status.value);
    if (form.elements.q.value.trim()) {
        const q = form.elements.q.value.trim().replace(/[,%()]/g, ' ');
        query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%,email.ilike.%${q}%`);
    }
    const { data: staff, error } = await query;
    if (error) throw error;
    const body = document.getElementById('user-rows');
    if (!staff.length) {
        body.innerHTML = '<tr><td class="empty" colspan="5">No staff accounts found.</td></tr>';
        return;
    }
    body.innerHTML = staff.map((user) => `<tr>
        <td>${escapeHtml(user.full_name)}</td><td>${escapeHtml(user.username)}</td>
        <td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.status)}</td>
        <td><div class="actions">
            <a class="button button-outline button-small" href="user-form.html?id=${encodeURIComponent(user.id)}">Edit</a>
            <button class="button button-outline button-small" data-status="${user.status === 'Archived' ? 'Active' : 'Archived'}" data-id="${user.id}">${user.status === 'Archived' ? 'Restore' : 'Archive'}</button>
            <button class="button button-danger button-small" data-status="Deleted" data-id="${user.id}">Delete</button>
        </div></td>
    </tr>`).join('');
    body.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', async () => {
        const status = button.dataset.status;
        if (!confirm(`${status === 'Deleted' ? 'Mark this account deleted?' : `${status} this staff account?`}`)) return;
        button.disabled = true;
        try {
            await callStaffFunction({ action: 'status', id: button.dataset.id, status });
            await loadStaffList(profile);
        } catch (error) {
            button.disabled = false;
            message('global-message', error.message, 'error');
        }
    }));
}

async function setupStaffForm() {
    const form = document.getElementById('user-form');
    const id = new URLSearchParams(location.search).get('id');
    if (id) {
        const { data: user, error } = await supabase.from('profiles')
            .select('id,username,email,full_name,phone,language_preference,status')
            .eq('id', id).eq('role', 'staff').single();
        if (error) throw error;
        document.getElementById('user-form-title').textContent = 'Edit staff';
        form.elements.password.required = false;
        form.elements.email.value = user.email;
        for (const key of ['username', 'full_name', 'phone', 'language_preference', 'status']) {
            form.elements[key].value = user[key] ?? '';
        }
    }
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            await callStaffFunction({
                action: id ? 'update' : 'create',
                id,
                username: values.username.trim(),
                email: values.email.trim(),
                full_name: values.full_name.trim(),
                phone: values.phone.trim() || null,
                language_preference: values.language_preference,
                status: values.status,
                password: values.password || undefined
            });
            location.replace('users.html');
        } catch (error) {
            button.disabled = false;
            message('user-form-message', error.message, 'error');
        }
    });
}

async function setupProfile() {
    const form = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const { data: profile, error } = await supabase.from('profiles')
        .select('full_name,email,phone,language_preference')
        .eq('id', authData.user.id).single();
    if (error) throw error;
    for (const field of ['full_name', 'email', 'phone', 'language_preference']) {
        form.elements[field].value = profile[field] ?? '';
    }
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const updates = {
            full_name: form.elements.full_name.value.trim(),
            phone: form.elements.phone.value.trim() || null,
            language_preference: form.elements.language_preference.value,
            updated_at: new Date().toISOString()
        };
        const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', authData.user.id);
        if (updateError) {
            message('profile-message', updateError.message, 'error');
            return;
        }
        const nextEmail = form.elements.email.value.trim();
        if (nextEmail && nextEmail !== profile.email) {
            const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
            if (emailError) {
                message('profile-message', `Profile saved, but email update failed: ${emailError.message}`, 'error');
                return;
            }
            message('profile-message', 'Profile saved. Check your inbox to confirm the email change.', 'success');
        } else {
            message('profile-message', 'Profile saved.', 'success');
        }
    });
    passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = passwordForm.elements.password.value;
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) {
            message('password-message', passwordError.message, 'error');
            return;
        }
        passwordForm.reset();
        message('password-message', 'Password updated.', 'success');
    });
}

async function init() {
    const adminPage = page === 'users.html' || page === 'user-form.html';
    const profile = await requireAuth({ adminOnly: adminPage });
    if (!profile || !supabase) return;
    if (page === 'users.html') await loadStaffList(profile);
    if (page === 'user-form.html') await setupStaffForm();
    if (page === 'settings-profile.html') await setupProfile();
}

init().catch((error) => message('global-message', error.message || 'User settings could not be loaded.', 'error'));
