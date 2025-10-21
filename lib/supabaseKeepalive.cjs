// Lightweight Supabase keepalive:
// - pings auth + a tiny SELECT; cheap + safe for free tier
const { createClient } = require('@supabase/supabase-js');

function getSb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function supabaseKeepalive() {
  const sb = getSb();
  // 1) ping auth
  await sb.auth.getSession();
  // 2) smallest possible query; make table name configurable if needed
  // If you don't have a table yet, this will still "warm" the project via auth above.
  // If you DO have a tiny table like 'profiles', uncomment this:
  // await sb.from('profiles').select('id').limit(1);

  return { ok: true, t: Date.now() };
}

module.exports = { supabaseKeepalive };
