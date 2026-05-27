import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ES Module dirname helper
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Admin credentials (set these in production via environment variables on Render)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@kanhalibrary.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'KanhaAdmin@2024';
const SESSION_SECRET = process.env.SESSION_SECRET || 'kanha-dev-secret-change-in-production';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// WhatsApp alerts to library admin when a student's package ends
const ADMIN_WHATSAPP = (process.env.ADMIN_WHATSAPP || '919828130420').replace(/\D/g, '');
const CALLMEBOT_API_KEY = process.env.CALLMEBOT_API_KEY || '';
const EXPIRY_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours

if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
  console.warn(
    'WARNING: Using default admin credentials. Set ADMIN_EMAIL, ADMIN_PASSWORD, and SESSION_SECRET in production.'
  );
}

function createAuthToken(email) {
  const payload = {
    email,
    exp: Date.now() + TOKEN_TTL_MS
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null;

  const [data, signature] = token.split('.');
  if (!data || !signature) return null;

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.email || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const session = verifyAuthToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Login required. Please sign in as admin.' });
  }

  req.admin = session;
  next();
}

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Ensure the data directory and uploads subdirectory exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded student photos statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure SQLite database
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', DB_PATH);
    initializeDatabase();
  }
});

// Helper function to run DB migrations/table creation
function initializeDatabase() {
  db.serialize(() => {
    // Create Students Table
    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        parent_phone TEXT,
        seat_number TEXT NOT NULL,
        photo_path TEXT,
        duration INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        rate REAL NOT NULL,
        discount REAL DEFAULT 0,
        total_fees REAL NOT NULL,
        fee_status TEXT DEFAULT 'Unpaid',
        amount_paid REAL DEFAULT 0,
        remarks TEXT,
        status TEXT DEFAULT 'Active',
        archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Run safe migration to add archived column to older database instances if present
    db.run(`ALTER TABLE students ADD COLUMN archived INTEGER DEFAULT 0`, (err) => {
      // Ignore error if column already exists
    });

    // Create Payments Table
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS expiry_alerts_sent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        expiry_date TEXT NOT NULL,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
        delivery_status TEXT,
        UNIQUE(student_id, expiry_date)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
        whatsapp_sent INTEGER DEFAULT 0
      )
    `);

    db.run(`ALTER TABLE students ADD COLUMN archived_at TEXT`, () => {});
    db.run(`ALTER TABLE students ADD COLUMN original_seat_number TEXT`, () => {});

    setTimeout(() => checkExpiryAndNotify(), 8000);
    setInterval(() => checkExpiryAndNotify(), EXPIRY_CHECK_INTERVAL_MS);
  });
}

function formatDateIN(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function buildExpiryWhatsAppMessage(student, seatLabel) {
  const pending = Number(student.total_fees) - Number(student.amount_paid);
  let msg = `📚 *KANHA STUDY LIBRARY*\n`;
  msg += `----------------------------------\n`;
  msg += `*Package ENDED* 🔴\n\n`;
  msg += `👤 *${student.name}*\n`;
  msg += `🪑 Seat: *${seatLabel}*\n`;
  msg += `📅 Expiry: *${formatDateIN(student.expiry_date)}*\n`;
  msg += `📱 Student: ${student.phone}\n`;
  msg += `💬 WhatsApp: ${student.whatsapp}\n`;
  if (pending > 0) {
    msg += `💰 Pending fees: *₹${pending}*\n`;
  }
  msg += `\nPlease contact them for renewal.`;
  return msg;
}

async function sendWhatsAppToAdmin(message) {
  if (!CALLMEBOT_API_KEY) {
    console.log('[WhatsApp] CallMeBot API key not set. Alert logged only.');
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const url =
      `https://api.callmebot.com/whatsapp.php?phone=${ADMIN_WHATSAPP}` +
      `&text=${encodeURIComponent(message)}` +
      `&apikey=${encodeURIComponent(CALLMEBOT_API_KEY)}`;

    const response = await fetch(url);
    const text = await response.text();

    if (response.ok && !text.toLowerCase().includes('error')) {
      console.log('[WhatsApp] Expiry alert sent to admin', ADMIN_WHATSAPP);
      return { ok: true };
    }

    console.error('[WhatsApp] CallMeBot response:', text);
    return { ok: false, reason: 'api_error' };
  } catch (err) {
    console.error('[WhatsApp] Failed to send:', err.message);
    return { ok: false, reason: 'network_error' };
  }
}

