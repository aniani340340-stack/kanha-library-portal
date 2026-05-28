import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import Student from './models/Student.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 5000;

const DIST_DIR = path.join(__dirname, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || 'admin@kanhalibrary.com';

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || 'KanhaAdmin@2024';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'change-this-secret';

app.use(cors());
app.use(express.json());

/* =========================
   MongoDB Connection
========================= */

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
  })
  .catch((err) => {
    console.log('MongoDB Error:', err);
  });

/* =========================
   Upload Folder
========================= */

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOADS_DIR));

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

/* =========================
   Multer Config
========================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    cb(
      null,
      'photo-' +
        uniqueSuffix +
        path.extname(file.originalname || '.jpg')
    );
  }
});

const upload = multer({ storage });

/* =========================
   Helper Functions
========================= */

function calculateExpiryDate(startDateStr, months) {
  const date = new Date(startDateStr);

  date.setMonth(date.getMonth() + Number(months));

  return date.toISOString().split('T')[0];
}

function signToken(payload) {
  const encodedPayload = Buffer.from(
    JSON.stringify(payload)
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    return null;
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString(
      'utf8'
    )
  );

  if (payload.exp && Date.now() > payload.exp) {
    return null;
  }

  return payload;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  req.admin = payload;

  next();
}

function formatDateInIndia(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getAdminExpiryMessage(student) {
  const pendingAmount =
    Number(student.total_fees || 0) -
    Number(student.amount_paid || 0);

  return `
📚 KANHA STUDY LIBRARY

❌ Student Package Expired

👤 Name: ${student.name}

🪑 Seat: ${student.seat_number}

📱 Phone: ${student.phone}

💬 WhatsApp: ${student.whatsapp}

📅 Expiry Date:
${formatDateInIndia(student.expiry_date)}

💰 Pending Fees:
₹${pendingAmount > 0 ? pendingAmount : 0}

⚠ Please contact student for renewal.
`;
}

async function sendTelegramMessage(message) {
  try {
    const botToken =
      process.env.TELEGRAM_BOT_TOKEN;

    const chatId =
      process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log(
        'Telegram token or chat ID missing'
      );

      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    });

    const data = await response.json();

    console.log('Telegram response:', data);

    return data;
  } catch (err) {
    console.log('Telegram Error:', err.message);
  }
}

/* =========================
   Automatic Expiry Checker
========================= */

async function autoCheckExpiredStudents() {
  try {
    const today = new Date();

    const students = await Student.find({
      archived: false
    });

    for (const student of students) {
      const expiryDate = new Date(
        student.expiry_date
      );

      if (
        expiryDate <= today &&
        student.status !== 'Expired'
      ) {
        await sendTelegramMessage(
          getAdminExpiryMessage(student)
        );

        student.status = 'Expired';

        await student.save();

        console.log(
          '✅ Telegram alert sent for:',
          student.name
        );
      }
    }
  } catch (err) {
    console.log(
      'Auto expiry error:',
      err.message
    );
  }
}

/* =========================
   Routes
========================= */

app.get('/', (req, res) => {
  if (fs.existsSync(DIST_INDEX)) {
    return res.sendFile(DIST_INDEX);
  }

  res.send('Kanha Library Portal API Running');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok'
  });
});

/* =========================
   Telegram Test Route
========================= */

app.get('/test-telegram', async (req, res) => {
  const result = await sendTelegramMessage(
    '✅ Telegram notifications working from Kanha Library'
  );

  res.json(result);
});

/* =========================
   Login
========================= */

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (
    email !== ADMIN_EMAIL ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  const token = signToken({
    email,
    exp:
      Date.now() +
      1000 * 60 * 60 * 24 * 7
  });

  res.json({
    token,
    email
  });
});

app.use('/api', requireAuth);

/* =========================
   Students List
========================= */

app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find({
      archived: false
    }).sort({
      createdAt: -1
    });

    res.json(students);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   Add Student
========================= */

app.post(
  '/api/students',
  upload.single('photo'),
  async (req, res) => {
    try {
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

      const expiry_date =
        calculateExpiryDate(
          start_date,
          duration
        );

      let photo_path = null;

      if (req.file) {
        photo_path =
          '/uploads/' + req.file.filename;
      }

      const student = new Student({
        name,
        phone,
        whatsapp,
        parent_phone,
        seat_number,
        photo_path,
        duration,
        start_date,
        expiry_date,
        rate,
        discount,
        total_fees,
        fee_status,
        amount_paid,
        remarks,
        status: 'Active'
      });

      await student.save();

      res.json({
        message:
          'Student added successfully',
        student
      });
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

/* =========================
   Renew Student
========================= */

app.put(
  '/api/students/:id/renew',
  async (req, res) => {
    try {
      const student =
        await Student.findById(
          req.params.id
        );

      if (!student) {
        return res.status(404).json({
          error: 'Student not found'
        });
      }

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

      student.duration = duration;
      student.start_date = start_date;
      student.expiry_date =
        calculateExpiryDate(
          start_date,
          duration
        );

      student.rate = rate;
      student.discount = discount;
      student.total_fees = total_fees;
      student.fee_status = fee_status;
      student.amount_paid = amount_paid;
      student.remarks = remarks;
      student.status = 'Active';

      await student.save();

      res.json({
        message:
          'Student renewed successfully'
      });
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

/* =========================
   Archive Student
========================= */

app.delete(
  '/api/students/:id',
  async (req, res) => {
    try {
      const student =
        await Student.findById(
          req.params.id
        );

      if (!student) {
        return res.status(404).json({
          error: 'Student not found'
        });
      }

      student.archived = true;

      student.archived_at = new Date();

      await student.save();

      res.json({
        message:
          'Student archived successfully'
      });
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

/* =========================
   Archived Students
========================= */

app.get(
  '/api/students/archived',
  async (req, res) => {
    try {
      const students =
        await Student.find({
          archived: true
        });

      res.json(students);
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

/* =========================
   Stats
========================= */

app.get('/api/stats', async (req, res) => {
  try {
    const students = await Student.find({
      archived: false
    });

    const stats = {
      total: students.length,

      active: students.filter(
        (s) => s.status === 'Active'
      ).length,

      expired: students.filter(
        (s) => s.status === 'Expired'
      ).length,

      revenue: students.reduce(
        (sum, s) =>
          sum + Number(s.amount_paid || 0),
        0
      )
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   Start Automatic Checker
========================= */

autoCheckExpiredStudents();

setInterval(() => {
  autoCheckExpiredStudents();
}, 60000);

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log(
    '🚀 Server running on port ' + PORT
  );
});