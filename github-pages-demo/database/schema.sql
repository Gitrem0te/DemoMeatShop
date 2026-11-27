-- Supabase schema for the internal Come N' Meatshop inventory/POS application.
-- Run once in the Supabase SQL Editor. Auth passwords remain in auth.users.

create sequence if not exists public.receipt_number_seq;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    email text not null unique,
    full_name text not null default '',
    phone text,
    avatar_path text,
    role text not null default 'staff' check (role in ('admin', 'staff')),
    language_preference text not null default 'en' check (language_preference in ('en', 'fil')),
    status text not null default 'Active' check (status in ('Active', 'Inactive', 'Archived', 'Deleted')),
    is_owner boolean not null default false,
    last_login_at timestamptz,
    created_by uuid references public.profiles(id) on delete set null,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    deleted_at timestamptz
);

create table if not exists public.product_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    status text not null default 'Active' check (status in ('Active', 'Inactive', 'Archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid references public.product_categories(id) on delete set null,
    name text not null,
    meat_type text,
    description text,
    price numeric(12,2) not null default 0 check (price >= 0),
    unit text not null default 'kg',
    stock_quantity numeric(12,3) not null default 0 check (stock_quantity >= 0),
    min_stock_level numeric(12,3) not null default 10 check (min_stock_level >= 0),
    expiration_date date,
    image_path text,
    barcode text unique,
    supplier text,
    status text not null default 'Active' check (status in ('Active', 'Inactive', 'Archived', 'Deleted')),
    created_by uuid references public.profiles(id) on delete set null,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    deleted_at timestamptz
);

create table if not exists public.stock_movements (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products(id) on delete restrict,
    movement_type text not null check (movement_type in ('stock_in', 'stock_out', 'sale_deduction', 'sale_restore', 'adjustment', 'void_restore', 'edit_adjustment', 'initial')),
    quantity_change numeric(12,3) not null,
    quantity_before numeric(12,3),
    quantity_after numeric(12,3),
    reference_type text,
    reference_id uuid,
    remarks text,
    performed_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.sales (
    id uuid primary key default gen_random_uuid(),
    receipt_number text not null unique,
    sale_datetime timestamptz not null default now(),
    cashier_user_id uuid not null references public.profiles(id) on delete restrict,
    customer_name text,
    subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
    discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
    discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
    vat_rate_percent numeric(5,2) not null default 12 check (vat_rate_percent between 0 and 100),
    vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
    total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
    payment_method text not null check (payment_method in ('Cash', 'GCash')),
    amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
    change_due numeric(12,2) not null default 0 check (change_due >= 0),
    status text not null default 'Completed' check (status in ('Completed', 'Edited', 'Voided', 'Deleted')),
    review_confirmed_at timestamptz,
    remarks text,
    void_reason text,
    created_by uuid references public.profiles(id) on delete set null,
    updated_by uuid references public.profiles(id) on delete set null,
    voided_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    voided_at timestamptz
);

create table if not exists public.sale_items (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null references public.sales(id) on delete cascade,
    product_id uuid references public.products(id) on delete set null,
    product_name_snapshot text not null,
    meat_type_snapshot text,
    unit_snapshot text not null,
    unit_price numeric(12,2) not null check (unit_price >= 0),
    quantity numeric(12,3) not null check (quantity > 0),
    line_subtotal numeric(12,2) not null check (line_subtotal >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null unique references public.sales(id) on delete cascade,
    payment_method text not null check (payment_method in ('Cash', 'GCash')),
    amount_tendered numeric(12,2) not null default 0 check (amount_tendered >= 0),
    change_amount numeric(12,2) not null default 0 check (change_amount >= 0),
    reference_number text,
    payment_status text not null default 'Paid' check (payment_status in ('Pending', 'Paid', 'Failed', 'Refunded', 'Voided')),
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    notification_type text not null,
    title text not null,
    message text not null,
    severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'danger')),
    module text,
    related_entity_type text,
    related_entity_id text,
    target_role text check (target_role in ('Admin', 'Staff', 'All')),
    action_url text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
    id uuid primary key default gen_random_uuid(),
    notification_id uuid not null references public.notifications(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    is_read boolean not null default false,
    read_at timestamptz,
    is_cleared boolean not null default false,
    cleared_at timestamptz,
    opened_at timestamptz,
    created_at timestamptz not null default now(),
    unique (notification_id, user_id)
);

create table if not exists public.settings (
    id uuid primary key default gen_random_uuid(),
    setting_group text not null default 'general',
    setting_key text not null unique,
    setting_value text,
    value_type text not null default 'string' check (value_type in ('string', 'number', 'boolean', 'json')),
    description text,
    is_editable boolean not null default true,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    event_type text not null,
    module text not null,
    entity_type text,
    entity_id text,
    description text not null,
    old_values_json jsonb,
    new_values_json jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz not null default now()
);

create index if not exists idx_products_category_status on public.products(category_id, status);
create index if not exists idx_products_expiration on public.products(expiration_date);
create index if not exists idx_stock_movements_product_created on public.stock_movements(product_id, created_at desc);
create index if not exists idx_sales_cashier_datetime on public.sales(cashier_user_id, sale_datetime desc);
create index if not exists idx_sales_status_datetime on public.sales(status, sale_datetime desc);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_notifications_type_created on public.notifications(notification_type, created_at desc);
create index if not exists idx_user_notifications_user_state on public.user_notifications(user_id, is_cleared, is_read, created_at desc);

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_username text;
begin
    if tg_op = 'INSERT' then
        v_username := left(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, 'user'), '@', 1)), 40)
            || '-' || left(new.id::text, 6);
        insert into public.profiles (id, username, email, full_name)
        values (new.id, v_username, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
        on conflict (id) do update set email = excluded.email;
        return new;
    end if;

    update public.profiles
    set email = coalesce(new.email, email),
        last_login_at = coalesce(new.last_sign_in_at, last_login_at),
        updated_at = now()
    where id = new.id;
    return new;
end;
$$;

drop trigger if exists on_auth_user_changed on auth.users;
create trigger on_auth_user_changed
after insert or update of email, last_sign_in_at on auth.users
for each row execute function public.handle_auth_user_change();

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
    select p.role from public.profiles p where p.id = auth.uid() and p.status = 'Active'
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.status = 'Active'
    )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    select coalesce(public.current_profile_role() = 'admin', false)
