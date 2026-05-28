import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import Student from './models/Student.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 5000;

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

/* =========================
   Routes
========================= */

app.get('/', (req, res) => {
  res.send('Kanha Library Portal API Running');
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

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log(
    'Server running on port ' + PORT
  );
});