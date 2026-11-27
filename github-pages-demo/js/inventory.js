import { supabase } from './supabase.js';
import { clearMessage, escapeHtml, message, requireAuth, money } from './auth.js';

const page = location.pathname.split('/').pop();
const imageBucket = 'products';

async function loadInventory() {
    const body = document.getElementById('inventory-rows');
    const filters = document.getElementById('inventory-filters');
    const params = new URLSearchParams(location.search);
    if (filters) {
        filters.elements.q.value = params.get('q') || '';
        filters.elements.status.value = params.get('status') || 'Active';
        filters.elements.filter.value = params.get('filter') || '';
        if (!filters.dataset.bound) {
            filters.dataset.bound = 'true';
            filters.addEventListener('submit', (event) => {
                event.preventDefault();
                const query = new URLSearchParams(new FormData(filters));
                location.search = query.toString();
            });
        }
    }

    let query = supabase.from('products')
        .select('*, category:product_categories(name)')
        .order('name');
    const status = filters?.elements.status.value || 'Active';
    const search = (filters?.elements.q.value || '').trim();
    const stateFilter = filters?.elements.filter.value || '';
    if (status !== 'all') query = query.eq('status', status);
    if (search) query = query.or(`name.ilike.%${search}%,meat_type.ilike.%${search}%,barcode.ilike.%${search}%`);
    const { data: products, error } = await query;
    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nearLimit = new Date(today);
    nearLimit.setDate(nearLimit.getDate() + 3);
    const visible = products.filter((product) => {
        if (stateFilter === 'low') return product.stock_quantity > 0 && product.stock_quantity <= product.min_stock_level;
        if (stateFilter === 'out') return product.stock_quantity <= 0;
        if (stateFilter === 'near') {
            const expiry = product.expiration_date ? new Date(`${product.expiration_date}T00:00:00`) : null;
            return expiry && expiry >= today && expiry <= nearLimit;
        }
        if (stateFilter === 'expired') return product.expiration_date && new Date(`${product.expiration_date}T00:00:00`) < today;
        return true;
    });

    const profile = window.currentProfile;
    const addProduct = document.getElementById('add-product-link');
    if (addProduct && profile.role !== 'admin') addProduct.hidden = true;
    if (!visible.length) {
        body.innerHTML = '<tr><td class="empty" colspan="7">No products match these filters.</td></tr>';
        return;
    }
    const imagePaths = visible.filter((p) => p.image_path && !p.image_path.startsWith('assets/'));
    const signed = await Promise.all(imagePaths.map(async (product) => {
        const { data, error: signedError } = await supabase.storage.from(imageBucket).createSignedUrl(product.image_path, 900);
        if (signedError) throw signedError;
        return [product.id, data.signedUrl];
    }));
    const images = new Map(signed);

    body.innerHTML = visible.map((product) => {
        const image = images.get(product.id);
        const stockClass = product.stock_quantity <= 0 ? 'badge-danger'
            : product.stock_quantity <= product.min_stock_level ? 'badge-warning' : 'badge-success';
        const expiryClass = product.expiration_date && product.expiration_date < today.toISOString().slice(0, 10)
            ? 'badge-danger' : '';
        const edit = profile.role === 'admin'
            ? `<a class="button button-outline button-small" href="inventory-form.html?id=${encodeURIComponent(product.id)}">Edit</a>`
            : '';
        const adminActions = profile.role === 'admin'
            ? `<button class="button button-outline button-small" data-product-action="${product.status === 'Archived' ? 'restore' : 'archive'}" data-id="${product.id}">${product.status === 'Archived' ? 'Restore' : 'Archive'}</button>
               <button class="button button-danger button-small" data-product-action="delete" data-id="${product.id}">Delete</button>`
            : '';
        const stockAction = ['Active', 'Inactive'].includes(product.status)
            ? `<a class="button button-outline button-small" href="stock.html?id=${encodeURIComponent(product.id)}">Add stock</a>`
            : '';
        return `<tr>
            <td>${image ? `<img src="${image}" alt="" width="42" height="42" loading="lazy"> ` : ''}${escapeHtml(product.name)}<div class="muted">${escapeHtml(product.meat_type || '')}</div></td>
            <td>${escapeHtml(product.category?.name || 'Uncategorized')}</td>
            <td>${money(product.price)} / ${escapeHtml(product.unit)}</td>
            <td><span class="badge ${stockClass}">${Number(product.stock_quantity).toFixed(3)} ${escapeHtml(product.unit)}</span></td>
            <td><span class="badge ${expiryClass}">${escapeHtml(product.expiration_date || '—')}</span></td>
            <td>${escapeHtml(product.status)}</td>
            <td><div class="actions">${stockAction}${edit}${adminActions}</div></td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-product-action]').forEach((button) => {
        button.addEventListener('click', async () => {
            const id = button.dataset.id;
            const action = button.dataset.productAction;
            if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} this product?`)) return;
            const updates = action === 'delete'
                ? { status: 'Deleted', deleted_at: new Date().toISOString() }
                : action === 'archive'
                    ? { status: 'Archived', archived_at: new Date().toISOString() }
                    : { status: 'Active', archived_at: null, deleted_at: null };
            const { error: updateError } = await supabase.from('products').update(updates).eq('id', id);
            if (updateError) {
                message('global-message', updateError.message, 'error');
                return;
            }
            await loadInventory();
        });
    });
}

