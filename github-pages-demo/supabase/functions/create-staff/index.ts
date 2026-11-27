import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respond(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

    const projectUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!projectUrl || !anonKey || !serviceKey) {
        return respond({ error: 'The staff service is missing its Supabase server configuration.' }, 500);
    }
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Sign in as an admin first.' }, 401);

    const userClient = createClient(projectUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const adminClient = createClient(projectUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: callerData, error: callerError } = await userClient.auth.getUser();
    if (callerError || !callerData.user) return respond({ error: 'Your session is invalid or expired.' }, 401);

    const { data: callerProfile, error: roleError } = await adminClient
        .from('profiles').select('role,status')
        .eq('id', callerData.user.id).maybeSingle();
    if (roleError) return respond({ error: 'Could not verify the caller role.' }, 500);
    if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.status !== 'Active') {
        return respond({ error: 'Admin access is required.' }, 403);
    }

    let requestBody: unknown;
    try {
        requestBody = await request.json();
    } catch {
        return respond({ error: 'Request body must be valid JSON.' }, 400);
    }
    if (!isRecord(requestBody)) return respond({ error: 'Request body must be a JSON object.' }, 400);
    const payload = requestBody;

    const action = payload.action;
    const id = typeof payload.id === 'string' ? payload.id : '';
    const validStatuses = ['Active', 'Inactive', 'Archived', 'Deleted'];

    if (action === 'status') {
        const status = payload.status;
        if (!id || typeof status !== 'string' || !validStatuses.includes(status)) {
            return respond({ error: 'A staff ID and valid status are required.' }, 400);
        }
        const { data: target, error: targetError } = await adminClient
            .from('profiles').select('id,role').eq('id', id).maybeSingle();
        if (targetError) return respond({ error: 'Could not load the staff account.' }, 500);
        if (!target || target.role !== 'staff') return respond({ error: 'Staff account not found.' }, 404);
        const now = new Date().toISOString();
        const { error } = await adminClient.from('profiles').update({
            status,
            archived_at: status === 'Archived' ? now : null,
            deleted_at: status === 'Deleted' ? now : null,
            updated_by: callerData.user.id,
            updated_at: now
        }).eq('id', id);
        if (error) return respond({ error: error.message }, 400);
        return respond({ ok: true });
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const username = typeof payload.username === 'string' ? payload.username.trim() : '';
    const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : '';
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : null;
    const language = payload.language_preference === 'fil' ? 'fil' : 'en';
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!['create', 'update'].includes(String(action))) return respond({ error: 'Invalid staff action.' }, 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: 'Enter a valid email address.' }, 400);
    if (!username || username.length > 50 || !fullName || fullName.length > 150) {
        return respond({ error: 'Username and full name are required.' }, 400);
    }
    if (action === 'create' && password.length < 6) return respond({ error: 'New staff passwords must be at least six characters.' }, 400);
    if (password && password.length < 6) return respond({ error: 'Passwords must be at least six characters.' }, 400);

    const { data: duplicateEmail, error: emailError } = await adminClient
        .from('profiles').select('id').eq('email', email).maybeSingle();
    if (emailError) return respond({ error: 'Could not validate the email address.' }, 500);
    if (duplicateEmail && duplicateEmail.id !== id) return respond({ error: 'That email is already in use.' }, 409);

    const { data: duplicateUsername, error: usernameError } = await adminClient
        .from('profiles').select('id').eq('username', username).maybeSingle();
    if (usernameError) return respond({ error: 'Could not validate the username.' }, 500);
    if (duplicateUsername && duplicateUsername.id !== id) return respond({ error: 'That username is already in use.' }, 409);

    if (action === 'create') {
        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username, full_name: fullName }
        });
        if (createError || !created.user) return respond({ error: createError?.message || 'Could not create the Auth user.' }, 400);
        const status = typeof payload.status === 'string' && validStatuses.includes(payload.status) ? payload.status : 'Active';
        const now = new Date().toISOString();
        const { error: profileError } = await adminClient.from('profiles').update({
            username,
            email,
            full_name: fullName,
            phone,
            language_preference: language,
            status,
            archived_at: status === 'Archived' ? now : null,
            deleted_at: status === 'Deleted' ? now : null,
            created_by: callerData.user.id,
            updated_by: callerData.user.id,
            updated_at: now
        }).eq('id', created.user.id);
        if (profileError) {
            const { error: rollbackError } = await adminClient.auth.admin.deleteUser(created.user.id);
            if (rollbackError) {
                return respond({ error: `Profile save failed (${profileError.message}) and the Auth account could not be rolled back (${rollbackError.message}). Remove the incomplete account in Supabase Auth.` }, 500);
            }
            return respond({ error: `Auth account was rolled back because its profile could not be saved: ${profileError.message}` }, 500);
        }
        return respond({ ok: true, id: created.user.id });
    }

    if (!id) return respond({ error: 'Staff ID is required for an update.' }, 400);
    const { data: target, error: targetError } = await adminClient
        .from('profiles').select('id,role').eq('id', id).maybeSingle();
    if (targetError) return respond({ error: 'Could not load the staff account.' }, 500);
    if (!target || target.role !== 'staff') return respond({ error: 'Staff account not found.' }, 404);

    const authUpdates: { email: string; email_confirm: boolean; password?: string; user_metadata: Record<string, string> } = {
        email,
        email_confirm: true,
        user_metadata: { username, full_name: fullName }
    };
    if (password) authUpdates.password = password;
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(id, authUpdates);
    if (authUpdateError) return respond({ error: authUpdateError.message }, 400);
    const status = typeof payload.status === 'string' && validStatuses.includes(payload.status) ? payload.status : 'Active';
    const now = new Date().toISOString();
    const { error: profileUpdateError } = await adminClient.from('profiles').update({
        username,
        email,
        full_name: fullName,
        phone,
        language_preference: language,
        status,
        archived_at: status === 'Archived' ? now : null,
        deleted_at: status === 'Deleted' ? now : null,
        updated_by: callerData.user.id,
        updated_at: now
    }).eq('id', id);
    if (profileUpdateError) {
        return respond({ error: `Auth credentials were updated, but the profile update failed: ${profileUpdateError.message}` }, 400);
    }
    return respond({ ok: true });
});
