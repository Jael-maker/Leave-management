import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-only-secret', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 } }));

const leaveSchema = z.object({ leaveType: z.enum(['Annual Leave','Off Days','Study Leave','Exam Leave','Compassionate Leave','Sick Leave','Paternity Leave','Maternity Leave']), startDate: z.string().date(), endDate: z.string().date(), reason: z.string().max(2000).optional().default(''), handover: z.string().max(1000).optional().default('') }).refine(v => v.endDate >= v.startDate, { message: 'End date must be on or after start date' });
const conditionalCaps = { 'Off Days': null, 'Study Leave': 5, 'Exam Leave': 8, 'Compassionate Leave': 7, 'Sick Leave': 90, 'Paternity Leave': 14, 'Maternity Leave': 90 };

function workingDays(start, end) {
  let count = 0;
  const d = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (d <= stop) { if (![0,6].includes(d.getUTCDay())) count++; d.setUTCDate(d.getUTCDate()+1); }
  return count;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Sign in required' });
  next();
}

function requireHR(req, res, next) {
  const ids = (process.env.HR_USER_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!ids.includes(String(req.session.user?.id))) return res.status(403).json({ error: 'HR access required' });
  next();
}

async function clickupAPI(pathname, token, options={}) {
  const r = await fetch(`https://api.clickup.com/api/v2${pathname}`, {
    ...options,
    headers: { Authorization: token, 'Content-Type': 'application/json', ...(options.headers||{}) }
  });
  if (!r.ok) { const txt = await r.text(); throw new Error(`ClickUp ${r.status}: ${txt}`); }
  return r.json();
}

// OAuth: Step 1 - Redirect to ClickUp
app.get('/auth/clickup', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLICKUP_CLIENT_ID || '',
    redirect_uri: process.env.CLICKUP_REDIRECT_URI || ''
  });
  res.redirect(`https://app.clickup.com/api?${params}`);
});

// OAuth: Step 2 - Exchange code for token, load user profile
app.get('/auth/clickup/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code. Go back and try signing in again.');

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://api.clickup.com/api/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.CLICKUP_CLIENT_ID,
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        code
      })
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.status(401).send('Authorization failed. Please try signing in again.');
    }

    const { access_token } = await tokenRes.json();

    // Load the authenticated user's profile
    const userRes = await fetch('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: access_token }
    });

    if (!userRes.ok) {
      return res.status(500).send('Could not load user profile.');
    }

    const { user } = await userRes.json();

    // Store in session
    req.session.user = {
      id: user.id,
      name: user.username || user.email,
      email: user.email,
      token: access_token
    };

    req.session.save((err) => {
  if (err) {
    console.error('Session save failed:', err);
    return res.status(500).send('Could not save your sign-in session.');
  }
  req.session.save((err) => {
  if (err) {
    console.error('Session save failed:', err);
    return res.status(500).send('Could not save your sign-in session.');
  }
  res.redirect('/dashboard');
});
});
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Something went wrong during sign-in. Please try again.');
  }
});

// Dashboard page (after login)
app.get('/dashboard', requireAuth, (req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Leave Portal</title>
<style>body{font:16px system-ui;margin:0;background:#f5faf7;color:#173b2c}main{max-width:720px;margin:6vh auto;padding:32px}h1{font-size:36px;line-height:1.1;margin:0 0 12px}.card{background:#fff;border:1px solid #e0ede6;border-radius:12px;padding:24px;margin:20px 0}.label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5a7d6a;font-weight:600;margin-bottom:4px}.value{font-size:22px;font-weight:700}a,button{background:#173b2c;color:#f8fff9;padding:12px 18px;border:0;border-radius:8px;text-decoration:none;font-weight:600;cursor:pointer;display:inline-block;margin-top:16px;font-size:14px}.signout{background:#e8f3ec;color:#173b2c;font-size:12px;float:right}</style></head>
<body><main>
<button class="signout" onclick="location='/auth/signout'">Sign out</button>
<small>People operations / Leave</small>
<h1>Welcome, ${req.session.user.name}</h1>
<p>You are signed in as <strong>${req.session.user.email}</strong></p>
<div class="card"><div class="label">Your ClickUp User ID</div><div class="value">${req.session.user.id}</div></div>
<div class="card"><div class="label">Status</div><div class="value">Connected to ClickUp \u2713</div><p style="color:#5a7d6a;margin:8px 0 0">The leave request form will appear here once the full portal UI is wired.</p></div>
<a href="/api/me">View my session (JSON)</a>
</main></body></html>`);
});

// Sign out
app.get('/auth/signout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// API: current user info
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.session.user.id, name: req.session.user.name, email: req.session.user.email });
});

// API: submit leave request
app.post('/api/leave-requests', requireAuth, async (req, res) => {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const days = workingDays(v.startDate, v.endDate);
  const cap = conditionalCaps[v.leaveType];
  if (cap && days > cap) return res.status(400).json({ error: `${v.leaveType} maximum is ${cap} days` });
  if (v.leaveType === 'Annual Leave' && days > 21) return res.status(400).json({ error: 'Annual Leave maximum is 21 working days per year' });

  try {
    const task = await clickupAPI(`/list/${process.env.PRIVATE_LEAVE_RECORDS_LIST_ID}/task`, req.session.user.token, {
      method: 'POST',
      body: JSON.stringify({
        name: `${req.session.user.name} \u00b7 ${v.leaveType} \u00b7 ${v.startDate}`,
        description: `Submitted by ${req.session.user.email}.\n\nReason: ${v.reason}\nHandover: ${v.handover}`,
        status: 'Pending Approval',
        custom_fields: [
          { id: process.env.FIELD_EMPLOYEE_EMAIL_ID, value: req.session.user.email },
          { id: process.env.FIELD_LEAVE_TYPE_ID, value: v.leaveType },
          { id: process.env.FIELD_START_DATE_ID, value: new Date(`${v.startDate}T00:00:00Z`).getTime() },
          { id: process.env.FIELD_END_DATE_ID, value: new Date(`${v.endDate}T00:00:00Z`).getTime() },
          { id: process.env.FIELD_WORKING_DAYS_ID, value: days },
          { id: process.env.FIELD_REASON_ID, value: `${v.reason}\n\nHandover: ${v.handover}` }
        ]
      })
    });
    res.status(201).json({ success: true, taskId: task.id, taskUrl: task.url, workingDays: days });
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ error: 'Failed to create leave request in ClickUp. Try again.' });
  }
});

// API: HR audit
app.get('/api/hr/audit', requireAuth, requireHR, async (req, res) => {
  try {
    const data = await clickupAPI(`/list/${process.env.PRIVATE_LEAVE_RECORDS_LIST_ID}/task?include_closed=true`, req.session.user.token);
    res.json({ records: data.tasks || [] });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch audit data.' });
  }
});

// Webhook receiver
app.post('/webhooks/clickup', express.raw({type:'application/json'}), (req, res) => {
  const signature = req.headers['x-signature'];
  const secret = process.env.CLICKUP_WEBHOOK_SECRET;
  if (secret && signature) {
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).send('Invalid signature');
  }
  // Process webhook payload here (update session caches, notify, etc.)
  res.sendStatus(204);
});

// Health check
app.get('/api/health', (req, res) => res.json({ok:true, service:'secure-leave-portal'}));

// Static files LAST so routes take priority
app.use(express.static(path.join(__dirname, '../client')));

app.listen(process.env.PORT || 3000, () => console.log(`Listening on ${process.env.PORT || 3000}`));