function processExpiryAlert(student) {
  const seatLabel = student.original_seat_number || student.seat_number;
  const message = buildExpiryWhatsAppMessage(student, seatLabel);

  sendWhatsAppToAdmin(message).then((result) => {
    const deliveryStatus = result.ok ? 'sent' : result.reason || 'failed';

    db.run(
      `INSERT OR IGNORE INTO expiry_alerts_sent (student_id, expiry_date, delivery_status)
       VALUES (?, ?, ?)`,
      [student.id, student.expiry_date, deliveryStatus]
    );

    db.run(
      `INSERT INTO notification_log (student_id, type, message, whatsapp_sent)
       VALUES (?, 'package_expired', ?, ?)`,
      [student.id, message, result.ok ? 1 : 0]
    );
  });
}

function checkExpiryAndNotify() {
  updateStatuses();
  const today = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT s.id, s.name, s.phone, s.whatsapp, s.seat_number, s.original_seat_number,
           s.expiry_date, s.total_fees, s.amount_paid
    FROM students s
    WHERE s.archived = 0
      AND s.expiry_date <= ?
      AND NOT EXISTS (
        SELECT 1 FROM expiry_alerts_sent e
        WHERE e.student_id = s.id AND e.expiry_date = s.expiry_date
      )
  `;

  db.all(sql, [today], (err, students) => {
    if (err) {
      console.error('[Expiry alerts] DB error:', err.message);
      return;
    }
    if (!students || students.length === 0) return;

    console.log(`[Expiry alerts] Sending ${students.length} package-ended notification(s)...`);
    students.forEach((student) => processExpiryAlert(student));
  });
}

// Configure Multer for saving uploaded files (webcam captures or file uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname || '.jpg'));
  }
});

const upload = multer({ storage: storage });

// Helper: Calculate Expiry Date in YYYY-MM-DD
function calculateExpiryDate(startDateStr, months) {
  const date = new Date(startDateStr);
  date.setMonth(date.getMonth() + Number(months));
  return date.toISOString().split('T')[0];
}

// Helper: Check and update student statuses (Active/Expired) based on current date
function updateStatuses() {
  const today = new Date().toISOString().split('T')[0];
  db.run(
    `UPDATE students SET status = 'Expired' WHERE expiry_date < ? AND status = 'Active' AND archived = 0`,
    [today],
    function (err) {
      if (err) console.error('Error updating statuses:', err.message);
    }
  );
  db.run(
    `UPDATE students SET status = 'Active' WHERE expiry_date >= ? AND status = 'Expired' AND archived = 0`,
    [today],
    function (err) {
      if (err) console.error('Error updating statuses:', err.message);
    }
  );
}

// REST API — Authentication (public)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const emailMatch = normalizedEmail === ADMIN_EMAIL;

  const passwordMatch = safeCompare(String(password), ADMIN_PASSWORD);

  if (!emailMatch || !passwordMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = createAuthToken(normalizedEmail);
  res.json({
    token,
    email: normalizedEmail,
    message: 'Login successful'
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ email: req.admin.email });
});

// Protect all other API routes
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/auth/login') {
    return next();
  }
  return requireAuth(req, res, next);
});

// REST API Endpoints (protected)

// 1. Get stats overview
app.get('/api/stats', (req, res) => {
  updateStatuses();
  const today = new Date().toISOString().split('T')[0];
  
  const queries = {
    total: 'SELECT COUNT(*) as count FROM students WHERE archived = 0',
    active: "SELECT COUNT(*) as count FROM students WHERE status = 'Active' AND archived = 0",
    expired: "SELECT COUNT(*) as count FROM students WHERE status = 'Expired' AND archived = 0",
    expiringSoon: "SELECT COUNT(*) as count FROM students WHERE status = 'Active' AND archived = 0 AND expiry_date >= ? AND expiry_date <= date(?, '+3 days')",
    archived: 'SELECT COUNT(*) as count FROM students WHERE archived = 1',
    revenue: "SELECT SUM(amount) as total FROM payments",
    occupiedSeats: "SELECT seat_number, status, name, expiry_date FROM students WHERE archived = 0 AND (status = 'Active' OR status = 'Expired')"
  };

  const stats = {};

  db.serialize(() => {
    db.get(queries.total, [], (err, row) => { stats.total = row ? row.count : 0; });
    db.get(queries.active, [], (err, row) => { stats.active = row ? row.count : 0; });
    db.get(queries.expired, [], (err, row) => { stats.expired = row ? row.count : 0; });
    db.get(queries.expiringSoon, [today, today], (err, row) => { stats.expiringSoon = row ? row.count : 0; });
    db.get(queries.archived, [], (err, row) => { stats.archived = row ? row.count : 0; });
    db.get(queries.revenue, [], (err, row) => { stats.revenue = row && row.total ? row.total : 0; });
    db.all(queries.occupiedSeats, [], (err, rows) => {
      stats.occupiedSeats = rows || [];
      res.json(stats);
    });
  });
});

// 2. Get list of active students (archived = 0)
app.get('/api/students', (req, res) => {
  updateStatuses();
  const sql = `SELECT * FROM students WHERE archived = 0 ORDER BY created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Notifications: recent expiry alerts + WhatsApp config status
app.get('/api/notifications', (req, res) => {
  db.all(
    `SELECT n.*, s.name as student_name
     FROM notification_log n
     LEFT JOIN students s ON s.id = n.student_id
     ORDER BY n.sent_at DESC
     LIMIT 50`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        whatsappConfigured: Boolean(CALLMEBOT_API_KEY),
        adminWhatsApp: ADMIN_WHATSAPP,
        notifications: rows || []
      });
    }
  );
});

