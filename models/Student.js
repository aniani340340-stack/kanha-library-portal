import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true
    },

    whatsapp: {
      type: String,
      required: true
    },

    parent_phone: String,


    seat_number: {
      type: String,
      required: true
    },

    seat_type: {
      type: String,
      enum: ['morning', 'evening', 'both'],
      default: 'morning',
      required: true
    },

    // For shared seats, allow two students per seat (morning/evening)
    seat_time: {
      type: String,
      enum: ['morning', 'evening'],
      required: true
    },

    // Payment records per month
    payments: [
      {
        month: String, // e.g. '2026-06'
        amount: Number,
        paid_on: String, // date string
        remarks: String
      }
    ],

    photo_path: String,

    duration: Number,

    start_date: String,

    expiry_date: String,

    rate: Number,

    discount: {
      type: Number,
      default: 0
    },

    total_fees: Number,

    fee_status: {
      type: String,
      default: 'Unpaid'
    },

    amount_paid: {
      type: Number,
      default: 0
    },

    remarks: String,

    status: {
      type: String,
      default: 'Active'
    },

    archived: {
      type: Boolean,
      default: false
    },

    archived_at: String,

    original_seat_number: String
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      }
    }
  }
);

export default mongoose.model('Student', studentSchema);
