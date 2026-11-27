import { supabase } from './supabase.js';
import { escapeHtml, formatDate, message, requireAuth } from './auth.js';

async function init() {
    const profile = await requireAuth();
    if (!profile || !supabase) return;
    const filter = document.getElementById('notification-filter');
    async function render() {
        let query = supabase.from('user_notifications')
            .select('id,notification_id,is_read,is_cleared,created_at,notification:notifications(title,message,severity,notification_type,action_url,created_at)')
            .eq('user_id', profile.id)
            .eq('is_cleared', false)
            .order('created_at', { ascending: false })
            .limit(100);
        if (filter.value === 'read') query = query.eq('is_read', true);
        if (filter.value === 'unread') query = query.eq('is_read', false);
        const { data, error } = await query;
        if (error) throw error;
        const container = document.getElementById('notification-list');
        if (!data.length) {
            container.innerHTML = '<div class="card col-12 empty">No notifications found.</div>';
            return;
        }
        container.innerHTML = data.map((row) => `<article class="card col-12">
            <div class="page-header"><div><span class="badge ${row.notification.severity === 'danger' ? 'badge-danger' : row.notification.severity === 'success' ? 'badge-success' : row.notification.severity === 'warning' ? 'badge-warning' : ''}">${escapeHtml(row.notification.severity)}</span>
            <strong>${escapeHtml(row.notification.title)}</strong> ${row.is_read ? '' : '<span class="badge">New</span>'}
            <p>${escapeHtml(row.notification.message)}</p><small class="muted">${escapeHtml(formatDate(row.notification.created_at))} · ${escapeHtml(row.notification.notification_type)}</small></div>
            <div class="actions">${row.notification.action_url ? '<a class="button button-outline button-small" data-open-notification href="inventory.html">Open</a>' : ''}
            ${!row.is_read ? '<button class="button button-outline button-small" data-state="read">Mark read</button>' : ''}
            <button class="button button-outline button-small" data-state="clear">Clear</button></div></div>
        </article>`).join('');
        container.querySelectorAll('article').forEach((article, index) => {
            const row = data[index];
            article.querySelectorAll('[data-state]').forEach((button) => button.addEventListener('click', async () => {
                button.disabled = true;
                const { error: updateError } = await supabase.rpc('set_notification_state', {
                    p_notification_id: row.notification_id,
                    p_action: button.dataset.state
                });
                if (updateError) {
                    button.disabled = false;
                    message('global-message', updateError.message, 'error');
                    return;
                }
                await render();
            }));
            const openLink = article.querySelector('[data-open-notification]');
            if (openLink) {
                const target = row.notification.action_url || '';
                openLink.href = target.startsWith('receipt.html?id=')
                    ? target
                    : target.includes('sales') ? 'sales-history.html'
                    : target.includes('users') ? 'users.html'
                    : target.includes('dashboard') ? 'dashboard.html'
                    : 'inventory.html';
                openLink.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const { error: updateError } = await supabase.rpc('set_notification_state', {
                        p_notification_id: row.notification_id,
                        p_action: 'read'
                    });
                    if (updateError) {
                        message('global-message', updateError.message, 'error');
                        return;
                    }
                    location.href = openLink.href;
                });
            }
        });
    }

    filter.addEventListener('change', () => render().catch((error) => message('global-message', error.message, 'error')));
    document.getElementById('mark-all-read').addEventListener('click', async () => {
        const { data, error } = await supabase.from('user_notifications').select('notification_id').eq('user_id', profile.id).eq('is_read', false).eq('is_cleared', false);
        if (error) { message('global-message', error.message, 'error'); return; }
        for (const row of data) {
            const { error: updateError } = await supabase.rpc('set_notification_state', { p_notification_id: row.notification_id, p_action: 'read' });
            if (updateError) { message('global-message', updateError.message, 'error'); return; }
        }
        await render();
    });
    document.getElementById('clear-read').addEventListener('click', async () => {
        const { data, error } = await supabase.from('user_notifications').select('notification_id').eq('user_id', profile.id).eq('is_read', true).eq('is_cleared', false);
        if (error) { message('global-message', error.message, 'error'); return; }
        for (const row of data) {
            const { error: updateError } = await supabase.rpc('set_notification_state', { p_notification_id: row.notification_id, p_action: 'clear' });
            if (updateError) { message('global-message', updateError.message, 'error'); return; }
        }
        await render();
    });
    await render();
}

init().catch((error) => message('global-message', error.message || 'Notifications could not be loaded.', 'error'));
