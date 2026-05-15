const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ========== Config ==========
const app = express();
const PORT = process.env.PORT || 3001;

// Security: JWT_SECRET must be set via environment variable in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set. Using temporary dev key. Set JWT_SECRET env var in production!');
}
const effectiveSecret = JWT_SECRET || `dev-${Date.now()}-${Math.random()}`; // Unique per restart in dev

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'assets.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Serve static files from frontend dist (for merged Docker deployment)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

let db;

// ========== Helpers: Crypto ==========

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateToken(userId) {
  const payload = `${userId}:${Date.now() + TOKEN_EXPIRY_MS}`;
  const sig = sha256(payload + JWT_SECRET);
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [userId, expiry, sig] = parts;
    const payload = `${userId}:${expiry}`;
    const expectedSig = sha256(payload + JWT_SECRET);
    if (sig !== expectedSig) return null;
    if (parseInt(expiry) < Date.now()) return null;
    return { userId };
  } catch {
    return null;
  }
}

function hashPassword(password) {
  return sha256(password + JWT_SECRET);
}

// ========== DB Init ==========

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 迁移：添加 owner_id 到 assets
  try { db.run('ALTER TABLE assets ADD COLUMN owner_id TEXT DEFAULT NULL'); } catch (e) {}
  // 迁移：添加 owner_id 到 liabilities
  try { db.run('ALTER TABLE liabilities ADD COLUMN owner_id TEXT DEFAULT NULL'); } catch (e) {}
  // 迁移：添加 tag_id 到 assets
  try { db.run('ALTER TABLE assets ADD COLUMN tag_id TEXT DEFAULT NULL'); } catch (e) {}
  // 迁移：添加 tag_id 到 liabilities
  try { db.run('ALTER TABLE liabilities ADD COLUMN tag_id TEXT DEFAULT NULL'); } catch (e) {}
  // 旧字段兼容
  try { db.run('ALTER TABLE assets ADD COLUMN is_cash INTEGER DEFAULT 1'); } catch (e) {}
  try { db.run('ALTER TABLE liabilities ADD COLUMN interest_rate REAL'); } catch (e) {}
  try { db.run('ALTER TABLE liabilities ADD COLUMN remain_months INTEGER'); } catch (e) {}
  try { db.run('ALTER TABLE liabilities ADD COLUMN repayment_type TEXT DEFAULT "equal"'); } catch (e) {}
  try { db.run('ALTER TABLE liabilities ADD COLUMN repayment_day INTEGER'); } catch (e) {}
  try { db.run('ALTER TABLE liabilities ADD COLUMN start_date TEXT'); } catch (e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      value REAL NOT NULL,
      currency TEXT DEFAULT 'CNY',
      description TEXT,
      purchase_date TEXT,
      location TEXT,
      is_cash INTEGER DEFAULT 1,
      tag_id TEXT DEFAULT NULL,
      owner_id TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS liabilities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'CNY',
      description TEXT,
      due_date TEXT,
      interest_rate REAL,
      remain_months INTEGER,
      repayment_type TEXT DEFAULT 'equal',
      repayment_day INTEGER,
      start_date TEXT,
      tag_id TEXT DEFAULT NULL,
      owner_id TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      avatar TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      member_id TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tags 表
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      owner_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 初始化默认分类
  const result = db.exec('SELECT COUNT(*) as count FROM categories');
  const count = result.length > 0 ? result[0].values[0][0] : 0;

  if (count === 0) {
    const defaultCategories = [
      { id: uuidv4(), name: '现金', type: 'asset', icon: '💵', color: '#22c55e' },
      { id: uuidv4(), name: '银行存款', type: 'asset', icon: '🏦', color: '#3b82f6' },
      { id: uuidv4(), name: '货币基金', type: 'asset', icon: '💰', color: '#10b981' },
      { id: uuidv4(), name: '支付宝/微信', type: 'asset', icon: '📱', color: '#06b6d4' },
      { id: uuidv4(), name: '股票', type: 'asset', icon: '📈', color: '#f59e0b' },
      { id: uuidv4(), name: '基金', type: 'asset', icon: '📊', color: '#8b5cf6' },
      { id: uuidv4(), name: '房产', type: 'asset', icon: '🏠', color: '#ec4899' },
      { id: uuidv4(), name: '车辆', type: 'asset', icon: '🚗', color: '#6366f1' },
      { id: uuidv4(), name: '黄金', type: 'asset', icon: '🥇', color: '#eab308' },
      { id: uuidv4(), name: '其他资产', type: 'asset', icon: '📦', color: '#71717a' },
      { id: uuidv4(), name: '房贷', type: 'liability', icon: '🏠', color: '#ef4444' },
      { id: uuidv4(), name: '车贷', type: 'liability', icon: '🚗', color: '#f97316' },
      { id: uuidv4(), name: '信用卡', type: 'liability', icon: '💳', color: '#dc2626' },
      { id: uuidv4(), name: '消费贷', type: 'liability', icon: '📋', color: '#b91c1c' },
      { id: uuidv4(), name: '其他负债', type: 'liability', icon: '📝', color: '#991b1b' },
    ];

    for (const cat of defaultCategories) {
      db.run(
        'INSERT INTO categories VALUES (?, ?, ?, ?, ?, ?)',
        [cat.id, cat.name, cat.type, cat.icon, cat.color, new Date().toISOString()]
      );
    }
  }

  // 初始化默认标签
  const tagsResult = db.exec('SELECT COUNT(*) as count FROM tags');
  const tagsCount = tagsResult.length > 0 ? tagsResult[0].values[0][0] : 0;

  if (tagsCount === 0) {
    const defaultTags = [
      { id: uuidv4(), name: '日常', color: '#4CAF50' },
      { id: uuidv4(), name: '投资', color: '#2196F3' },
      { id: uuidv4(), name: '备用', color: '#FF9800' },
      { id: uuidv4(), name: '家庭', color: '#E91E63' },
      { id: uuidv4(), name: '事业', color: '#9C27B0' },
      { id: uuidv4(), name: '养老', color: '#607D8B' },
    ];

    for (const tag of defaultTags) {
      db.run(
        'INSERT INTO tags (id, name, color, owner_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [tag.id, tag.name, tag.color, 'GLOBAL_OWNER', new Date().toISOString()]
      );
    }
  }

  saveDB();
  console.log('数据库初始化完成');
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { changes: db.getRowsModified() };
}

