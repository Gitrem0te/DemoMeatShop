import { supabase } from './supabase.js';
import { escapeHtml, formatDate, message, money, requireAuth } from './auth.js';

const page = location.pathname.split('/').pop();

function dateBounds(from, to) {
    return { start: `${from}T00:00:00`, end: `${to}T23:59:59.999` };
}

function csvDownload(filename, rows) {
    const csv = rows.map((row) => row.map((value) => {
        let text = String(value ?? '');
        if (/^[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function groupBy(rows, keyFn) {
    return rows.reduce((groups, row) => {
        const key = keyFn(row);
        groups[key] ||= [];
        groups[key].push(row);
        return groups;
    }, {});
}

function periodKey(value, group) {
    const date = new Date(value);
    if (group === 'monthly') return date.toISOString().slice(0, 7);
    if (group === 'weekly') {
        const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
        return day.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
}

async function loadSalesReport() {
    const form = document.getElementById('sales-report-filters');
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    form.elements.from.value = first.toISOString().slice(0, 10);
    form.elements.to.value = today.toISOString().slice(0, 10);

    async function render() {
        const { start, end } = dateBounds(form.elements.from.value, form.elements.to.value);
        if (start > end) throw new Error('Start date must be on or before end date.');
        const { data: sales, error } = await supabase.from('sales')
            .select('*, cashier:profiles!sales_cashier_user_id_fkey(full_name), sale_items(*)')
            .gte('sale_datetime', start)
            .lte('sale_datetime', end)
            .in('status', ['Completed', 'Edited'])
            .order('sale_datetime');
        if (error) throw error;

        const total = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
        const discount = sales.reduce((sum, sale) => sum + Number(sale.discount_amount), 0);
        const vat = sales.reduce((sum, sale) => sum + Number(sale.vat_amount), 0);
        const itemRows = sales.flatMap((sale) => (sale.sale_items || []).map((item) => ({ ...item, cashier: sale.cashier?.full_name || '—' })));
        const byProduct = Object.values(groupBy(itemRows, (item) => `${item.product_name_snapshot}|${item.meat_type_snapshot || ''}`))
            .map((items) => ({
                name: items[0].product_name_snapshot,
                type: items[0].meat_type_snapshot || '',
                quantity: items.reduce((sum, item) => sum + Number(item.quantity), 0),
                amount: items.reduce((sum, item) => sum + Number(item.line_subtotal), 0)
            })).sort((a, b) => b.quantity - a.quantity);
        const byStaff = Object.values(groupBy(sales, (sale) => sale.cashier?.full_name || '—'))
            .map((items) => ({ name: items[0].cashier?.full_name || '—', transactions: items.length, amount: items.reduce((sum, sale) => sum + Number(sale.total_amount), 0) }))
            .sort((a, b) => b.amount - a.amount);
        const grouped = groupBy(sales, (sale) => periodKey(sale.sale_datetime, form.elements.group.value));
        const periods = Object.keys(grouped).sort();
        const trend = periods.map((label) => grouped[label].reduce((sum, sale) => sum + Number(sale.total_amount), 0));

        document.getElementById('sales-report-summary').innerHTML = `
            <article class="card col-3"><span class="stat-label">Transactions</span><strong class="stat-value">${sales.length}</strong></article>
            <article class="card col-3"><span class="stat-label">Total sales</span><strong class="stat-value">${money(total)}</strong></article>
            <article class="card col-3"><span class="stat-label">Discounts</span><strong class="stat-value">${money(discount)}</strong></article>
            <article class="card col-3"><span class="stat-label">VAT</span><strong class="stat-value">${money(vat)}</strong></article>`;
        document.getElementById('report-products').innerHTML = `<table><thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Sales</th></tr></thead><tbody>${byProduct.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.type)}</td><td>${row.quantity.toFixed(3)}</td><td>${money(row.amount)}</td></tr>`).join('') || '<tr><td colspan="4">No sales in this period.</td></tr>'}</tbody></table>`;
        document.getElementById('report-staff').innerHTML = `<table><thead><tr><th>Staff</th><th>Transactions</th><th>Sales</th></tr></thead><tbody>${byStaff.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.transactions}</td><td>${money(row.amount)}</td></tr>`).join('') || '<tr><td colspan="3">No sales in this period.</td></tr>'}</tbody></table>`;

        const { default: Chart } = await import('https://esm.sh/chart.js@4.4.1/auto');
        const canvas = document.getElementById('sales-chart');
        if (canvas._chart) canvas._chart.destroy();
        canvas._chart = new Chart(canvas, {
            type: 'line',
            data: { labels: periods, datasets: [{ label: 'Sales', data: trend, borderColor: '#d65b18', backgroundColor: '#d65b1830', fill: true, tension: .25 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
        document.getElementById('sales-csv').onclick = () => csvDownload('sales-report.csv', [
            ['Receipt', 'Date', 'Cashier', 'Customer', 'Subtotal', 'Discount', 'VAT', 'Total', 'Status'],
            ...sales.map((sale) => [sale.receipt_number, sale.sale_datetime, sale.cashier?.full_name, sale.customer_name, sale.subtotal, sale.discount_amount, sale.vat_amount, sale.total_amount, sale.status])
        ]);
    }
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        render().catch((error) => message('sales-report-message', error.message, 'error'));
    });
    await render();
}

async function loadInventoryReport() {
    const [{ data: products, error: productError }, { data: movements, error: movementError }] = await Promise.all([
        supabase.from('products').select('*, category:product_categories(name)').order('status').order('name'),
        supabase.from('stock_movements')
            .select('*, product:products!stock_movements_product_id_fkey(name), performer:profiles!stock_movements_performed_by_fkey(full_name)')
            .order('created_at', { ascending: false }).limit(200)
    ]);
    if (productError) throw productError;
    if (movementError) throw movementError;

    const today = new Date().toISOString().slice(0, 10);
    const nearDate = new Date();
    nearDate.setDate(nearDate.getDate() + 3);
    const nearLimit = nearDate.toISOString().slice(0, 10);
    const active = products.filter((p) => p.status === 'Active');
    const low = active.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level);
    const out = active.filter((p) => p.stock_quantity <= 0);
    const expired = active.filter((p) => p.expiration_date && p.expiration_date < today);
    const near = active.filter((p) => p.expiration_date && p.expiration_date >= today && p.expiration_date <= nearLimit);
    document.getElementById('inventory-report-summary').innerHTML = [
        ['Products', active.length], ['Low stock', low.length], ['Out of stock', out.length], ['Near expiry', near.length], ['Expired', expired.length]
    ].map(([label, value]) => `<article class="card col-3"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong></article>`).join('');
    document.getElementById('inventory-report-rows').innerHTML = products.map((p) =>
        `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category?.name || 'Uncategorized')}</td><td>${escapeHtml(p.meat_type || '')}</td><td>${money(p.price)}</td><td>${escapeHtml(p.unit)}</td><td>${Number(p.stock_quantity).toFixed(3)}</td><td>${Number(p.min_stock_level).toFixed(3)}</td><td>${escapeHtml(p.expiration_date || '')}</td><td>${escapeHtml(p.status)}</td></tr>`
    ).join('');
    document.getElementById('movement-rows').innerHTML = movements.map((m) =>
        `<tr><td>${escapeHtml(formatDate(m.created_at))}</td><td>${escapeHtml(m.product?.name || '')}</td><td>${escapeHtml(m.movement_type)}</td><td>${Number(m.quantity_change).toFixed(3)}</td><td>${m.quantity_before ?? ''}</td><td>${m.quantity_after ?? ''}</td><td>${escapeHtml(m.remarks || '')}</td><td>${escapeHtml(m.performer?.full_name || '')}</td></tr>`
    ).join('') || '<tr><td class="empty" colspan="8">No stock movements found.</td></tr>';
    document.getElementById('inventory-csv').addEventListener('click', () => csvDownload('inventory-report.csv', [
        ['Name', 'Category', 'Meat Type', 'Price', 'Unit', 'Stock', 'Min Stock', 'Expiration', 'Status'],
        ...products.map((p) => [p.name, p.category?.name, p.meat_type, p.price, p.unit, p.stock_quantity, p.min_stock_level, p.expiration_date, p.status])
    ]));
}

const profile = await requireAuth({ adminOnly: true });
if (profile && supabase) {
    const task = page === 'reports-sales.html' ? loadSalesReport : loadInventoryReport;
    task().catch((error) => message('global-message', error.message || 'Report could not be loaded.', 'error'));
}