app.post('/api/notifications/check-expiry', (req, res) => {
  checkExpiryAndNotify();
  res.json({ message: 'Expiry check started. Alerts will be sent if any packages ended.' });
});

// 2b. Get list of archived / deleted students (saved permanently until you remove them)
app.get('/api/students/archived', (req, res) => {
  const sql = `SELECT * FROM students WHERE archived = 1 ORDER BY archived_at DESC, created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 3. Register a new student
app.post('/api/students', upload.single('photo'), (req, res) => {
  const {
    name,
    phone,
    whatsapp,
    parent_phone,
    seat_number,
    duration,
    start_date,
    rate,
    discount,
    total_fees,
    fee_status,
    amount_paid,
    remarks
  } = req.body;

  if (!name || !phone || !whatsapp || !seat_number || !duration || !start_date || !total_fees) {
    return res.status(400).json({ error: 'Missing required registration details.' });
  }

  // Calculate expiry date automatically
  const expiry_date = calculateExpiryDate(start_date, duration);
  
  // Set status based on expiry
  const today = new Date().toISOString().split('T')[0];
  const status = expiry_date >= today ? 'Active' : 'Expired';

  // Handle photo path
  let photo_path = null;
  if (req.file) {
    photo_path = `/uploads/${req.file.filename}`;
  } else if (req.body.photo_base64) {
    // If sent as base64 from webcam capture, save it as a file
    const base64Data = req.body.photo_base64.replace(/^data:image\/jpeg;base64,/, '');
    const filename = `photo-webcam-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, base64Data, 'base64');
    photo_path = `/uploads/${filename}`;
  }

  const checkSeatSql = `SELECT name FROM students WHERE seat_number = ? AND status = 'Active' AND archived = 0`;
  db.get(checkSeatSql, [seat_number], (err, seatOccupant) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (seatOccupant) {
      return res.status(400).json({ error: `Seat No. ${seat_number} is already occupied by active student: ${seatOccupant.name}` });
    }

    const insertStudentSql = `
      INSERT INTO students (
        name, phone, whatsapp, parent_phone, seat_number, photo_path,
        duration, start_date, expiry_date, rate, discount, total_fees,
        fee_status, amount_paid, remarks, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      name, phone, whatsapp, parent_phone, seat_number, photo_path,
      duration, start_date, expiry_date, rate, discount, total_fees,
      fee_status, amount_paid, remarks, status
    ];

    db.run(insertStudentSql, params, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const studentId = this.lastID;

      // Log payment if initial amount was paid
      if (Number(amount_paid) > 0) {
        const insertPaymentSql = `
          INSERT INTO payments (student_id, amount, payment_date, payment_method)
          VALUES (?, ?, ?, 'Cash/UPI')
        `;
        db.run(insertPaymentSql, [studentId, amount_paid], (err) => {
          if (err) console.error('Error logging payment:', err.message);
        });
      }

      res.status(201).json({ id: studentId, message: 'Student registered successfully!', expiry_date });
    });
  });
});

// 4. Renew student subscription
app.put('/api/students/:id/renew', (req, res) => {
  const { id } = req.params;
  const {
    duration,
    start_date,
    rate,
    discount,
    total_fees,
    fee_status,
    amount_paid,
    remarks
  } = req.body;

  if (!duration || !start_date || !total_fees) {
    return res.status(400).json({ error: 'Missing renewal details (duration, start date, total fees).' });
  }

  // Calculate expiry date automatically
  const expiry_date = calculateExpiryDate(start_date, duration);
  
  // Set status based on expiry
  const today = new Date().toISOString().split('T')[0];
  const status = expiry_date >= today ? 'Active' : 'Expired';

  const updateSql = `
    UPDATE students SET
      duration = ?,
      start_date = ?,
      expiry_date = ?,
      rate = ?,
      discount = ?,
      total_fees = ?,
      fee_status = ?,
      amount_paid = ?,
      remarks = ?,
      status = ?
    WHERE id = ?
  `;
  const params = [
    duration, start_date, expiry_date, rate, discount, total_fees,
    fee_status, amount_paid, remarks, status, id
  ];

  db.run(updateSql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Log the payment
    if (Number(amount_paid) > 0) {
      const insertPaymentSql = `
        INSERT INTO payments (student_id, amount, payment_date, payment_method)
        VALUES (?, ?, ?, 'Cash/UPI')
      `;
      db.run(insertPaymentSql, [id, amount_paid], (err) => {
        if (err) console.error('Error logging payment:', err.message);
      });
    }

    res.json({ message: 'Subscription renewed successfully!', expiry_date });
  });
});

// 5. Soft Delete / Archive a student (data kept in Deleted Students archive)
app.delete('/api/students/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE students SET
      archived = 1,
      original_seat_number = seat_number,
      archived_at = datetime('now'),
      seat_number = 'Archived-' || id,
      status = 'Archived'
    WHERE id = ? AND archived = 0`,
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Student not found or already archived.' });
      }
      res.json({ message: 'Student saved to Deleted Students archive. Seat released.' });
    }
  );
});

