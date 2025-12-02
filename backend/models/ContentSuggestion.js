import mongoose from 'mongoose';

const ContentSuggestionSchema = new mongoose.Schema({
  content: { type: String, required: true, unique: true },
  type: { type: String, enum: ['thu', 'chi', 'all'], default: 'all' },
  branch: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

ContentSuggestionSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export default mongoose.model('ContentSuggestion', ContentSuggestionSchema);