$$;

create or replace function public.log_activity(
    p_event_type text,
    p_module text,
    p_description text,
    p_entity_type text default null,
    p_entity_id text default null,
    p_old_values jsonb default null,
    p_new_values jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.is_active_user() then
        raise exception 'An active authenticated user is required.';
    end if;
    insert into public.activity_logs (user_id, event_type, module, description, entity_type, entity_id, old_values_json, new_values_json)
    values (auth.uid(), p_event_type, p_module, p_description, p_entity_type, p_entity_id, p_old_values, p_new_values);
end;
$$;

create or replace function public.emit_notification(
    p_type text,
    p_title text,
    p_message text,
    p_severity text,
    p_target_role text,
    p_module text,
    p_entity_type text,
    p_entity_id text,
    p_action_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_notification_id uuid;
begin
    insert into public.notifications (
        notification_type, title, message, severity, target_role, module,
        related_entity_type, related_entity_id, action_url, created_by
    ) values (
        p_type, p_title, p_message, p_severity, p_target_role, p_module,
        p_entity_type, p_entity_id, p_action_url, auth.uid()
    ) returning id into v_notification_id;

    insert into public.user_notifications (notification_id, user_id)
    select v_notification_id, p.id
    from public.profiles p
    where p.status = 'Active'
      and (p_target_role = 'All' or p.role = lower(p_target_role));
    return v_notification_id;
end;
$$;

create or replace function public.add_stock(
    p_product_id uuid,
    p_quantity numeric,
    p_remarks text default 'Manual stock in'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_product public.products%rowtype;
    v_after numeric(12,3);
begin
    if not public.is_active_user() then raise exception 'Sign in with an active account.'; end if;
    if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;

    select * into v_product from public.products where id = p_product_id for update;
    if not found or v_product.status not in ('Active', 'Inactive') then raise exception 'Product not found or unavailable.'; end if;
    v_after := v_product.stock_quantity + p_quantity;

    update public.products
    set stock_quantity = v_after, updated_by = auth.uid(), updated_at = now()
    where id = p_product_id;
    insert into public.stock_movements (
        product_id, movement_type, quantity_change, quantity_before, quantity_after,
        reference_type, remarks, performed_by
    ) values (p_product_id, 'stock_in', p_quantity, v_product.stock_quantity, v_after, 'manual', p_remarks, auth.uid());
    perform public.log_activity('stock_in', 'inventory', 'Added stock to ' || v_product.name, 'product', p_product_id::text,
        jsonb_build_object('stock_quantity', v_product.stock_quantity), jsonb_build_object('stock_quantity', v_after));
    return jsonb_build_object('product_id', p_product_id, 'stock_quantity', v_after);
end;
$$;

create or replace function public.record_sale(
    p_items jsonb,
    p_customer_name text default null,
    p_discount_percent numeric default 0,
    p_vat_rate_percent numeric default 12,
    p_payment_method text default 'Cash',
    p_amount_paid numeric default 0,
    p_remarks text default null,
    p_sale_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_item jsonb;
    v_line jsonb;
    v_lines jsonb := '[]'::jsonb;
    v_product public.products%rowtype;
    v_existing public.sales%rowtype;
    v_old_item public.sale_items%rowtype;
    v_product_id uuid;
    v_quantity numeric(12,3);
    v_line_subtotal numeric(12,2);
    v_subtotal numeric(12,2) := 0;
    v_discount_amount numeric(12,2);
    v_after_discount numeric(12,2);
    v_vat_amount numeric(12,2);
    v_total numeric(12,2);
    v_amount_paid numeric(12,2);
    v_before numeric(12,3);
    v_after numeric(12,3);
    v_sale_id uuid;
    v_receipt_number text;
begin
    if not public.is_active_user() then raise exception 'Sign in with an active account.'; end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one product.'; end if;
    if p_discount_percent is null or p_discount_percent < 0 or p_discount_percent > 100 then raise exception 'Discount must be between 0 and 100 percent.'; end if;
    if p_vat_rate_percent is null or p_vat_rate_percent < 0 or p_vat_rate_percent > 100 then raise exception 'VAT rate must be between 0 and 100 percent.'; end if;
    if p_payment_method is null or p_payment_method not in ('Cash', 'GCash') then raise exception 'Choose a supported payment method.'; end if;
    if p_amount_paid is null or p_amount_paid < 0 then raise exception 'Amount paid cannot be negative.'; end if;

    if p_sale_id is not null then
        select * into v_existing from public.sales where id = p_sale_id for update;
        if not found or v_existing.status not in ('Completed', 'Edited') then raise exception 'Sale cannot be edited.'; end if;
        if v_existing.cashier_user_id <> auth.uid() and not public.is_admin() then raise exception 'You cannot edit this sale.'; end if;

        for v_old_item in select * from public.sale_items where sale_id = p_sale_id loop
            if v_old_item.product_id is not null then
                update public.products
                set stock_quantity = stock_quantity + v_old_item.quantity, updated_at = now()
                where id = v_old_item.product_id
                returning stock_quantity - v_old_item.quantity, stock_quantity into v_before, v_after;
                insert into public.stock_movements (
                    product_id, movement_type, quantity_change, quantity_before, quantity_after,
                    reference_type, reference_id, remarks, performed_by
                ) values (v_old_item.product_id, 'sale_restore', v_old_item.quantity, v_before, v_after,
                    'sale', p_sale_id, 'Restore before sale edit', auth.uid());
            end if;
        end loop;
        delete from public.sale_items where sale_id = p_sale_id;
        delete from public.payments where sale_id = p_sale_id;
        v_sale_id := p_sale_id;
    end if;

    for v_item in select value from jsonb_array_elements(p_items) loop
        v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
        v_quantity := nullif(v_item ->> 'quantity', '')::numeric;
        if v_product_id is null or v_quantity is null or v_quantity <= 0 then raise exception 'Each sale line needs a product and positive quantity.'; end if;
        if exists (select 1 from jsonb_array_elements(v_lines) x where x ->> 'product_id' = v_product_id::text) then
            raise exception 'Each product may appear only once in a sale.';
        end if;

        select * into v_product from public.products where id = v_product_id and status = 'Active' for update;
        if not found then raise exception 'A selected product is no longer available.'; end if;
        if v_product.stock_quantity < v_quantity then raise exception 'Insufficient stock for %.', v_product.name; end if;

        v_line_subtotal := round(v_product.price * v_quantity, 2);
        v_subtotal := v_subtotal + v_line_subtotal;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
            'product_id', v_product.id,
            'product_name_snapshot', v_product.name,
            'meat_type_snapshot', v_product.meat_type,
            'unit_snapshot', v_product.unit,
            'unit_price', v_product.price,
            'quantity', v_quantity,
            'line_subtotal', v_line_subtotal
        ));
    end loop;

    v_subtotal := round(v_subtotal, 2);
    v_discount_amount := round(v_subtotal * p_discount_percent / 100, 2);
    v_after_discount := greatest(0, v_subtotal - v_discount_amount);
    v_vat_amount := round(v_after_discount * p_vat_rate_percent / 100, 2);
    v_total := round(v_after_discount + v_vat_amount, 2);
    v_amount_paid := round(p_amount_paid, 2);
    if v_amount_paid + 0.001 < v_total then raise exception 'Amount paid is less than total.'; end if;

    if p_sale_id is null then
        v_receipt_number := 'CNM-' || to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD') || '-' ||
            lpad(nextval('public.receipt_number_seq')::text, 6, '0');
        insert into public.sales (
            receipt_number, cashier_user_id, customer_name, subtotal, discount_percent, discount_amount,
            vat_rate_percent, vat_amount, total_amount, payment_method, amount_paid, change_due,
            status, review_confirmed_at, remarks, created_by, updated_by
        ) values (
            v_receipt_number, auth.uid(), nullif(trim(p_customer_name), ''), v_subtotal, p_discount_percent,
            v_discount_amount, p_vat_rate_percent, v_vat_amount, v_total, p_payment_method, v_amount_paid,
            round(v_amount_paid - v_total, 2), 'Completed', now(), nullif(trim(p_remarks), ''), auth.uid(), auth.uid()
        ) returning id into v_sale_id;
    else
        update public.sales set
            customer_name = nullif(trim(p_customer_name), ''),
            subtotal = v_subtotal,
            discount_percent = p_discount_percent,
            discount_amount = v_discount_amount,
            vat_rate_percent = p_vat_rate_percent,
            vat_amount = v_vat_amount,
            total_amount = v_total,
            payment_method = p_payment_method,
            amount_paid = v_amount_paid,
            change_due = round(v_amount_paid - v_total, 2),
            status = 'Edited',
            review_confirmed_at = now(),
            remarks = nullif(trim(p_remarks), ''),
            updated_by = auth.uid(),
            updated_at = now()
        where id = p_sale_id;
    end if;

    for v_line in select value from jsonb_array_elements(v_lines) loop
        v_product_id := (v_line ->> 'product_id')::uuid;
        v_quantity := (v_line ->> 'quantity')::numeric;
        select stock_quantity into v_before from public.products where id = v_product_id for update;
        if v_before < v_quantity then raise exception 'Insufficient stock for %.', v_line ->> 'product_name_snapshot'; end if;
        update public.products set stock_quantity = stock_quantity - v_quantity, updated_by = auth.uid(), updated_at = now()
        where id = v_product_id returning stock_quantity into v_after;

        insert into public.sale_items (
            sale_id, product_id, product_name_snapshot, meat_type_snapshot, unit_snapshot,
            unit_price, quantity, line_subtotal
        ) values (
            v_sale_id, v_product_id, v_line ->> 'product_name_snapshot', v_line ->> 'meat_type_snapshot',
            v_line ->> 'unit_snapshot', (v_line ->> 'unit_price')::numeric, v_quantity,
            (v_line ->> 'line_subtotal')::numeric
        );
        insert into public.stock_movements (
            product_id, movement_type, quantity_change, quantity_before, quantity_after,
            reference_type, reference_id, remarks, performed_by
        ) values (
            v_product_id, 'sale_deduction', -v_quantity, v_before, v_after, 'sale', v_sale_id,
            case when p_sale_id is null then 'Sale deduction' else 'Sale edit deduction' end, auth.uid()
        );
    end loop;

    insert into public.payments (sale_id, payment_method, amount_tendered, change_amount, payment_status, paid_at)
    values (v_sale_id, p_payment_method, v_amount_paid, round(v_amount_paid - v_total, 2), 'Paid', now());

    perform public.log_activity(
        case when p_sale_id is null then 'sale_create' else 'sale_edit' end,
        'sales',
        case when p_sale_id is null then 'Recorded sale' else 'Edited sale' end,
        'sale',
        v_sale_id::text,
        null,
        jsonb_build_object('total_amount', v_total, 'status', case when p_sale_id is null then 'Completed' else 'Edited' end)
    );
    perform public.emit_notification(
        case when p_sale_id is null then 'sale_recorded' else 'sale_edited' end,
        case when p_sale_id is null then 'New sale recorded' else 'Sale edited' end,
        'Receipt ' || (select receipt_number from public.sales where id = v_sale_id) || ' was saved.',
        case when p_sale_id is null then 'success' else 'info' end,
        'All',
        'sales',
        'sale',
        v_sale_id::text,
        'receipt.html?id=' || v_sale_id::text
    );
    return v_sale_id;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_mode text default 'void', p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_sale public.sales%rowtype;
    v_item public.sale_items%rowtype;
    v_before numeric(12,3);
    v_after numeric(12,3);
begin
    if not public.is_admin() then raise exception 'Only an admin can void or delete sales.'; end if;
    if p_mode is null or p_mode not in ('void', 'delete') then raise exception 'Invalid sale action.'; end if;
    select * into v_sale from public.sales where id = p_sale_id for update;
    if not found or v_sale.status not in ('Completed', 'Edited') then raise exception 'Sale cannot be voided or deleted.'; end if;

    for v_item in select * from public.sale_items where sale_id = p_sale_id loop
        if v_item.product_id is not null then
            update public.products
            set stock_quantity = stock_quantity + v_item.quantity, updated_at = now()
            where id = v_item.product_id
            returning stock_quantity - v_item.quantity, stock_quantity into v_before, v_after;
            insert into public.stock_movements (
                product_id, movement_type, quantity_change, quantity_before, quantity_after,
                reference_type, reference_id, remarks, performed_by
            ) values (
                v_item.product_id, case when p_mode = 'void' then 'void_restore' else 'sale_restore' end,
                v_item.quantity, v_before, v_after, 'sale', p_sale_id, initcap(p_mode) || ' restore', auth.uid()
            );
        end if;
    end loop;

    update public.sales set
        status = case when p_mode = 'void' then 'Voided' else 'Deleted' end,
        void_reason = nullif(trim(p_reason), ''),
        voided_by = auth.uid(),
        voided_at = now(),
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_sale_id;
    update public.payments set payment_status = 'Voided', updated_at = now() where sale_id = p_sale_id;
    perform public.log_activity('sale_' || p_mode, 'sales', initcap(p_mode) || ' sale', 'sale', p_sale_id::text);
    perform public.emit_notification(
        'sale_' || case when p_mode = 'void' then 'voided' else 'deleted' end,
        'Sale ' || case when p_mode = 'void' then 'voided' else 'deleted' end,
        'Receipt ' || v_sale.receipt_number || ' was ' || p_mode || 'ed.',
        'warning', 'All', 'sales', 'sale', p_sale_id::text, 'sales-history.html'
    );
end;
$$;

create or replace function public.set_notification_state(p_notification_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if not public.is_active_user() then raise exception 'Sign in with an active account.'; end if;
    if p_action is null or p_action not in ('read', 'clear') then raise exception 'Invalid notification action.'; end if;
    update public.user_notifications
    set is_read = case when p_action = 'read' then true else is_read end,
        read_at = case when p_action = 'read' then coalesce(read_at, now()) else read_at end,
        is_cleared = case when p_action = 'clear' then true else is_cleared end,
        cleared_at = case when p_action = 'clear' then coalesce(cleared_at, now()) else cleared_at end,
        opened_at = case when p_action = 'read' then coalesce(opened_at, now()) else opened_at end
    where notification_id = p_notification_id and user_id = auth.uid();
end;
$$;

create or replace function public.generate_inventory_alerts()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_product public.products%rowtype;
    v_type text;
    v_title text;
    v_message text;
    v_severity text;
    v_target text;
    v_near_days integer := 3;
    v_setting text;
begin
    if not public.is_admin() then raise exception 'Only an admin can generate inventory alerts.'; end if;
    select setting_value into v_setting from public.settings where setting_key = 'near_expiry_days';
    if coalesce(v_setting, '') ~ '^[0-9]+$' then v_near_days := v_setting::integer; end if;

    for v_product in select * from public.products where status = 'Active' loop
        v_type := null;
        if v_product.stock_quantity <= 0 then
            v_type := 'out_of_stock'; v_title := 'Out of stock: ' || v_product.name;
            v_message := v_product.name || ' is out of stock.'; v_severity := 'danger'; v_target := 'All';
        elsif v_product.stock_quantity <= v_product.min_stock_level then
            v_type := 'low_stock'; v_title := 'Low stock: ' || v_product.name;
            v_message := v_product.name || ' has only ' || v_product.stock_quantity || ' left.'; v_severity := 'warning'; v_target := 'All';
        elsif v_product.expiration_date < current_date then
            v_type := 'expired_product'; v_title := 'Expired: ' || v_product.name;
            v_message := v_product.name || ' expired on ' || v_product.expiration_date || '.'; v_severity := 'danger'; v_target := 'Admin';
        elsif v_product.expiration_date <= current_date + v_near_days then
            v_type := 'near_expiry'; v_title := 'Near expiry: ' || v_product.name;
            v_message := v_product.name || ' expires on ' || v_product.expiration_date || '.'; v_severity := 'warning'; v_target := 'All';
        end if;

        if v_type is not null and not exists (
            select 1 from public.notifications n
            where n.notification_type = v_type
              and n.related_entity_type = 'product'
              and n.related_entity_id = v_product.id::text
              and n.created_at > now() - interval '24 hours'
        ) then
            perform public.emit_notification(v_type, v_title, v_message, v_severity, v_target,
                'inventory', 'product', v_product.id::text, 'inventory.html');
        end if;
    end loop;
end;
$$;

create or replace function public.get_dashboard_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
    v_result jsonb;
    v_today date := (now() at time zone 'Asia/Manila')::date;
    v_near_days integer := 3;
    v_setting text;
begin
    if not public.is_active_user() then raise exception 'Sign in with an active account.'; end if;
    select setting_value into v_setting from public.settings where setting_key = 'near_expiry_days';
    if coalesce(v_setting, '') ~ '^[0-9]+$' then v_near_days := v_setting::integer; end if;

    select jsonb_build_object(
        'todayTotal', coalesce((select sum(s.total_amount) from public.sales s where (s.sale_datetime at time zone 'Asia/Manila')::date = v_today and s.status in ('Completed', 'Edited') and (public.is_admin() or s.cashier_user_id = auth.uid())), 0),
        'todayCount', coalesce((select count(*) from public.sales s where (s.sale_datetime at time zone 'Asia/Manila')::date = v_today and s.status in ('Completed', 'Edited') and (public.is_admin() or s.cashier_user_id = auth.uid())), 0),
        'monthTotal', coalesce((select sum(s.total_amount) from public.sales s where date_trunc('month', s.sale_datetime at time zone 'Asia/Manila') = date_trunc('month', v_today::timestamp) and s.status in ('Completed', 'Edited') and (public.is_admin() or s.cashier_user_id = auth.uid())), 0),
        'monthCount', coalesce((select count(*) from public.sales s where date_trunc('month', s.sale_datetime at time zone 'Asia/Manila') = date_trunc('month', v_today::timestamp) and s.status in ('Completed', 'Edited') and (public.is_admin() or s.cashier_user_id = auth.uid())), 0),
        'activeProducts', (select count(*) from public.products p where p.status = 'Active'),
        'outCount', (select count(*) from public.products p where p.status = 'Active' and p.stock_quantity <= 0),
        'lowCount', (select count(*) from public.products p where p.status = 'Active' and p.stock_quantity > 0 and p.stock_quantity <= p.min_stock_level),
        'inventoryValue', coalesce((select sum(p.price * p.stock_quantity) from public.products p where p.status = 'Active'), 0),
        'nearExpiry', (select count(*) from public.products p where p.status = 'Active' and p.expiration_date between v_today and v_today + v_near_days),
        'lowItems', coalesce((select jsonb_agg(to_jsonb(x)) from (
            select p.id, p.name, p.stock_quantity, p.min_stock_level, p.unit
            from public.products p where p.status = 'Active' and p.stock_quantity <= p.min_stock_level
            order by p.stock_quantity asc limit 8
        ) x), '[]'::jsonb),
        'recentSales', coalesce((select jsonb_agg(to_jsonb(x)) from (
            select s.id, s.receipt_number, s.sale_datetime, s.total_amount, s.status, p.full_name as cashier_name
            from public.sales s join public.profiles p on p.id = s.cashier_user_id
            where s.status in ('Completed', 'Edited')
              and (public.is_admin() or s.cashier_user_id = auth.uid())
            order by s.sale_datetime desc limit 8
        ) x), '[]'::jsonb)
    ) into v_result;
    return v_result;
end;
$$;

alter table public.profiles enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.user_notifications enable row level security;
alter table public.settings enable row level security;
alter table public.activity_logs enable row level security;

revoke all on public.profiles, public.product_categories, public.products, public.stock_movements,
    public.sales, public.sale_items, public.payments, public.notifications, public.user_notifications,
    public.settings, public.activity_logs from anon, authenticated;
grant select on public.profiles, public.product_categories, public.products, public.stock_movements,
    public.sales, public.sale_items, public.payments, public.notifications, public.user_notifications,
    public.settings, public.activity_logs to authenticated;
grant update (username, full_name, phone, avatar_path, language_preference, updated_at)
    on public.profiles to authenticated;
grant insert, update, delete on public.product_categories to authenticated;
grant insert (category_id, name, meat_type, description, price, unit, min_stock_level,
    expiration_date, image_path, barcode, supplier, status, created_by, updated_by)
    on public.products to authenticated;
grant update (category_id, name, meat_type, description, price, unit, min_stock_level,
    expiration_date, image_path, barcode, supplier, status, updated_by, updated_at,
    archived_at, deleted_at) on public.products to authenticated;
grant delete on public.products to authenticated;
grant update on public.settings to authenticated;
revoke all on sequence public.receipt_number_seq from anon, authenticated;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (public.is_active_user() and (id = auth.uid() or public.is_admin()));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and public.is_active_user())
with check (id = auth.uid() and public.is_active_user());

drop policy if exists categories_read_active_user on public.product_categories;
create policy categories_read_active_user on public.product_categories for select to authenticated
using (public.is_active_user());
drop policy if exists categories_admin_insert on public.product_categories;
create policy categories_admin_insert on public.product_categories for insert to authenticated with check (public.is_admin());
drop policy if exists categories_admin_update on public.product_categories;
create policy categories_admin_update on public.product_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists categories_admin_delete on public.product_categories;
create policy categories_admin_delete on public.product_categories for delete to authenticated using (public.is_admin());

drop policy if exists products_read_active_user on public.products;
create policy products_read_active_user on public.products for select to authenticated using (public.is_active_user());
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());

drop policy if exists movements_admin_read on public.stock_movements;
create policy movements_admin_read on public.stock_movements for select to authenticated using (public.is_admin());

drop policy if exists sales_read_owner_or_admin on public.sales;
create policy sales_read_owner_or_admin on public.sales for select to authenticated
using (public.is_active_user() and (cashier_user_id = auth.uid() or public.is_admin()));
drop policy if exists sale_items_read_parent_sale on public.sale_items;
create policy sale_items_read_parent_sale on public.sale_items for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id));
drop policy if exists payments_read_parent_sale on public.payments;
create policy payments_read_parent_sale on public.payments for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id));

