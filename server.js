const express = require('express'), cors = require('cors'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const { PORT = 3000, ADMIN_PASSWORD: PASS, SESSION_SECRET: SECRET } = process.env;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA, 'content.json'), MSG = path.join(DATA, 'messages.json'), UP = path.join(DATA, 'uploads');
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://shishirahmed7563.github.io').split(',').map(s => s.trim());
if (!PASS || !SECRET) { console.error('Set ADMIN_PASSWORD and SESSION_SECRET (see .env.example)'); process.exit(1); }
fs.mkdirSync(UP, { recursive: true });

const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const write = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(f + '.tmp', f); };
if (!fs.existsSync(FILE)) write(FILE, require('./default-content.json'));

// Signed, expiring admin token (8 hours)
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const auth = (req, res, next) => {
  const [p, s] = (req.headers.authorization || '').replace('Bearer ', '').split('.');
  if (p && s && same(sign(p), s) && Date.now() < Number(p)) return next();
  res.status(401).json({ error: 'Please sign in again' });
};
const hits = new Map();
const limit = (max, ms) => (req, res, next) => {
  const k = req.ip + req.path, n = (hits.get(k) || []).filter(t => Date.now() - t < ms);
  if (n.length >= max) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  hits.set(k, [...n, Date.now()]); next();
};

const app = express();
app.set('trust proxy', 1);
app.use((q, s, n) => { s.set('X-Content-Type-Options', 'nosniff'); n(); });
app.use(express.json({ limit: '8mb' }));
app.use('/api', cors({ origin: (o, cb) => cb(null, !o || ORIGINS.includes(o)) }));

app.get('/api/content', (req, res) => res.set('Cache-Control', 'no-cache').json(read(FILE, {})));
app.post('/api/login', limit(5, 15 * 60e3), (req, res) =>
  same(req.body.password || '', PASS)
    ? res.json({ token: (t => t + '.' + sign(t))(String(Date.now() + 8 * 3600e3)) })
    : res.status(401).json({ error: 'Wrong password' }));
app.put('/api/content', auth, (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid content' });
  write(FILE, req.body); res.json({ ok: true });
});

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
app.post('/api/upload', auth, (req, res) => {
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(req.body.data || '');
  if (!m || !EXT[m[1]]) return res.status(400).json({ error: 'Use a JPG, PNG, WebP or GIF image' });
  const name = crypto.randomBytes(8).toString('hex') + '.' + EXT[m[1]];
  fs.writeFileSync(path.join(UP, name), Buffer.from(m[2], 'base64'));
  res.json({ url: '/uploads/' + name });
});
app.use('/uploads', express.static(UP, { maxAge: '7d' }));

app.post('/api/contact', limit(5, 3600e3), (req, res) => {
  const fields = {};
  Object.entries(req.body || {}).slice(0, 8).forEach(([k, v]) => { fields[String(k).slice(0, 40)] = String(v).slice(0, 3000); });
  if (!Object.values(fields).some(Boolean)) return res.status(400).json({ error: 'Empty message' });
  write(MSG, [{ id: crypto.randomUUID(), at: new Date().toISOString(), fields }, ...read(MSG, [])].slice(0, 500));
  res.json({ ok: true });
});
app.get('/api/messages', auth, (req, res) => res.json(read(MSG, [])));
app.delete('/api/messages/:id', auth, (req, res) => { write(MSG, read(MSG, []).filter(m => m.id !== req.params.id)); res.json({ ok: true }); });

app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.get('/cms.js', (req, res) => res.type('js').sendFile(path.join(__dirname, 'public/cms.js')));
app.get('/', (req, res) => res.redirect('/admin'));
app.listen(PORT, () => console.log('Portfolio CMS on port ' + PORT));
