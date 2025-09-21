import mongoose from 'mongoose';
const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
export default mongoose.model('Branch', BranchSchema);