function calculateMonthlyPayment(principal, annualRate, months, type) {
  if (!principal || !months) return null;
  if (!annualRate) return principal / months;
  const monthlyRate = annualRate / 100 / 12;
  if (type === 'equal') {
    if (monthlyRate === 0) return principal / months;
    return principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
  } else {
    return principal / months + principal * monthlyRate;
  }
}

// ========== Auth Middleware ==========

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
  const user = queryOne('SELECT * FROM users WHERE id = ?', [decoded.userId]);
  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }
  req.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    member_id: user.member_id
  };
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// ========== Health ==========

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== Auth APIs ==========

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: '用户名至少3位，密码至少6位' });
  }

  const existing = queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const userCount = queryOne('SELECT COUNT(*) as count FROM users');
  const role = userCount.count === 0 ? 'admin' : 'member';

  const id = uuidv4();
  const now = new Date().toISOString();
  const hashed = hashPassword(password);

  // 注册时自动创建成员档案
  const memberId = uuidv4();
  runSql('INSERT INTO members VALUES (?, ?, ?, ?, ?)', [memberId, username, 'member', null, now]);
  runSql('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)', [id, username, hashed, role, memberId, now]);

  const token = generateToken(id);
  res.status(201).json({
    id, username, role, member_id: memberId, created_at: now,
    token, message: role === 'admin' ? '注册成功，您是管理员' : '注册成功'
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const hashed = hashPassword(password);
  if (hashed !== user.password) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken(user.id);
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    member_id: user.member_id,
    token
  });
});

