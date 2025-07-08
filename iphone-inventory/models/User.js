const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: false,
      unique: true,
      trim: true,
      sparse: true, // Cho phép null/undefined và vẫn unique
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    approved: {                    // Thêm trường approved để xác định đã duyệt hay chưa
      type: Boolean,
      default: false,              // Mặc định chưa được duyệt
    },
    role: {
      type: String,
      enum: ["user", "admin", "thu_ngan", "quan_ly", "nhan_vien_ban_hang"],
      default: "user",
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: function() {
        return this.role !== 'admin'; // Admin không cần branch_id
      }
    },
    branch_name: {
      type: String,
      required: function() {
        return this.role !== 'admin'; // Admin không cần branch_name
      }
    },
    full_name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