// 5b. Restore a student from archive
app.put('/api/students/:id/restore', (req, res) => {
  const { id } = req.params;
  const { seat_number } = req.body;

  if (!seat_number) {
    return res.status(400).json({ error: 'Please specify a seat number to assign on restore.' });
  }

  // Check if seat is occupied by an active student
  const checkSeatSql = `SELECT name FROM students WHERE seat_number = ? AND status = 'Active' AND archived = 0`;
  db.get(checkSeatSql, [seat_number], (err, seatOccupant) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (seatOccupant) {
      return res.status(400).json({ error: `Seat No. ${seat_number} is already occupied by active student: ${seatOccupant.name}` });
    }

    // Fetch student's current expiry date to calculate restored status
    db.get(`SELECT expiry_date FROM students WHERE id = ?`, [id], (err, student) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!student) {
        return res.status(404).json({ error: 'Student not found in archive.' });
      }

      const today = new Date().toISOString().split('T')[0];
      const status = student.expiry_date >= today ? 'Active' : 'Expired';

      // Restore student
      db.run(
        `UPDATE students SET archived = 0, seat_number = ?, status = ? WHERE id = ?`,
        [seat_number, status, id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ message: 'Student restored from archive successfully!', status });
        }
      );
    });
  });
});

// 5c. Permanently delete student and their photo
app.delete('/api/students/:id/permanent', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT photo_path FROM students WHERE id = ?`, [id], (err, student) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (student.photo_path) {
      const fileToDel = path.join(__dirname, 'data', student.photo_path.replace(/^\//, ''));
      fs.unlink(fileToDel, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error('Error deleting student photo file:', err.message);
        }
      });
    }

    db.run(`DELETE FROM students WHERE id = ?`, [id], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Student permanently deleted from database.' });
    });
  });
});

// Serve frontend in production (after running npm run build)
const buildPath = path.join(__dirname, 'dist');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Library Portal API running. Frontend built folder "dist" not found. Start client development server using npm run dev.');
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database (persistent): ${DB_PATH}`);
  console.log(`Admin WhatsApp alerts: ${ADMIN_WHATSAPP}${CALLMEBOT_API_KEY ? ' (CallMeBot enabled)' : ' (set CALLMEBOT_API_KEY to enable)'}`);
});