app.get('/api/auth/status', (req, res) => {
  const userCount = queryOne('SELECT COUNT(*) as count FROM users');
  res.json({ isFirstUser: userCount.count === 0 });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = queryOne('SELECT id, username, role, member_id, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  res.json({ success: true, message: '已登出' });
});

// ========== Change Password ==========

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '当前密码和新密码不能为空' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少6位' });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const currentHash = hashPassword(currentPassword);
  if (currentHash !== user.password) {
    return res.status(400).json({ error: '当前密码错误' });
  }

  const newHash = hashPassword(newPassword);
  runSql('UPDATE users SET password = ? WHERE id = ?', [newHash, req.user.id]);

  res.json({ success: true });
});

// ========== Admin Create User ==========

app.post('/api/auth/admin-create-user', authMiddleware, adminOnly, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: '用户名至少3位，密码至少6位' });
  }

  const existing = queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const hashed = hashPassword(password);

  // 自动创建成员档案
  const memberId = uuidv4();
  runSql('INSERT INTO members VALUES (?, ?, ?, ?, ?)', [memberId, username, 'member', null, now]);
  runSql('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)', [id, username, hashed, 'member', memberId, now]);

  res.status(201).json({ success: true, userId: id });
});

// ========== Assets APIs (按 owner_id 隔离) ==========

app.get('/api/assets', authMiddleware, (req, res) => {
  const assets = queryAll(
    'SELECT *, COALESCE(is_cash, 1) as is_cash, COALESCE(tag_id, "") as tag_id FROM assets WHERE owner_id = ? ORDER BY COALESCE(is_cash, 1) DESC, created_at DESC',
    [req.user.id]
  );
  res.json(assets);
});

