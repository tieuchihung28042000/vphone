import { useState } from "react";

export default function QuenMatKhau() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Gửi OTP về email
  const handleSendOTP = async () => {
    setMessage("");
    if (!email || !password || !confirm) return setMessage("❌ Vui lòng nhập đầy đủ thông tin");
    if (password !== confirm) return setMessage("❌ Mật khẩu xác nhận không khớp");
    if (password.length < 6) return setMessage("❌ Mật khẩu phải từ 6 ký tự");
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/send-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setMessage("✅ Đã gửi mã xác thực về email, vui lòng kiểm tra email và nhập mã OTP bên dưới!");
      } else {
        setMessage(`❌ ${data.message || "Có lỗi xảy ra!"}`);
      }
    } catch {
      setMessage("❌ Không thể kết nối tới server");
    }
    setLoading(false);
  };

  // Xác thực OTP để đổi mật khẩu
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!otp) return setMessage("❌ Vui lòng nhập mã OTP trong email");
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Đổi mật khẩu thành công! Đang chuyển về đăng nhập...");
        setTimeout(() => window.location.href = "/login", 2000);
      } else {
        setMessage(`❌ ${data.message || "Sai mã xác thực!"}`);
      }
    } catch {
      setMessage("❌ Không thể kết nối tới server");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 shadow rounded bg-white text-center">
      <h2 className="text-2xl font-bold mb-4">🔑 Quên mật khẩu</h2>
      <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Nhập email đăng ký"
          className="border p-2 rounded"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu mới"
          className="border p-2 rounded"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Xác nhận mật khẩu mới"
          className="border p-2 rounded"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
        />
        {/* Nút gửi mã OTP riêng */}
        <button
          type="button"
          onClick={handleSendOTP}
          disabled={loading}
          className={`py-2 rounded text-white ${loading ? "bg-gray-400" : "bg-purple-600 hover:bg-purple-700"}`}
        >
          {loading ? "Đang gửi..." : "Gửi mã xác nhận"}
        </button>

        {/* Ô nhập OTP luôn hiển thị */}
        <input
          type="text"
          placeholder="Nhập mã xác thực OTP"
          className="border p-2 rounded"
          value={otp}
          onChange={e => setOtp(e.target.value)}
          required={otpSent}
          disabled={!otpSent}
        />

        {/* Nút xác nhận OTP chỉ bật khi đã gửi OTP */}
        <button
          type="submit"
          disabled={!otpSent || loading}
          className={`py-2 rounded text-white ${(!otpSent || loading) ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}
        >
          {loading ? "Đang xác thực..." : "Xác nhận"}
        </button>
      </form>
      {message && <div className="mt-3 text-sm">{message}</div>}
    </div>
  );
}
