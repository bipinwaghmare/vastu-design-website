/* Vastu Design – website server
 * Public site + a small password-protected admin API so the client
 * (Varad Langi) can add / delete photos and videos without a developer.
 * Data lives in ./data/db.json, uploaded media in ./public/uploads
 */
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* optional – originals are used instead */ }

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- tiny JSON database ---------- */
function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(pw, rec) {
  const h = crypto.scryptSync(String(pw), rec.salt, 64);
  const b = Buffer.from(rec.hash, 'hex');
  return h.length === b.length && crypto.timingSafeEqual(h, b);
}

function loadDb() {
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed.json'), 'utf8'));
  const pw = process.env.ADMIN_PASSWORD || 'Vastu@2026';
  seed.admin = { username: process.env.ADMIN_USER || 'varad', ...hashPassword(pw) };
  seed.enquiries = [];
  saveDb(seed);
  console.log('First run: created database with the starter portfolio.');
  return seed;
}
let db;
function saveDb(d) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d || db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
db = loadDb();

/* ---------- helpers ---------- */
const uid = () => crypto.randomBytes(6).toString('hex');
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
function rmUpload(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const f = path.join(UPLOADS, path.basename(url));
  if (f.startsWith(UPLOADS)) fs.unlink(f, () => {});
}
function publicMedia(m) { return m; }

const hits = new Map(); // simple in-memory rate limiter
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}

/* ---------- sessions ---------- */
const sessions = new Map(); // token -> expiry
const SESSION_MS = 1000 * 60 * 60 * 12;
function getCookie(req, name) {
  const c = (req.headers.cookie || '').split(';').map(s => s.trim());
  for (const p of c) if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  return null;
}
function isAuthed(req) {
  const t = getCookie(req, 'vd_sid');
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Please log in.' });
  next();
}

/* ---------- app ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '100kb' }));

/* ----- public API ----- */
app.get('/api/media', (req, res) => {
  const list = db.media.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json(list.map(publicMedia));
});
app.get('/api/settings', (req, res) => res.json(db.settings));