app.post('/api/assets', authMiddleware, (req, res) => {
  const { name, category, value, currency = 'CNY', description, purchase_date, location, is_cash = true, tag_id = null } = req.body;
  if (!name || !category || value === undefined) {
    return res.status(400).json({ error: 'name, category, value 为必填项' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const isCashValue = is_cash ? 1 : 0;

  runSql(
    'INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, category, value, currency, description, purchase_date, location, isCashValue, tag_id, req.user.id, now, now]
  );

  res.status(201).json({ id, name, category, value, currency, description, purchase_date, location, is_cash: isCashValue, tag_id, owner_id: req.user.id, created_at: now, updated_at: now });
});

app.put('/api/assets/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const asset = queryOne('SELECT * FROM assets WHERE id = ?', [id]);
  if (!asset) return res.status(404).json({ error: '资产不存在' });

  // 只能修改自己的资产
  if (asset.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权修改此资产' });
  }

  const { name, category, value, currency, description, purchase_date, location, is_cash, tag_id } = req.body;
  const now = new Date().toISOString();
  const isCashValue = is_cash !== undefined ? (is_cash ? 1 : 0) : asset.is_cash;

  runSql(
    `UPDATE assets SET name = ?, category = ?, value = ?, currency = ?, description = ?, purchase_date = ?, location = ?, is_cash = ?, tag_id = ?, updated_at = ? WHERE id = ?`,
    [name, category, value, currency, description, purchase_date, location, isCashValue, tag_id || null, now, id]
  );

  res.json({ id, ...req.body, is_cash: isCashValue, updated_at: now });
});

app.delete('/api/assets/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const asset = queryOne('SELECT * FROM assets WHERE id = ?', [id]);
  if (!asset) return res.status(404).json({ error: '资产不存在' });

  if (asset.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权删除此资产' });
  }

  runSql('DELETE FROM assets WHERE id = ?', [id]);
  res.json({ success: true });
});

// ========== Liabilities APIs (按 owner_id 隔离) ==========

app.get('/api/liabilities', authMiddleware, (req, res) => {
  const liabilities = queryAll(
    'SELECT *, COALESCE(tag_id, "") as tag_id FROM liabilities WHERE owner_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(liabilities);
});

app.post('/api/liabilities', authMiddleware, (req, res) => {
  const { name, category, amount, currency = 'CNY', description, interest_rate, remain_months, repayment_type = 'equal', repayment_day, start_date, tag_id = null } = req.body;
  if (!name || !category || amount === undefined) {
    return res.status(400).json({ error: 'name, category, amount 为必填项' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();

  runSql(
    'INSERT INTO liabilities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, category, amount, currency, description, null, interest_rate, remain_months, repayment_type, repayment_day, start_date, tag_id, req.user.id, now, now]
  );

  res.status(201).json({ id, name, category, amount, currency, description, interest_rate, remain_months, repayment_type, repayment_day, start_date, tag_id, owner_id: req.user.id, created_at: now, updated_at: now });
});

app.put('/api/liabilities/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const liability = queryOne('SELECT * FROM liabilities WHERE id = ?', [id]);
  if (!liability) return res.status(404).json({ error: '负债不存在' });

  if (liability.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权修改此负债' });
  }

  const now = new Date().toISOString();
  const { name, category, amount, currency, description, interest_rate, remain_months, repayment_type, repayment_day, start_date, tag_id } = req.body;

  runSql(
    `UPDATE liabilities SET name = ?, category = ?, amount = ?, currency = ?, description = ?, interest_rate = ?, remain_months = ?, repayment_type = ?, repayment_day = ?, start_date = ?, tag_id = ?, updated_at = ? WHERE id = ?`,
    [name, category, amount, currency, description, interest_rate, remain_months, repayment_type, repayment_day, start_date, tag_id || null, now, id]
  );

  res.json({ id, ...req.body, updated_at: now });
});

app.delete('/api/liabilities/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const liability = queryOne('SELECT * FROM liabilities WHERE id = ?', [id]);
  if (!liability) return res.status(404).json({ error: '负债不存在' });

  if (liability.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权删除此负债' });
  }

  runSql('DELETE FROM liabilities WHERE id = ?', [id]);
  res.json({ success: true });
});

// ========== Tags APIs (按 owner_id 隔离) ==========

app.get('/api/tags', authMiddleware, (req, res) => {
  const tags = queryAll('SELECT * FROM tags WHERE owner_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(tags);
});

app.post('/api/tags', authMiddleware, (req, res) => {
  const { name, color = '#6366f1' } = req.body;
  if (!name) return res.status(400).json({ error: '标签名称不能为空' });

  const existing = queryOne('SELECT id FROM tags WHERE name = ? AND owner_id = ?', [name, req.user.id]);
  if (existing) return res.status(400).json({ error: '该标签已存在' });

  const id = uuidv4();
  const now = new Date().toISOString();
  runSql('INSERT INTO tags VALUES (?, ?, ?, ?, ?)', [id, name, color, req.user.id, now]);
  res.status(201).json({ id, name, color, owner_id: req.user.id, created_at: now });
});

app.put('/api/tags/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const tag = queryOne('SELECT * FROM tags WHERE id = ?', [id]);
  if (!tag) return res.status(404).json({ error: '标签不存在' });

  if (tag.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权修改此标签' });
  }

  const { name, color } = req.body;
  runSql('UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?', [name, color, id]);
  const updated = queryOne('SELECT * FROM tags WHERE id = ?', [id]);
  res.json(updated);
});

app.delete('/api/tags/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const tag = queryOne('SELECT * FROM tags WHERE id = ?', [id]);
  if (!tag) return res.status(404).json({ error: '标签不存在' });

  if (tag.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权删除此标签' });
  }

  // 清空使用此标签的资产的 tag_id
  runSql('UPDATE assets SET tag_id = NULL WHERE tag_id = ? AND owner_id = ?', [id, req.user.id]);
  runSql('UPDATE liabilities SET tag_id = NULL WHERE tag_id = ? AND owner_id = ?', [id, req.user.id]);
  runSql('DELETE FROM tags WHERE id = ?', [id]);
  res.json({ success: true });
});

// ========== Categories APIs ==========

app.get('/api/categories', authMiddleware, (req, res) => {
  res.json(queryAll('SELECT * FROM categories ORDER BY type, name'));
});

app.post('/api/categories', authMiddleware, (req, res) => {
  const { name, type, icon = '📦', color = '#3b82f6' } = req.body;
  const existing = queryOne('SELECT id FROM categories WHERE name = ? AND type = ?', [name, type]);
  if (existing) return res.status(400).json({ error: '该分类已存在' });
  const id = uuidv4();
  const now = new Date().toISOString();
  runSql('INSERT INTO categories VALUES (?, ?, ?, ?, ?, ?)', [id, name, type, icon, color, now]);
  res.status(201).json({ id, name, type, icon, color, created_at: now });
});

app.put('/api/categories/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, icon, color } = req.body;
  const assetCount = queryOne('SELECT COUNT(*) as count FROM assets WHERE category = (SELECT name FROM categories WHERE id = ?)', [id]);
  const liabilityCount = queryOne('SELECT COUNT(*) as count FROM liabilities WHERE category = (SELECT name FROM categories WHERE id = ?)', [id]);
  if ((assetCount?.count || 0) > 0 || (liabilityCount?.count || 0) > 0) {
    runSql('UPDATE categories SET icon = ?, color = ? WHERE id = ?', [icon, color, id]);
  } else {
    runSql('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?', [name, icon, color, id]);
  }
  res.json({ id, ...req.body });
});

app.delete('/api/categories/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const cat = queryOne('SELECT name, type FROM categories WHERE id = ?', [id]);
  if (!cat) return res.status(404).json({ error: '分类不存在' });
  const table = cat.type === 'asset' ? 'assets' : 'liabilities';
  const count = queryOne(`SELECT COUNT(*) as count FROM ${table} WHERE category = ?`, [cat.name]);
  if (count.count > 0) return res.status(400).json({ error: '该分类正在使用中，无法删除' });
  runSql('DELETE FROM categories WHERE id = ?', [id]);
  res.json({ success: true });
});

