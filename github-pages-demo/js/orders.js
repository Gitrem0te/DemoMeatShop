import { supabase } from './supabase.js';
import { escapeHtml, formatDate, message, money, requireAuth } from './auth.js';

async function loadHistory(profile) {
    const form = document.getElementById('sales-filters');
    const params = new URLSearchParams(location.search);
    for (const key of ['q', 'status', 'from', 'to']) {
        if (form.elements[key]) form.elements[key].value = params.get(key) || '';
    }
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        location.search = new URLSearchParams(new FormData(form)).toString();
    });

    let query = supabase.from('sales')
        .select('*, cashier:profiles!sales_cashier_user_id_fkey(full_name)')
        .order('sale_datetime', { ascending: false })
        .limit(200);
    if (form.elements.status.value) query = query.eq('status', form.elements.status.value);
    if (form.elements.q.value.trim()) query = query.ilike('receipt_number', `%${form.elements.q.value.trim()}%`);
    if (form.elements.from.value) query = query.gte('sale_datetime', `${form.elements.from.value}T00:00:00`);
    if (form.elements.to.value) query = query.lte('sale_datetime', `${form.elements.to.value}T23:59:59`);
    const { data: sales, error } = await query;
    if (error) throw error;

    const body = document.getElementById('sales-rows');
    if (!sales.length) {
        body.innerHTML = '<tr><td colspan="8" class="empty">No sales found.</td></tr>';
        return;
    }
    body.innerHTML = sales.map((sale) => {
        const editable = ['Completed', 'Edited'].includes(sale.status)
            && (profile.role === 'admin' || sale.cashier_user_id === profile.id);
        const adminActions = profile.role === 'admin' && editable
            ? `<button class="button button-outline button-small" data-sale-action="void" data-id="${sale.id}">Void</button>
               <button class="button button-danger button-small" data-sale-action="delete" data-id="${sale.id}">Delete</button>`
            : '';
        return `<tr>
            <td><a href="receipt.html?id=${encodeURIComponent(sale.id)}">${escapeHtml(sale.receipt_number)}</a></td>
            <td>${escapeHtml(formatDate(sale.sale_datetime))}</td>
            <td>${escapeHtml(sale.cashier?.full_name || '—')}</td>
            <td>${escapeHtml(sale.customer_name || 'Walk-in')}</td>
            <td>${money(sale.total_amount)}</td>
            <td>${escapeHtml(sale.payment_method)}</td>
            <td><span class="badge ${sale.status === 'Completed' ? 'badge-success' : sale.status === 'Voided' || sale.status === 'Deleted' ? 'badge-danger' : ''}">${escapeHtml(sale.status)}</span></td>
            <td><div class="actions"><a class="button button-outline button-small" href="receipt.html?id=${encodeURIComponent(sale.id)}">Receipt</a>
                ${editable ? `<a class="button button-outline button-small" href="sales.html?id=${encodeURIComponent(sale.id)}">Edit</a>` : ''}${adminActions}</div></td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-sale-action]').forEach((button) => button.addEventListener('click', async () => {
        const action = button.dataset.saleAction;
        if (!confirm(`${action === 'void' ? 'Void this sale and restore stock?' : 'Mark this sale deleted and restore stock?'}`)) return;
        button.disabled = true;
        const { error: actionError } = await supabase.rpc('void_sale', {
            p_sale_id: button.dataset.id,
            p_mode: action,
            p_reason: `${action === 'void' ? 'Voided' : 'Deleted'} by Admin`
        });
        if (actionError) {
            button.disabled = false;
            message('global-message', actionError.message, 'error');
            return;
        }
        await loadHistory(profile);
    }));
}

const profile = await requireAuth();
if (profile && supabase) loadHistory(profile).catch((error) => message('global-message', error.message, 'error'));
