import { supabase } from './supabase.js';
import { escapeHtml, formatDate, message, money, requireAuth } from './auth.js';

const page = location.pathname.split('/').pop();
const draftKey = 'meatshop-sale-draft';

function getDraft() {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || 'null'); }
    catch { return null; }
}

function setDraft(draft) {
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
}

function totals(subtotal, discountPercent, vatPercent) {
    const discount = Math.round(subtotal * discountPercent * 100) / 100;
    const discounted = Math.max(0, subtotal - discount);
    const vat = Math.round(discounted * vatPercent * 100) / 100;
    return { subtotal, discount, vat, total: discounted + vat };
}

async function loadProducts() {
    const { data, error } = await supabase.from('products')
        .select('id,name,meat_type,price,unit,stock_quantity')
        .eq('status', 'Active')
        .gt('stock_quantity', 0)
        .order('name');
    if (error) throw error;
    return data;
}

function lineMarkup(products, selectedId = '', quantity = 1) {
    const options = products.map((product) =>
        `<option value="${product.id}" ${product.id === selectedId ? 'selected' : ''}>${escapeHtml(product.name)} — ${money(product.price)} / ${escapeHtml(product.unit)} (${Number(product.stock_quantity).toFixed(3)} available)</option>`
    ).join('');
    const row = document.createElement('div');
    row.className = 'line-item';
    row.innerHTML = `<div class="field"><label>Product</label><select class="line-product" required>${options}</select></div>
        <div class="field"><label>Quantity</label><input class="line-quantity" type="number" min="0.001" step="0.001" value="${Number(quantity)}" required></div>
        <button class="button button-outline button-small remove-line" type="button">Remove</button>`;
    return row;
}

async function setupSaleForm() {
    const form = document.getElementById('sale-form');
    const products = await loadProducts();
    const saleId = new URLSearchParams(location.search).get('id');
    let editingSale = null;
    if (saleId) {
        const { data, error } = await supabase.from('sales')
            .select('*, sale_items(*)').eq('id', saleId).single();
        if (error) throw error;
        editingSale = data;
        form.elements.customer_name.value = data.customer_name || '';
        form.elements.remarks.value = data.remarks || '';
        form.elements.discount_percent.value = data.discount_percent;
        form.elements.vat_rate_percent.value = data.vat_rate_percent;
        form.elements.payment_method.value = data.payment_method;
        form.elements.amount_paid.value = data.amount_paid;
    }

    const lines = document.getElementById('sale-lines');
    const addLine = () => {
        if (!products.length) {
            message('global-message', 'No active products with stock are available for sale.', 'warning');
            return;
        }
        const row = lineMarkup(products);
        lines.append(row);
        row.querySelector('.remove-line').addEventListener('click', () => { row.remove(); refreshTotals(); });
        row.addEventListener('input', refreshTotals);
        row.addEventListener('change', refreshTotals);
        refreshTotals();
    };
    if (editingSale) {
        editingSale.sale_items.forEach((item) => {
            if (products.some((product) => product.id === item.product_id)) {
                const row = lineMarkup(products, item.product_id, item.quantity);
                lines.append(row);
                row.querySelector('.remove-line').addEventListener('click', () => { row.remove(); refreshTotals(); });
                row.addEventListener('input', refreshTotals);
                row.addEventListener('change', refreshTotals);
            }
        });
    }
    if (!lines.children.length) addLine();
    document.getElementById('add-line').addEventListener('click', addLine);
    form.addEventListener('input', refreshTotals);

    function refreshTotals() {
        let subtotal = 0;
        lines.querySelectorAll('.line-item').forEach((row) => {
            const product = products.find((item) => item.id === row.querySelector('.line-product').value);
            const quantity = Number(row.querySelector('.line-quantity').value || 0);
            if (product && quantity > 0) subtotal += Math.round(Number(product.price) * quantity * 100) / 100;
        });
        const calc = totals(subtotal, Number(form.elements.discount_percent.value || 0) / 100, Number(form.elements.vat_rate_percent.value || 0) / 100);
        document.getElementById('sale-totals').innerHTML = `
            <div class="summary-row"><span>Subtotal</span><strong>${money(calc.subtotal)}</strong></div>
            <div class="summary-row"><span>Discount</span><strong>${money(calc.discount)}</strong></div>
            <div class="summary-row"><span>VAT</span><strong>${money(calc.vat)}</strong></div>
            <div class="summary-row"><span>Total</span><strong>${money(calc.total)}</strong></div>`;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const items = [...lines.querySelectorAll('.line-item')].map((row) => ({
            product_id: row.querySelector('.line-product').value,
            quantity: Number(row.querySelector('.line-quantity').value)
        })).filter((item) => item.product_id && item.quantity > 0);
        if (!items.length) {
            message('global-message', 'Add at least one product with a positive quantity.', 'error');
            return;
        }
        const productIds = items.map((item) => item.product_id);
        if (new Set(productIds).size !== productIds.length) {
            message('global-message', 'Choose each product only once per sale.', 'error');
            return;
        }
        setDraft({
            saleId,
            items,
            customerName: form.elements.customer_name.value.trim() || null,
            remarks: form.elements.remarks.value.trim() || null,
            discountPercent: Number(form.elements.discount_percent.value || 0),
            vatRatePercent: Number(form.elements.vat_rate_percent.value || 0),
            paymentMethod: form.elements.payment_method.value,
            amountPaid: Number(form.elements.amount_paid.value || 0)
        });
        location.href = 'sales-review.html';
    });
}

