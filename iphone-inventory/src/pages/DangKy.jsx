import { useState } from "react";
import { useNavigate } from "react-router-dom";

function DangKy() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(""); // thêm state message hiển thị thông báo
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("❌ Mật khẩu nhập lại không khớp");
      return;
    }

    try {
      const API = import.meta.env.VITE_API_URL?.replace(/\/+$/, ""); // Xoá dấu / nếu có
      console.log("🔗 API:", `${API}/api/admin-register`);

      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (err) {
        console.error("❌ Phản hồi không phải JSON:", err);
      }

      if (res.ok) {
        // Thay vì alert và chuyển trang ngay, hiển thị thông báo chờ duyệt
        setMessage("✅ Đăng ký thành công, vui lòng chờ admin phê duyệt.");
      } else {
        setMessage(`❌ ${data.message || "Đăng ký thất bại"}`);
      }
    } catch (err) {
      console.error("❌ Lỗi kết nối server:", err);
      setMessage("❌ Lỗi khi kết nối tới server");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 shadow rounded bg-white text-center">
      <h1 className="text-2xl font-bold mb-6">📝 Đăng ký tài khoản Admin</h1>

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email (bắt buộc)"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Username (tùy chọn)"
          className="border p-2 rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Nhập lại mật khẩu"
          className="border p-2 rounded"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          Đăng ký
        </button>
      </form>

      {message && (
        <p className={`mt-4 text-sm ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      <p className="mt-4 text-sm text-gray-600">
        🔐 Đã có tài khoản?{" "}
        <button
          className="text-blue-500 hover:underline"
          onClick={() => navigate("/login")}
        >
          Đăng nhập
        </button>
      </p>
    </div>
  );
}

export default DangKy;