// ========== Stats APIs (按 owner_id 隔离) ==========

app.get('/api/stats/overview', authMiddleware, (req, res) => {
  const uid = req.user.id;

  const totalAssetsRow = queryOne('SELECT COALESCE(SUM(value), 0) as total FROM assets WHERE owner_id = ?', [uid]);
  const totalAssets = totalAssetsRow.total;

  const cashAssetsRow = queryOne('SELECT COALESCE(SUM(value), 0) as total, COUNT(*) as count FROM assets WHERE COALESCE(is_cash, 1) = 1 AND owner_id = ?', [uid]);
  const cashAssets = cashAssetsRow.total;
  const cashCount = cashAssetsRow.count;

  const otherAssetsRow = queryOne('SELECT COALESCE(SUM(value), 0) as total, COUNT(*) as count FROM assets WHERE is_cash = 0 AND owner_id = ?', [uid]);
  const otherAssets = otherAssetsRow.total;
  const otherCount = otherAssetsRow.count;

  const totalLiabilitiesRow = queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM liabilities WHERE owner_id = ?', [uid]);
  const totalLiabilities = totalLiabilitiesRow.total;

  const assetCountRow = queryOne('SELECT COUNT(*) as count FROM assets WHERE owner_id = ?', [uid]);
  const liabilityCountRow = queryOne('SELECT COUNT(*) as count FROM liabilities WHERE owner_id = ?', [uid]);

  const liabilitiesList = queryAll('SELECT amount, interest_rate, remain_months, repayment_type FROM liabilities WHERE owner_id = ?', [uid]);
  let monthlyPayment = 0;
  for (const item of liabilitiesList) {
    if (item.interest_rate && item.remain_months) {
      const payment = calculateMonthlyPayment(item.amount, item.interest_rate, item.remain_months, item.repayment_type);
      if (payment) monthlyPayment += payment;
    }
  }

  const cashByCategory = queryAll(`
    SELECT c.name, c.icon, c.color, SUM(a.value) as total
    FROM assets a JOIN categories c ON a.category = c.name
    WHERE COALESCE(a.is_cash, 1) = 1 AND a.owner_id = ?
    GROUP BY a.category ORDER BY total DESC
  `, [uid]);

  const otherByCategory = queryAll(`
    SELECT c.name, c.icon, c.color, SUM(a.value) as total
    FROM assets a JOIN categories c ON a.category = c.name
    WHERE a.is_cash = 0 AND a.owner_id = ?
    GROUP BY a.category ORDER BY total DESC
  `, [uid]);

  const liabilitiesByCategory = queryAll(`
    SELECT c.name, c.icon, c.color, SUM(l.amount) as total
    FROM liabilities l JOIN categories c ON l.category = c.name
    WHERE l.owner_id = ?
    GROUP BY l.category ORDER BY total DESC
  `, [uid]);

  // 标签统计
  const tags = queryAll('SELECT id, name, color FROM tags WHERE owner_id = ?', [uid]);
  const tagStats = tags.map(tag => {
    const assetCount = queryOne('SELECT COUNT(*) as count FROM assets WHERE tag_id = ? AND owner_id = ?', [tag.id, uid]);
    const liabilityCount = queryOne('SELECT COUNT(*) as count FROM liabilities WHERE tag_id = ? AND owner_id = ?', [tag.id, uid]);
    const totalValue = queryOne('SELECT COALESCE(SUM(value), 0) as total FROM assets WHERE tag_id = ? AND owner_id = ?', [tag.id, uid]);
    const totalLiab = queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM liabilities WHERE tag_id = ? AND owner_id = ?', [tag.id, uid]);
    return { ...tag, assetCount: assetCount.count, liabilityCount: liabilityCount.count, totalValue: totalValue.total, totalLiab: totalLiab.total };
  });

  res.json({
    totalAssets, cashAssets, otherAssets, totalLiabilities,
    monthlyPayment: Math.round(monthlyPayment),
    netWorth: totalAssets - totalLiabilities,
    assetCount: assetCountRow.count, cashCount, otherCount,
    liabilityCount: liabilityCountRow.count,
    cashByCategory, otherByCategory, liabilitiesByCategory,
    tagStats
  });
});

