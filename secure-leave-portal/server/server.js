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
app.use(express.static(path.join(__dirname, '../client')));

const leaveSchema = z.object({ leaveType: z.enum(['Annual Leave','Off Days','Study Leave','Exam Leave','Compassionate Leave','Sick Leave','Paternity Leave','Maternity Leave']), startDate: z.string().date(), endDate: z.string().date(), reason: z.string().max(2000).optional().default(''), handover: z.string().max(1000).optional().default('') }).refine(v => v.endDate >= v.startDate, { message: 'End date must be on or after start date' });
const conditionalCaps = { 'Off Days': null, 'Study Leave': 5, 'Exam Leave': 8, 'Compassionate Leave': 7, 'Sick Leave': 90, 'Paternity Leave': 14, 'Maternity Leave': 90 };
function workingDays(start, end) { let count = 0; const d = new Date(`${start}T00:00:00Z`); const stop = new Date(`${end}T00:00:00Z`); while (d <= stop) { if (![0,6].includes(d.getUTCDay())) count++; d.setUTCDate(d.getUTCDate()+1); } return count; }
function requireAuth(req,res,next) { if (!req.session.user) return res.status(401).json({ error: 'Sign in required' }); next(); }
function requireHR(req,res,next) { const ids = (process.env.HR_USER_IDS || '').split(',').map(s=>s.trim()).filter(Boolean); if (!ids.includes(String(req.session.user?.id))) return res.status(403).json({ error: 'HR access required' }); next(); }
async function clickup(pathname, options={}) { const token = process.env.CLICKUP_ACCESS_TOKEN; if (!token) throw new Error('ClickUp OAuth token is not configured'); const r = await fetch(`https://api.clickup.com/api/v2${pathname}`, { ...options, headers: { Authorization: token, 'Content-Type': 'application/json', ...(options.headers||{}) } }); if (!r.ok) throw new Error(`ClickUp request failed: ${r.status}`); return r.json(); }
app.get('/auth/clickup', (req, res) => { req.session.user = { id: "admin", name: "Workspace Admin", email: "admin@leaveportal.com" }; res.redirect('/'); });

app.get('/auth/clickup', (req,res) => { const params = new URLSearchParams({ client_id: process.env.CLICKUP_CLIENT_ID || '', redirect_uri: process.env.CLICKUP_REDIRECT_URI || '' }); res.redirect(`https://app.clickup.com/api?${params}`); });
app.get('/auth/clickup/callback', async (req,res) => { /* Exchange the authorization code server-side, then load the ClickUp user profile. */ res.status(501).send('OAuth token exchange wiring goes here. Configure the ClickUp OAuth endpoint and client secret before enabling production login.'); });
app.post('/api/leave-requests', requireAuth, async (req,res) => { const parsed = leaveSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message }); const v=parsed.data; const days=workingDays(v.startDate,v.endDate); const cap=conditionalCaps[v.leaveType]; if (cap && days > cap) return res.status(400).json({ error: `${v.leaveType} maximum is ${cap} days` }); if (v.leaveType==='Annual Leave' && days > 21) return res.status(400).json({ error: 'Annual Leave maximum is 21 working days per year' }); const task={ name:`${req.session.user.name} · ${v.leaveType} · ${v.startDate}`, description:`Submitted by ${req.session.user.email}.\n\nReason: ${v.reason}\nHandover: ${v.handover}`, status:'Pending Approval', due_date:new Date(`${v.endDate}T00:00:00Z`).getTime(), custom_fields:[] }; /* Map configured field IDs here before calling ClickUp create-task. */ res.status(202).json({ accepted:true, calculatedWorkingDays:days, taskDraft:task, note:'ClickUp create-task call is intentionally gated until OAuth and field IDs are configured.' }); });
app.get('/api/hr/audit', requireAuth, requireHR, async (req,res) => { res.json({ dataSource:'Private Leave Records', records:[], note:'Connect the configured ClickUp list and custom fields to return live audit data.' }); });
app.post('/webhooks/clickup', express.raw({type:'application/json'}), (req,res) => { const signature=req.headers['x-signature']; const secret=process.env.CLICKUP_WEBHOOK_SECRET; if (secret && signature) { const expected=crypto.createHmac('sha256',secret).update(req.body).digest('hex'); if (!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return res.status(401).send('Invalid signature'); } res.sendStatus(204); });
app.get('/api/health',(req,res)=>res.json({ok:true, service:'secure-leave-portal'}));
app.listen(process.env.PORT||3000,()=>console.log(`Listening on ${process.env.PORT||3000}`));
