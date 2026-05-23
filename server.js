const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'data', 'users.json');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'change-this-secret-in-production';

function ensureDb() {
  if (!fs.existsSync(path.dirname(DB_FILE))) fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = storedHash.split(':');
  const newHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(newHash));
}

function makeToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json' };
  fs.readFile(filePath, (err, content) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  if (req.url === '/api/auth/signup' && req.method === 'POST') {
    try {
      const { name, email, password } = await parseJsonBody(req);
      if (!name || !email || !password) return sendJson(res, 400, { error: 'name, email, password required' });

      const db = readDb();
      if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) return sendJson(res, 409, { error: 'Email already exists' });

      const user = { id: crypto.randomUUID(), name, email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
      db.users.push(user);
      writeDb(db);

      const token = makeToken({ sub: user.id, email: user.email, iat: Date.now() });
      return sendJson(res, 201, { token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.url === '/api/auth/signin' && req.method === 'POST') {
    try {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) return sendJson(res, 400, { error: 'email and password required' });

      const db = readDb();
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user || !verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { error: 'Invalid credentials' });

      const token = makeToken({ sub: user.id, email: user.email, iat: Date.now() });
      return sendJson(res, 200, { token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const safePath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });
  serveFile(res, filePath);
});

ensureDb();
server.listen(PORT, () => console.log(`Entercation running on http://localhost:${PORT}`));
