import { supabase } from './supabase.js';
import { escapeHtml, formatDate, message, money, requireAuth } from './auth.js';

async function loadDashboard() {
    if (window.currentProfile.role === 'admin') {
        const { error: alertsError } = await supabase.rpc('generate_inventory_alerts');
        if (alertsError) throw alertsError;
    }
    const { data, error } = await supabase.rpc('get_dashboard_data');
    if (error) throw error;
    document.getElementById('today-total').textContent = money(data.todayTotal);
    document.getElementById('today-count').textContent = `${data.todayCount} transactions`;
    document.getElementById('month-total').textContent = money(data.monthTotal);
    document.getElementById('month-count').textContent = `${data.monthCount} transactions`;
    document.getElementById('active-products').textContent = data.activeProducts;
    document.getElementById('inventory-value').textContent = money(data.inventoryValue);
    document.getElementById('low-count').textContent = data.lowCount;
    document.getElementById('out-count').textContent = data.outCount;
    document.getElementById('near-expiry').textContent = data.nearExpiry;
    document.getElementById('low-items').innerHTML = `<table><thead><tr><th>Product</th><th>Stock</th></tr></thead><tbody>${data.lowItems.map((item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${Number(item.stock_quantity).toFixed(3)} ${escapeHtml(item.unit)}</td></tr>`
    ).join('') || '<tr><td colspan="2">No low-stock products.</td></tr>'}</tbody></table>`;
    document.getElementById('recent-sales').innerHTML = `<table><thead><tr><th>Receipt</th><th>Cashier</th><th>Total</th></tr></thead><tbody>${data.recentSales.map((sale) =>
        `<tr><td><a href="receipt.html?id=${encodeURIComponent(sale.id)}">${escapeHtml(sale.receipt_number)}</a><div class="muted">${escapeHtml(formatDate(sale.sale_datetime))}</div></td><td>${escapeHtml(sale.cashier_name || '')}</td><td>${money(sale.total_amount)}</td></tr>`
    ).join('') || '<tr><td colspan="3">No sales recorded.</td></tr>'}</tbody></table>`;
}

async function init() {
    const isAdminHub = location.pathname.endsWith('admin.html');
    const profile = await requireAuth({ adminOnly: isAdminHub });
    if (!profile || !supabase) return;
    if (location.pathname.endsWith('dashboard.html')) await loadDashboard();
}

init().catch((error) => message('global-message', error.message || 'Dashboard could not be loaded.', 'error'));