async function showReview() {
    const draft = getDraft();
    const target = document.getElementById('review-content');
    if (!draft || !Array.isArray(draft.items) || !draft.items.length) {
        message('review-message', 'Sale draft is missing. Return to the POS and enter the sale again.', 'error');
        return;
    }
    const ids = draft.items.map((item) => item.product_id);
    const { data: products, error } = await supabase.from('products')
        .select('id,name,meat_type,price,unit,stock_quantity')
        .in('id', ids);
    if (error) throw error;
    const itemRows = draft.items.map((item) => {
        const product = products.find((row) => row.id === item.product_id);
        if (!product) throw new Error('A product in this draft is no longer available.');
        return { ...item, product, subtotal: Math.round(product.price * item.quantity * 100) / 100 };
    });
    const subtotal = itemRows.reduce((sum, item) => sum + item.subtotal, 0);
    const calc = totals(subtotal, draft.discountPercent / 100, draft.vatRatePercent / 100);
    const change = Number(draft.amountPaid) - calc.total;
    target.innerHTML = `<div id="review-message" class="notice" hidden></div>
        <p><strong>Customer:</strong> ${escapeHtml(draft.customerName || 'Walk-in')}</p>
        <p><strong>Payment:</strong> ${escapeHtml(draft.paymentMethod)}</p>
        <div class="table-wrap"><table><thead><tr><th>Product</th><th>Quantity</th><th>Price</th><th>Line total</th></tr></thead><tbody>
            ${itemRows.map((item) => `<tr><td>${escapeHtml(item.product.name)}</td><td>${item.quantity} ${escapeHtml(item.product.unit)}</td><td>${money(item.product.price)}</td><td>${money(item.subtotal)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="summary-list" style="margin-top:16px">
            <div class="summary-row"><span>Subtotal</span><strong>${money(calc.subtotal)}</strong></div>
            <div class="summary-row"><span>Discount (${draft.discountPercent}%)</span><strong>${money(calc.discount)}</strong></div>
            <div class="summary-row"><span>VAT (${draft.vatRatePercent}%)</span><strong>${money(calc.vat)}</strong></div>
            <div class="summary-row"><strong>Total</strong><strong>${money(calc.total)}</strong></div>
            <div class="summary-row"><span>Amount paid</span><strong>${money(draft.amountPaid)}</strong></div>
            <div class="summary-row"><span>Change</span><strong>${money(change)}</strong></div>
        </div>
        <div class="actions no-print" style="margin-top:20px">
            <a class="button button-outline" href="sales.html${draft.saleId ? `?id=${encodeURIComponent(draft.saleId)}` : ''}">Make changes</a>
            <button class="button" id="confirm-sale" type="button">Confirm and save</button>
        </div>`;
    document.getElementById('confirm-sale').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        const { data: saleId, error: saveError } = await supabase.rpc('record_sale', {
            p_items: draft.items,
            p_customer_name: draft.customerName,
            p_discount_percent: draft.discountPercent,
            p_vat_rate_percent: draft.vatRatePercent,
            p_payment_method: draft.paymentMethod,
            p_amount_paid: draft.amountPaid,
            p_remarks: draft.remarks,
            p_sale_id: draft.saleId || null
        });
        if (saveError) {
            button.disabled = false;
            message('review-message', saveError.message, 'error');
            return;
        }
        sessionStorage.removeItem(draftKey);
        location.replace(`receipt.html?id=${encodeURIComponent(saleId)}`);
    });
}

async function init() {
    const profile = await requireAuth();
    if (!profile || !supabase) return;
    if (page === 'sales.html') await setupSaleForm();
    if (page === 'sales-review.html') await showReview();
}

init().catch((error) => message('global-message', error.message || 'Sales page could not be loaded.', 'error'));
