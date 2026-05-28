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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kanhalibrary.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'KanhaAdmin@2024';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret';

app.use(cors());
app.use(express.json());

/* =========================
   MongoDB Connection
========================= */

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected');
  })
  .catch((err) => {
    console.log(err);
  });

/* =========================
   Uploads Folder
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
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
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

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() > payload.exp) {
    return null;
  }

  return payload;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
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
  const expiryDate = new Date(student.expiry_date);
  const isExpired = expiryDate < new Date();
  const pendingAmount = Number(student.total_fees || 0) - Number(student.amount_paid || 0);

  return `KANHA STUDY LIBRARY ADMIN ALERT

Student subscription ${isExpired ? 'expired' : 'expiring soon'}.

Name: ${student.name}
Seat: ${student.seat_number}
Phone: ${student.phone}
WhatsApp: ${student.whatsapp}
Parent/Emergency: ${student.parent_phone || 'Not provided'}

Start Date: ${formatDateInIndia(student.start_date)}
Expiry Date: ${formatDateInIndia(student.expiry_date)}
Status: ${isExpired ? 'Expired' : 'Expiring soon'}

Total Fees: Rs. ${student.total_fees || 0}
Amount Paid: Rs. ${student.amount_paid || 0}
Pending Fees: Rs. ${pendingAmount > 0 ? pendingAmount : 0}
Fee Status: ${student.fee_status || 'Not set'}
Remarks: ${student.remarks || 'None'}`;
}

async function sendTelegramMessage(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return {
      sent: false,
      reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured'
    };
  }

  const url = new URL(`https://api.telegram.org/bot${botToken}/sendMessage`);
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

  const body = await response.json().catch(() => null);

  return {
    sent: response.ok,
    status: response.status,
    body
  };
}

/* =========================
   Routes
========================= */

app.get('/api/health', (req, res) => {
  res.send('Kanha Library Portal API Running');
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      error: 'Invalid admin email or password'
    });
  }

  const token = signToken({
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  });

  res.json({
    token,
    email
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    email: req.admin.email
  });
});

app.get('/', (req, res) => {
  if (fs.existsSync(DIST_INDEX)) {
    return res.sendFile(DIST_INDEX);
  }

  res.send('Kanha Library Portal API Running');
});

app.use('/api', requireAuth);

app.get('/api/stats', async (req, res) => {
  try {
    const students = await Student.find({
      archived: false
    });

    const today = new Date();
    const warningThreshold = new Date();
    warningThreshold.setDate(today.getDate() + 3);

    const stats = students.reduce(
      (acc, student) => {
        const expiryDate = new Date(student.expiry_date);
        const isExpired = expiryDate < today;
        const isExpiringSoon = !isExpired && expiryDate <= warningThreshold;

        acc.total += 1;
        acc.revenue += Number(student.amount_paid || 0);
        acc.occupiedSeats.push(String(student.seat_number));

        if (isExpired) {
          acc.expired += 1;
        } else {
          acc.active += 1;
        }

        if (isExpiringSoon) {
          acc.expiringSoon += 1;
        }

        return acc;
      },
      {
        total: 0,
        active: 0,
        expired: 0,
        expiringSoon: 0,
        occupiedSeats: [],
        revenue: 0
      }
    );

    res.json(stats);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   Get Students
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

      if (
        !name ||
        !phone ||
        !whatsapp ||
        !seat_number
      ) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      const seatExists = await Student.findOne({
        seat_number,
        archived: false,
        status: 'Active'
      });

      if (seatExists) {
        return res.status(400).json({
          error:
            'Seat already occupied by ' +
            seatExists.name
        });
      }

      const expiry_date = calculateExpiryDate(
        start_date,
        duration
      );

      let photo_path = null;

      if (req.file) {
        photo_path = '/uploads/' + req.file.filename;
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

      res.status(201).json({
        message: 'Student added successfully',
        student
      });
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

app.put('/api/students/:id/renew', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

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
    student.expiry_date = calculateExpiryDate(start_date, duration);
    student.rate = rate;
    student.discount = discount;
    student.total_fees = total_fees;
    student.fee_status = fee_status;
    student.amount_paid = amount_paid;
    student.remarks = remarks;
    student.status = 'Active';

    await student.save();

    res.json({
      message: 'Student renewed successfully',
      student
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   Delete Student
========================= */

app.delete('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        error: 'Student not found'
      });
    }

    student.archived = true;
    student.archived_at = new Date();
    student.original_seat_number = student.original_seat_number || student.seat_number;

    await student.save();

    res.json({
      message: 'Student archived successfully'
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.delete('/api/students/:id/permanent', async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({
      _id: req.params.id,
      archived: true
    });

    if (!student) {
      return res.status(404).json({
        error: 'Archived student not found'
      });
    }

    res.json({
      message: 'Student permanently deleted'
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   Archived Students
========================= */

app.get('/api/students/archived', async (req, res) => {
  try {
    const students = await Student.find({
      archived: true
    });

    res.json(students);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.put('/api/students/:id/restore', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        error: 'Student not found'
      });
    }

    if (req.body.seat_number) {
      student.seat_number = req.body.seat_number;
    }

    student.archived = false;
    student.archived_at = null;
    student.status = 'Active';

    await student.save();

    res.json({
      message: 'Student restored successfully',
      student
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.get('/api/notifications', (req, res) => {
  res.json({
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    notifications: []
  });
});

app.post('/api/notifications/check-expiry', async (req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return res.status(400).json({
        error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required'
      });
    }

    const today = new Date();
    const warningThreshold = new Date();
    warningThreshold.setDate(today.getDate() + 3);

    const students = await Student.find({
      archived: false
    });

    const dueStudents = students.filter((student) => {
      const expiryDate = new Date(student.expiry_date);
      return expiryDate <= warningThreshold;
    });

    const results = [];

    for (const student of dueStudents) {
      const result = await sendTelegramMessage(getAdminExpiryMessage(student));

      results.push({
        student_id: student.id,
        student_name: student.name,
        sent: result.sent,
        status: result.status,
        error: result.sent ? null : result.reason || result.body?.description || 'Failed to send'
      });
    }

    res.json({
      message: `Expiry check completed. ${results.filter((r) => r.sent).length}/${results.length} Telegram alerts sent.`,
      notifications: results
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

if (fs.existsSync(DIST_INDEX)) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'API route not found'
      });
    }

    res.sendFile(DIST_INDEX);
  });
}

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log(
    'Server running on port ' + PORT
  );
});
