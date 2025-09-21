import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

function ResetMatKhau() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("email") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email) {
      setMessage("❌ Thiếu email trên đường dẫn.");
      return;
    }

    if (password !== confirm) {
      setMessage("❌ Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.VITE_API_URL || 'http://localhost:4000'}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Đặt lại mật khẩu thành công!");
        setTimeout(() => navigate("/dang-nhap"), 2000); // chuyển về trang đăng nhập sau 2s
      } else {
        setMessage(`❌ ${data.message || "Lỗi không xác định."}`);
      }
    } catch (err) {
      setMessage("❌ Không thể kết nối tới server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 shadow rounded bg-white text-center">
      <h1 className="text-2xl font-bold mb-4">🔐 Đặt lại mật khẩu</h1>
      <p className="mb-4 text-gray-600 text-sm">Email: <strong>{email}</strong></p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          placeholder="Mật khẩu mới"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Xác nhận mật khẩu"
          className="border p-2 rounded"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className={`py-2 rounded text-white ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? "Đang xử lý..." : "Xác nhận"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-4 text-sm ${
            message.startsWith("✅") ? "text-green-600" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default ResetMatKhau;
