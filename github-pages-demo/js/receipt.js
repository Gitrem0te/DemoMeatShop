import { supabase } from './supabase.js';
import { escapeHtml, formatDate, message, money, requireAuth } from './auth.js';

async function init() {
    const profile = await requireAuth();
    if (!profile || !supabase) return;
    document.getElementById('print-receipt').addEventListener('click', () => window.print());
    const id = new URLSearchParams(location.search).get('id');
    if (!id) throw new Error('Receipt ID is missing.');

    const { data: sale, error } = await supabase.from('sales')
        .select('*, cashier:profiles!sales_cashier_user_id_fkey(full_name), sale_items(*), payments(*)')
        .eq('id', id).single();
    if (error) throw error;
    const businessName = 'Come N’ Meatshop';
    const items = sale.sale_items || [];
    document.getElementById('receipt-content').innerHTML = `
        <div class="center"><h1>${businessName}</h1><p>Internal sales receipt</p></div>
        <div class="receipt-meta">
            <div><strong>Receipt #:</strong> ${escapeHtml(sale.receipt_number)}</div>
            <div><strong>Date:</strong> ${escapeHtml(formatDate(sale.sale_datetime))}</div>
            <div><strong>Cashier:</strong> ${escapeHtml(sale.cashier?.full_name || '')}</div>
            <div><strong>Customer:</strong> ${escapeHtml(sale.customer_name || 'Walk-in')}</div>
            <div><strong>Status:</strong> ${escapeHtml(sale.status)}</div>
        </div>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
            ${items.map((item) => `<tr><td>${escapeHtml(item.product_name_snapshot)}</td><td>${Number(item.quantity)} ${escapeHtml(item.unit_snapshot)}</td><td>${money(item.line_subtotal)}</td></tr>`).join('')}
        </tbody></table>
        <div class="summary-list">
            <div class="summary-row"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
            <div class="summary-row"><span>Discount</span><span>${money(sale.discount_amount)}</span></div>
            <div class="summary-row"><span>VAT</span><span>${money(sale.vat_amount)}</span></div>
            <div class="summary-row"><strong>Total</strong><strong>${money(sale.total_amount)}</strong></div>
            <div class="summary-row"><span>${escapeHtml(sale.payment_method)} paid</span><span>${money(sale.amount_paid)}</span></div>
            <div class="summary-row"><span>Change</span><span>${money(sale.change_due)}</span></div>
        </div><hr><p class="center">Thank you for shopping with us!</p>`;
}

init().catch((error) => message('global-message', error.message || 'Receipt could not be loaded.', 'error'));