async function loadProductForm() {
    const form = document.getElementById('product-form');
    const id = new URLSearchParams(location.search).get('id');
    const title = document.getElementById('product-form-title');
    const categorySelect = form.elements.category_id;
    const { data: categories, error: categoryError } = await supabase
        .from('product_categories').select('id,name').eq('status', 'Active').order('name');
    if (categoryError) throw categoryError;
    categorySelect.insertAdjacentHTML('beforeend', categories.map((category) =>
        `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join(''));

    let product = null;
    if (id) {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (error) throw error;
        product = data;
        title.textContent = 'Edit product';
        for (const [key, value] of Object.entries(product)) {
            if (form.elements[key] && key !== 'image_path') form.elements[key].value = value ?? '';
        }
        form.elements.stock_quantity.disabled = true;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessage('form-message');
        const data = Object.fromEntries(new FormData(form).entries());
        const imageFile = form.elements.image.files[0];
        const values = {
            category_id: data.category_id || null,
            name: data.name.trim(),
            meat_type: data.meat_type.trim() || null,
            description: data.description.trim() || null,
            price: Number(data.price),
            unit: data.unit,
            min_stock_level: Number(data.min_stock_level),
            expiration_date: data.expiration_date || null,
            barcode: data.barcode.trim() || null,
            supplier: data.supplier.trim() || null,
            status: data.status,
            updated_by: window.currentProfile.id
        };
        if (imageFile && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(imageFile.type)) {
            message('form-message', 'Choose a JPEG, PNG, WebP or GIF image.', 'error');
            return;
        }
        if (!values.name || values.price < 0 || values.min_stock_level < 0) {
            message('form-message', 'Enter a product name and non-negative price/minimum stock.', 'error');
            return;
        }
        if (!product) values.created_by = window.currentProfile.id;

        let saved;
        if (product) {
            const { data: updated, error } = await supabase.from('products').update(values).eq('id', id).select('id').single();
            if (error) {
                message('form-message', error.message, 'error');
                return;
            }
            saved = updated;
        } else {
            const { data: inserted, error } = await supabase.from('products').insert(values).select('id').single();
            if (error) {
                message('form-message', error.message, 'error');
                return;
            }
            saved = inserted;
        }

        if (imageFile) {
            const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `${saved.id}/${Date.now()}_${safeName}`;
            const { error: uploadError } = await supabase.storage.from(imageBucket).upload(path, imageFile, { upsert: false });
            if (uploadError) {
                message('form-message', `Product saved, but image upload failed: ${uploadError.message}`, 'error');
                return;
            }
            const { error: pathError } = await supabase.from('products').update({ image_path: path }).eq('id', saved.id);
            if (pathError) {
                message('form-message', `Image uploaded, but product image path failed to save: ${pathError.message}`, 'error');
                return;
            }
        }

        if (!product && Number(data.stock_quantity) > 0) {
            const { error: stockError } = await supabase.rpc('add_stock', {
                p_product_id: saved.id,
                p_quantity: Number(data.stock_quantity),
                p_remarks: 'Initial stock'
            });
            if (stockError) {
                message('form-message', `Product saved, but initial stock was not added: ${stockError.message}`, 'error');
                return;
            }
        }
        location.replace('inventory.html');
    });
}

async function loadStockForm() {
    const form = document.getElementById('stock-form');
    const select = form.elements.product_id;
    const { data: products, error } = await supabase.from('products')
        .select('id,name,unit,stock_quantity,status')
        .in('status', ['Active', 'Inactive'])
        .order('name');
    if (error) throw error;
    select.innerHTML = products.map((p) =>
        `<option value="${p.id}">${escapeHtml(p.name)} — ${Number(p.stock_quantity).toFixed(3)} ${escapeHtml(p.unit)}</option>`).join('');
    const productId = new URLSearchParams(location.search).get('id');
    if (productId) select.value = productId;
    const selected = products.find((p) => p.id === select.value);
    document.getElementById('stock-product-summary').textContent = selected
        ? `${selected.name} · current ${Number(selected.stock_quantity).toFixed(3)} ${selected.unit}`
        : '';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessage('stock-message');
        const { error: stockError } = await supabase.rpc('add_stock', {
            p_product_id: select.value,
            p_quantity: Number(form.elements.quantity.value),
            p_remarks: form.elements.remarks.value.trim() || 'Manual stock in'
        });
        if (stockError) {
            message('stock-message', stockError.message, 'error');
            return;
        }
        location.replace('inventory.html');
    });
}

async function init() {
    const profile = await requireAuth({ adminOnly: page === 'inventory-form.html' });
    if (!profile || !supabase) return;
    if (page === 'inventory.html') await loadInventory();
    if (page === 'inventory-form.html') await loadProductForm();
    if (page === 'stock.html') await loadStockForm();
}

init().catch((error) => message('global-message', error.message || 'Inventory could not be loaded.', 'error'));
