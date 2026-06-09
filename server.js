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

        await Student.updateOne(
          { _id: student._id },
          { $set: { status: 'Expired' } }
        );

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
        seat_type,
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

      const payments = [];
      if (Number(amount_paid) > 0) {
        payments.push({
          month: start_date.substring(0, 7),
          amount: Number(amount_paid),
          paid_on: start_date,
          remarks: remarks
        });
      }

      const student = new Student({
        name,
        phone,
        whatsapp,
        parent_phone,
        seat_number,
        seat_type,
        payments,
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
   Edit Student
========================= */

app.put('/api/students/:id', async (req, res) => {
  try {
    const {
      name,
      phone,
      whatsapp,
      parent_phone,
      seat_number,
      seat_type
    } = req.body;

    const updateFields = {
      name,
      phone,
      whatsapp,
      parent_phone,
      seat_number
    };

    if (seat_type) {
      updateFields.seat_type = seat_type;
    }

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.id,
        archived: false
      },
      {
        $set: updateFields
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!student) {
      return res.status(404).json({
        error: 'Student not found'
      });
    }

    res.json({
      message: 'Student updated successfully',
      student
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   Renew Student
========================= */

app.put(
  '/api/students/:id/renew',
  async (req, res) => {
    try {
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

      const expiry_date =
        calculateExpiryDate(
          start_date,
          duration
        );

      const updateFields = {
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
      };

      const pushOp =
        Number(amount_paid) > 0
          ? {
              $push: {
                payments: {
                  month:
                    start_date.substring(
                      0,
                      7
                    ),
                  amount: Number(
                    amount_paid
                  ),
                  paid_on: start_date,
                  remarks: remarks
                }
              }
            }
          : {};

      const student =
        await Student.findByIdAndUpdate(
          req.params.id,
          {
            $set: updateFields,
            ...pushOp
          },
          { new: true }
        );

      if (!student) {
        return res.status(404).json({
          error: 'Student not found'
        });
      }

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
        await Student.findByIdAndUpdate(
          req.params.id,
          {
            archived: true,
            archived_at:
              new Date().toISOString()
          },
          { new: true }
        );

      if (!student) {
        return res.status(404).json({
          error: 'Student not found'
        });
      }

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
   Permanent Delete (Archive only)
========================= */

app.delete(
  '/api/students/:id/permanent',
  async (req, res) => {
    try {
      const student =
        await Student.findOneAndDelete({
          _id: req.params.id,
          archived: true
        });

      if (!student) {
        return res.status(404).json({
          error:
            'Archived student not found'
        });
      }

      res.json({
        message:
          'Student permanently deleted'
      });
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  }
);

app.get('/api/auth/me', (req, res) => {
  res.json({ email: req.admin.email });
});

app.put('/api/students/:id/restore', async (req, res) => {
  try {
    const updateFields = {
      archived: false,
      archived_at: null,
      status: 'Active'
    };
    if (req.body.seat_number) {
      updateFields.seat_number = req.body.seat_number;
    }
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student restored successfully', student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  res.json({
    whatsappConfigured: false,
    adminWhatsApp: '',
    telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    notifications: []
  });
});

app.post('/api/notifications/check-expiry', async (req, res) => {
  try {
    await autoCheckExpiredStudents();
    res.json({ message: 'Expiry check completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const students = await Student.find({});
    const allPayments = [];
    students.forEach((student) => {
      (student.payments || []).forEach((payment) => {
        allPayments.push({
          id: `${student._id}-${payment._id || Math.random()}`,
          studentId: student._id.toString(),
          studentName: student.name,
          seatNumber: student.seat_number,
          phone: student.phone,
          amount: payment.amount,
          paid_on: payment.paid_on,
          month: payment.month,
          remarks: payment.remarks,
          archived: student.archived
        });
      });
    });
    allPayments.sort((a, b) => new Date(b.paid_on) - new Date(a.paid_on));
    res.json(allPayments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    const archivedCount = await Student.countDocuments({ archived: true });
    const occupiedSeats = students
      .filter((s) => s.status === 'Active')
      .map((s) => s.seat_number.toString());

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
      ),

      archived: archivedCount,
      occupiedSeats
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
