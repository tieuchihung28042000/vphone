// backend/models/Debt.js
import mongoose from 'mongoose';

const debtSchema = new mongoose.Schema({
  customer_name: { type: String, required: true, unique: true },
  total_debt: { type: Number, default: 0 },
  history: [
    {
      date: { type: Date, default: Date.now },
      action: String, // 'add' hoặc 'pay'
      amount: Number,
      note: String,
    }
  ]
});

export default mongoose.model('Debt', debtSchema);