app.post('/api/enquiries', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot
  if (limited('enq:' + req.ip, 6, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many messages. Please call us instead.' });
  const name = clean(b.name, 80), phone = clean(b.phone, 20), message = clean(b.message, 2000);
  if (!name || !/^[+\d][\d\s-]{6,18}$/.test(phone) || !message)
    return res.status(400).json({ error: 'Please enter your name, a valid phone number and a message.' });
  db.enquiries.unshift({ id: uid(), name, phone, interest: clean(b.interest, 60), message, createdAt: Date.now() });
  db.enquiries = db.enquiries.slice(0, 500);
  saveDb();
  res.json({ ok: true });
});

/* ----- auth ----- */
app.post('/api/login', (req, res) => {
  if (limited('login:' + req.ip, 10, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const { username, password } = req.body || {};
  const a = db.admin;
  const okUser = clean(username, 60).toLowerCase() === a.username.toLowerCase();
  const okPass = checkPassword(password || '', a);
  if (!okUser || !okPass) return res.status(401).json({ error: 'Wrong username or password.' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `vd_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
  res.json({ ok: true, username: a.username });
});
app.post('/api/logout', (req, res) => {
  const t = getCookie(req, 'vd_sid'); if (t) sessions.delete(t);
  res.setHeader('Set-Cookie', 'vd_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => res.json({ authed: isAuthed(req), username: isAuthed(req) ? db.admin.username : null }));

app.post('/api/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (!checkPassword(current || '', db.admin)) return res.status(400).json({ error: 'Current password is wrong.' });
  if (!next || String(next).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  db.admin = { username: db.admin.username, ...hashPassword(String(next)) };
  saveDb();
  res.json({ ok: true });
});

/* ----- media management ----- */
const IMG_OK = /^image\/(jpeg|png|webp|gif)$/;
const VID_OK = /^video\/(mp4|webm|quicktime)$/;
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
      cb(null, `${Date.now().toString(36)}-${uid()}${ext}`);
    }
  }),
  limits: { fileSize: 300 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const ok = file.fieldname === 'file' ? (IMG_OK.test(file.mimetype) || VID_OK.test(file.mimetype)) : IMG_OK.test(file.mimetype);
    cb(ok ? null : new Error('Unsupported file type. Use JPG, PNG, WebP, MP4 or WebM.'), ok);
  }
});

function run(cmd, args) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = ''; p.stdout.on('data', d => out += d);
    p.on('error', () => resolve(null));
    p.on('close', code => resolve(code === 0 ? out.trim() : null));
  });
}
/** Resize a photo for the web (needs optional `sharp`). Returns {src, thumb} urls. */
async function processImage(file) {
  const url = '/uploads/' + file.filename;
  if (!sharp) return { src: url, thumb: url };
  try {
    const base = file.filename.replace(/\.[^.]+$/, '');
    const big = base + '-web.jpg', small = base + '-t.jpg';
    await sharp(file.path).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(UPLOADS, big));
    await sharp(file.path).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(UPLOADS, small));
    fs.unlink(file.path, () => {});
    return { src: '/uploads/' + big, thumb: '/uploads/' + small };
  } catch (e) { return { src: url, thumb: url }; }
}
/** If ffmpeg exists on the host, convert phone (HEVC/MOV) video to universally playable H.264 MP4. */
async function normaliseVideo(file) {
  const codec = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file.path]);
  if (codec === null) return '/uploads/' + file.filename; // no ffmpeg on host
  if (codec === 'h264' && /\.mp4$/i.test(file.filename)) return '/uploads/' + file.filename;
  const out = file.filename.replace(/\.[^.]+$/, '') + '-h264.mp4';
  const ok = await run('ffmpeg', ['-v', 'error', '-y', '-i', file.path, '-vf', 'scale=720:-2:force_original_aspect_ratio=decrease', '-c:v', 'libx264', '-crf', '26', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', path.join(UPLOADS, out)]);
  if (ok === null && !fs.existsSync(path.join(UPLOADS, out))) return '/uploads/' + file.filename;
  fs.unlink(file.path, () => {});
  return '/uploads/' + out;
}

app.post('/api/media', requireAuth, (req, res) => {
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'poster', maxCount: 1 }, { name: 'before', maxCount: 1 }])(req, res, async err => {
    const files = req.files || {};
    const discard = () => Object.values(files).flat().forEach(f => fs.unlink(f.path, () => {}));
    if (err) { discard(); return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 300 MB).' : err.message }); }
    const main = files.file && files.file[0];
    if (!main) return res.status(400).json({ error: 'No file received.' });
    try {
      const isVideo = VID_OK.test(main.mimetype);
      const title = clean(req.body.title, 100) || (isVideo ? 'New video' : 'New photo');
      const category = clean(req.body.category, 40) || 'Interiors';
      const item = { id: uid(), title, category, featured: false, createdAt: Date.now() };
      if (isVideo) {
        item.type = 'video';
        item.src = await normaliseVideo(main);
        const poster = files.poster && files.poster[0];
        if (poster) { const p = await processImage(poster); item.poster = p.thumb; if (p.src !== p.thumb) rmUpload(p.src); }
      } else {
        const p = await processImage(main);
        item.src = p.src; item.thumb = p.thumb;
        const before = files.before && files.before[0];
        if (before) { item.type = 'compare'; item.before = (await processImage(before)).src; }
        else item.type = 'photo';
      }
      db.media.push(item); saveDb();
      res.json(item);
    } catch (e) { discard(); console.error(e); res.status(500).json({ error: 'Could not save that file.' }); }
  });
});

app.patch('/api/media/:id', requireAuth, (req, res) => {
  const m = db.media.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found.' });
  const b = req.body || {};
  if (b.title !== undefined) m.title = clean(b.title, 100) || m.title;
  if (b.category !== undefined) m.category = clean(b.category, 40) || m.category;
  if (b.featured !== undefined) m.featured = !!b.featured;
  saveDb(); res.json(m);
});

app.delete('/api/media/:id', requireAuth, (req, res) => {
  const i = db.media.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found.' });
  const [m] = db.media.splice(i, 1);
  [m.src, m.thumb, m.poster, m.before].forEach(rmUpload);
  saveDb(); res.json({ ok: true });
});

/* ----- settings & enquiries ----- */
app.put('/api/settings', requireAuth, (req, res) => {
  const b = req.body || {}, s = db.settings;
  if (b.phone !== undefined) {
    const digits = String(b.phone).replace(/\D/g, '');
    if (digits.length < 10) return res.status(400).json({ error: 'Enter a valid phone number.' });
    s.phone = digits.slice(-10);
  }
  if (b.tagline !== undefined) s.tagline = clean(b.tagline, 160);
  if (b.about !== undefined) s.about = clean(b.about, 1500);
  if (b.address !== undefined) s.address = clean(b.address, 160);
  if (b.certifications !== undefined) s.certifications = (Array.isArray(b.certifications) ? b.certifications : []).map(x => clean(x, 120)).filter(Boolean).slice(0, 20);
  saveDb(); res.json(s);
});
app.get('/api/enquiries', requireAuth, (req, res) => res.json(db.enquiries));
app.delete('/api/enquiries/:id', requireAuth, (req, res) => {
  db.enquiries = db.enquiries.filter(e => e.id !== req.params.id);
  saveDb(); res.json({ ok: true });
});

/* ---------- static site ---------- */
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', immutable: true }));
app.use(express.static(PUBLIC, { extensions: ['html'], maxAge: '1h' }));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, '404.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error.' }); });

app.listen(PORT, () => console.log(`Vastu Design site running on http://localhost:${PORT}  (admin: /admin)`));