// ========== Backup & Restore APIs (当前用户数据) ==========

// GET /api/backup - 导出当前用户数据为JSON
app.get('/api/backup', authMiddleware, (req, res) => {
  const uid = req.user.id;
  const assets = queryAll('SELECT * FROM assets WHERE owner_id = ?', [uid]);
  const liabilities = queryAll('SELECT * FROM liabilities WHERE owner_id = ?', [uid]);
  const tags = queryAll('SELECT * FROM tags WHERE owner_id = ?', [uid]);
  const categories = queryAll('SELECT * FROM categories');
  res.json({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: req.user.username,
    owner_id: uid,
    data: { assets, liabilities, tags, categories }
  });
});

// POST /api/backup - 从JSON导入数据（覆盖当前用户数据）
app.post('/api/backup', authMiddleware, (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '无效的备份数据' });
  }

  const uid = req.user.id;

  try {
    // 恢复资产
    if (data.assets && Array.isArray(data.assets)) {
      db.run('DELETE FROM assets WHERE owner_id = ?', [uid]);
      for (const row of data.assets) {
        const keys = ['id', 'name', 'category', 'value', 'currency', 'description', 'purchase_date', 'location', 'is_cash', 'tag_id', 'owner_id', 'created_at', 'updated_at'];
        const cols = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => {
          if (k === 'owner_id') return uid;
          return row[k] !== undefined ? row[k] : null;
        });
        try {
          db.run(`INSERT INTO assets (${cols}) VALUES (${placeholders})`, values);
        } catch (e) { /* 跳过重复行 */ }
      }
    }

    // 恢复负债
    if (data.liabilities && Array.isArray(data.liabilities)) {
      db.run('DELETE FROM liabilities WHERE owner_id = ?', [uid]);
      for (const row of data.liabilities) {
        const keys = ['id', 'name', 'category', 'amount', 'currency', 'description', 'due_date', 'interest_rate', 'remain_months', 'repayment_type', 'repayment_day', 'start_date', 'tag_id', 'owner_id', 'created_at', 'updated_at'];
        const cols = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => {
          if (k === 'owner_id') return uid;
          return row[k] !== undefined ? row[k] : null;
        });
        try {
          db.run(`INSERT INTO liabilities (${cols}) VALUES (${placeholders})`, values);
        } catch (e) { /* 跳过重复行 */ }
      }
    }

    // 恢复标签
    if (data.tags && Array.isArray(data.tags)) {
      db.run('DELETE FROM tags WHERE owner_id = ?', [uid]);
      for (const row of data.tags) {
        const keys = ['id', 'name', 'color', 'owner_id', 'created_at'];
        const cols = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => {
          if (k === 'owner_id') return uid;
          return row[k] !== undefined ? row[k] : null;
        });
        try {
          db.run(`INSERT INTO tags (${cols}) VALUES (${placeholders})`, values);
        } catch (e) { /* 跳过重复行 */ }
      }
    }

    saveDB();
    res.json({ success: true, message: '数据恢复成功' });
  } catch (err) {
    res.status(500).json({ error: '恢复失败: ' + err.message });
  }
});

