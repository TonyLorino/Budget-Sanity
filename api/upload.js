import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Validate passphrase
  const uploadSecret = process.env.UPLOAD_SECRET;
  if (!uploadSecret) {
    return res.status(500).json({ ok: false, error: 'Server misconfigured' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');

  // Constant-time comparison to prevent timing attacks
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(uploadSecret);
  if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
    return res.status(403).json({ ok: false, error: 'Invalid passphrase' });
  }

  // Validate body
  const data = req.body;
  if (!data || !data.line_items || !data.totals) {
    return res.status(400).json({ ok: false, error: 'Invalid budget data payload' });
  }

  // Write to Supabase using service role key (bypasses RLS)
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ ok: false, error: 'Server misconfigured: Supabase credentials not set' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase
    .from('budget_snapshots')
    .insert({ data });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ ok: false, error: 'Database write failed. Check server logs.' });
  }

  return res.status(200).json({ ok: true });
}
