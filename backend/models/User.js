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
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