// GET /api/backup/download - 下载.db数据库文件（需admin）
app.get('/api/backup/download', authMiddleware, adminOnly, (req, res) => {
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: '数据库文件不存在' });
  }
  const filename = `family-assets-${new Date().toISOString().slice(0, 10)}.db`;
  res.download(dbPath, filename);
});

// POST /api/restore - 上传.db文件恢复（需admin）
app.post('/api/restore', authMiddleware, adminOnly, (req, res) => {
  if (!req.body || !req.body.dbData) {
    return res.status(400).json({ error: '未提供数据库数据' });
  }
  try {
    const buffer = Buffer.from(req.body.dbData, 'base64');
    const testSQL = require('sql.js');
    const testDb = new testSQL.Database(buffer);
    testDb.close();
    fs.writeFileSync(dbPath, buffer);
    const SQL = require('sql.js');
    const freshBuffer = fs.readFileSync(dbPath);
    const newDb = new SQL.Database(freshBuffer);
    db.close();
    db = newDb;
    res.json({ success: true, message: '数据库恢复成功' });
  } catch (err) {
    res.status(500).json({ error: '恢复失败: ' + err.message });
  }
});

// ========== User Management (admin only) ==========

app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
  const users = queryAll('SELECT id, username, role, member_id, created_at FROM users ORDER BY created_at');
  res.json(users);
});

app.delete('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role === 'admin') return res.status(400).json({ error: '不能删除管理员' });
  runSql('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ========== Members APIs (已弃用，前端不再使用) ==========

app.get('/api/members', authMiddleware, (req, res) => {
  // 返回当前用户的成员档案
  const user = queryOne('SELECT member_id FROM users WHERE id = ?', [req.user.id]);
  if (user && user.member_id) {
    const member = queryOne('SELECT * FROM members WHERE id = ?', [user.member_id]);
    res.json(member ? [member] : []);
  } else {
    res.json([]);
  }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ========== Start Server ==========

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`家庭资产管理系统 API 运行在端口 ${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
