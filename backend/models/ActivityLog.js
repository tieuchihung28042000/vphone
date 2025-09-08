const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String },
  role: { type: String },
  action: { type: String, enum: ['create','update','delete','return','sale','purchase','adjust','other'], required: true },
  module: { type: String, required: true },
  payload_snapshot: { type: Object },
  ref_id: { type: String },
  branch: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);