drop policy if exists notifications_read_assigned on public.notifications;
create policy notifications_read_assigned on public.notifications for select to authenticated
using (public.is_active_user() and exists (
    select 1 from public.user_notifications un
    where un.notification_id = id and un.user_id = auth.uid()
));
drop policy if exists user_notifications_read_own on public.user_notifications;
create policy user_notifications_read_own on public.user_notifications for select to authenticated
using (user_id = auth.uid() and public.is_active_user());

drop policy if exists settings_read_active_user on public.settings;
create policy settings_read_active_user on public.settings for select to authenticated using (public.is_active_user());
drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_update on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists activity_logs_admin_read on public.activity_logs;
create policy activity_logs_admin_read on public.activity_logs for select to authenticated using (public.is_admin());

revoke all on function public.log_activity(text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.current_profile_role() from public, anon, authenticated;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.emit_notification(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.add_stock(uuid, numeric, text) from public, anon;
revoke all on function public.record_sale(jsonb, text, numeric, numeric, text, numeric, text, uuid) from public, anon;
revoke all on function public.void_sale(uuid, text, text) from public, anon;
revoke all on function public.set_notification_state(uuid, text) from public, anon;
revoke all on function public.generate_inventory_alerts() from public, anon;
revoke all on function public.get_dashboard_data() from public, anon;
grant execute on function public.add_stock(uuid, numeric, text) to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.record_sale(jsonb, text, numeric, numeric, text, numeric, text, uuid) to authenticated;
grant execute on function public.void_sale(uuid, text, text) to authenticated;
grant execute on function public.set_notification_state(uuid, text) to authenticated;
grant execute on function public.generate_inventory_alerts() to authenticated;
grant execute on function public.get_dashboard_data() to authenticated;

insert into public.settings (setting_group, setting_key, setting_value, value_type, description)
values
    ('sales', 'default_vat_percent', '12', 'number', 'Default VAT rate percentage'),
    ('inventory', 'near_expiry_days', '3', 'number', 'Days used for near-expiry warnings'),
    ('localization', 'currency_symbol', '₱', 'string', 'Currency display symbol'),
    ('localization', 'default_language', 'en', 'string', 'Default interface language')
on conflict (setting_key) do nothing;

insert into public.product_categories (name, description) values
    ('Beef', 'Fresh and frozen beef cuts'),
    ('Pork', 'Pork cuts and portions'),
    ('Chicken', 'Chicken cuts and whole items'),
    ('Processed Meats', 'Tocino, longganisa, and similar items'),
    ('Offal & Specialty', 'Special cuts and assorted items')
on conflict (name) do nothing;

insert into public.products (
    category_id, name, meat_type, description, price, unit, stock_quantity,
    min_stock_level, expiration_date, image_path, barcode, supplier
)
select c.id, seed.name, seed.meat_type, seed.description, seed.price, seed.unit,
       seed.stock_quantity, seed.min_stock_level, seed.expiration_date,
       null, seed.barcode, seed.supplier
from (values
    ('Beef Brisket (Sample)', 'Beef', 'Placeholder beef brisket cut for demo.', 420.00::numeric, 'kg', 28.500::numeric, 10.000::numeric, current_date + 7, 'DEMO-BEEF-001', 'Sample Supplier A', 'Beef'),
    ('Beef Ribeye Slice (Sample)', 'Beef', 'Placeholder premium beef slices.', 680.00::numeric, 'kg', 6.000::numeric, 10.000::numeric, current_date + 2, 'DEMO-BEEF-002', 'Sample Supplier A', 'Beef'),
    ('Ground Beef (Sample)', 'Beef', 'Placeholder ground beef pack.', 360.00::numeric, 'pack', 0.000::numeric, 10.000::numeric, current_date - 1, 'DEMO-BEEF-003', 'Sample Supplier B', 'Beef'),
    ('Pork Belly Slab (Sample)', 'Pork', 'Placeholder pork belly slab.', 390.00::numeric, 'kg', 34.000::numeric, 10.000::numeric, current_date + 5, 'DEMO-PORK-001', 'Sample Supplier C', 'Pork'),
    ('Pork Chop (Sample)', 'Pork', 'Placeholder pork chop cuts.', 320.00::numeric, 'kg', 8.500::numeric, 10.000::numeric, current_date + 3, 'DEMO-PORK-002', 'Sample Supplier C', 'Pork'),
    ('Whole Chicken (Sample)', 'Chicken', 'Placeholder whole dressed chicken.', 220.00::numeric, 'piece', 25.000::numeric, 10.000::numeric, current_date + 5, 'DEMO-CHKN-001', 'Sample Supplier D', 'Chicken'),
    ('Chicken Breast Fillet (Sample)', 'Chicken', 'Placeholder boneless chicken breast.', 280.00::numeric, 'kg', 12.000::numeric, 10.000::numeric, current_date + 3, 'DEMO-CHKN-002', 'Sample Supplier D', 'Chicken'),
    ('Pork Tocino Pack (Sample)', 'Processed Meat', 'Placeholder sweet cured pork tocino.', 145.00::numeric, 'pack', 40.000::numeric, 10.000::numeric, current_date + 14, 'DEMO-PROC-001', 'Sample Supplier E', 'Processed Meats')
) as seed(name, meat_type, description, price, unit, stock_quantity, min_stock_level, expiration_date, barcode, supplier, category_name)
join public.product_categories c on c.name = seed.category_name
on conflict (barcode) do nothing;

insert into storage.buckets (id, name, public)
values ('products', 'products', false), ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists product_images_read_authenticated on storage.objects;
create policy product_images_read_authenticated on storage.objects for select to authenticated
using (bucket_id = 'products' and public.is_active_user());
drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'products' and public.is_admin());
drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects for update to authenticated
using (bucket_id = 'products' and public.is_admin())
with check (bucket_id = 'products' and public.is_admin());
drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'products' and public.is_admin());

drop policy if exists receipts_read_own_or_admin on storage.objects;
create policy receipts_read_own_or_admin on storage.objects for select to authenticated
using (bucket_id = 'receipts' and public.is_active_user()
    and (name like auth.uid()::text || '/%' or public.is_admin()));
drop policy if exists receipts_insert_own_or_admin on storage.objects;
create policy receipts_insert_own_or_admin on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and public.is_active_user()
    and (name like auth.uid()::text || '/%' or public.is_admin()));
drop policy if exists receipts_update_own_or_admin on storage.objects;
create policy receipts_update_own_or_admin on storage.objects for update to authenticated
using (bucket_id = 'receipts' and public.is_active_user() and (name like auth.uid()::text || '/%' or public.is_admin()))
with check (bucket_id = 'receipts' and public.is_active_user() and (name like auth.uid()::text || '/%' or public.is_admin()));
drop policy if exists receipts_delete_own_or_admin on storage.objects;
create policy receipts_delete_own_or_admin on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and public.is_active_user() and (name like auth.uid()::text || '/%' or public.is_admin()));

revoke all on function public.handle_auth_user_change() from public, anon, authenticated;
