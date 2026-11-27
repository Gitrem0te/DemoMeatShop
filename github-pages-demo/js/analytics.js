import { supabase } from './supabase.js';
import { escapeHtml, message, money, requireAuth } from './auth.js';

async function init() {
    const profile = await requireAuth({ adminOnly: true });
    if (!profile || !supabase) return;
    const form = document.getElementById('analytics-filters');
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    form.elements.from.value = first.toISOString().slice(0, 10);
    form.elements.to.value = today.toISOString().slice(0, 10);

    async function render() {
        const start = `${form.elements.from.value}T00:00:00`;
        const end = `${form.elements.to.value}T23:59:59.999`;
        if (start > end) throw new Error('Start date must be on or before end date.');
        const [{ data: sales, error: salesError }, { data: products, error: productsError }] = await Promise.all([
            supabase.from('sales').select('id,sale_datetime,total_amount,status,sale_items(*)')
                .gte('sale_datetime', start).lte('sale_datetime', end).in('status', ['Completed', 'Edited']),
            supabase.from('products').select('id,name,price,stock_quantity,min_stock_level,unit,category:product_categories(name)')
                .eq('status', 'Active')
        ]);
        if (salesError) throw salesError;
        if (productsError) throw productsError;
        const total = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
        const grouped = sales.reduce((result, sale) => {
            const date = new Date(sale.sale_datetime);
            let key = date.toISOString().slice(0, 10);
            if (form.elements.group.value === 'monthly') key = key.slice(0, 7);
            if (form.elements.group.value === 'weekly') {
                date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
                key = date.toISOString().slice(0, 10);
            }
            result[key] ||= { total: 0, count: 0 };
            result[key].total += Number(sale.total_amount);
            result[key].count++;
            return result;
        }, {});
        const periodKeys = Object.keys(grouped).sort();
        const low = products.filter((product) => product.stock_quantity > 0 && product.stock_quantity <= product.min_stock_level);
        const inventoryValue = products.reduce((sum, product) => sum + Number(product.price) * Number(product.stock_quantity), 0);
        document.getElementById('analytics-summary').innerHTML = [
            ['Sales', money(total)], ['Transactions', sales.length], ['Inventory value', money(inventoryValue)], ['Low-stock products', low.length]
        ].map(([label, value]) => `<article class="card col-3"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong></article>`).join('');

        const items = sales.flatMap((sale) => sale.sale_items || []);
        const topProducts = Object.values(items.reduce((map, item) => {
            const key = item.product_name_snapshot;
            map[key] ||= { name: key, quantity: 0, amount: 0 };
            map[key].quantity += Number(item.quantity);
            map[key].amount += Number(item.line_subtotal);
            return map;
        }, {})).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
        document.getElementById('top-products').innerHTML = `<table><thead><tr><th>Product</th><th>Qty sold</th><th>Sales</th></tr></thead><tbody>${topProducts.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity.toFixed(3)}</td><td>${money(item.amount)}</td></tr>`).join('') || '<tr><td colspan="3">No sales in this period.</td></tr>'}</tbody></table>`;

        const categories = Object.values(items.reduce((map, item) => {
            const product = products.find((entry) => entry.id === item.product_id);
            const key = product?.category?.name || 'Uncategorized';
            map[key] ||= { name: key, quantity: 0, amount: 0 };
            map[key].quantity += Number(item.quantity);
            map[key].amount += Number(item.line_subtotal);
            return map;
        }, {})).sort((a, b) => b.amount - a.amount).slice(0, 10);
        document.getElementById('top-categories').innerHTML = `<table><thead><tr><th>Category</th><th>Qty sold</th><th>Sales</th></tr></thead><tbody>${categories.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity.toFixed(3)}</td><td>${money(item.amount)}</td></tr>`).join('') || '<tr><td colspan="3">No sales in this period.</td></tr>'}</tbody></table>`;

        const { default: Chart } = await import('https://esm.sh/chart.js@4.4.1/auto');
        const canvas = document.getElementById('analytics-chart');
        if (canvas._chart) canvas._chart.destroy();
        canvas._chart = new Chart(canvas, {
            type: 'bar',
            data: { labels: periodKeys, datasets: [{ label: 'Sales', data: periodKeys.map((key) => grouped[key].total), backgroundColor: '#d65b18' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        render().catch((error) => message('global-message', error.message, 'error'));
    });
    await render();
}

init().catch((error) => message('global-message', error.message || 'Analytics could not be loaded.', 'error'));
