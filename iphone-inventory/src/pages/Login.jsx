import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      console.log("🔗 Using internal API URL");
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      console.log("📝 Login response:", data);

      if (res.ok) {
        alert("✅ Đăng nhập thành công");

        if (remember) {
          localStorage.setItem("token", data.token);
          console.log("💾 Token saved to localStorage");
        } else {
          sessionStorage.setItem("token", data.token);
          console.log("💾 Token saved to sessionStorage");
        }

        // Redirect theo role
        try {
          const decoded = JSON.parse(atob(data.token.split('.')[1]));
          const role = decoded.role;
          console.log("👤 User role:", role);
          
          // Thêm delay nhỏ để đảm bảo token được lưu
          setTimeout(() => {
            if (role === 'nhan_vien_ban_hang') {
              navigate("/xuat-hang"); // Nhân viên bán hàng vào xuất hàng
            } else if (role === 'quan_ly' || role === 'admin') {
              navigate("/bao-cao"); // Quản lý/Admin vào báo cáo
            } else {
              navigate("/nhap-hang"); // Thu ngân và các role khác vào nhập hàng
            }
          }, 100);
        } catch (err) {
          console.error("❌ Token decode error:", err);
          // Fallback nếu không decode được token
          setTimeout(() => {
            navigate("/xuat-hang");
          }, 100);
        }
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (err) {
      console.error("❌ Lỗi kết nối:", err);
      alert("❌ Không thể kết nối tới server");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafbfc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#18191a",
          borderRadius: 24,
          padding: 40,
          minWidth: 380,
          maxWidth: 400,
          boxShadow: "0 8px 32px #0002",
          color: "#fff",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 32,
          }}
        >
          Đăng nhập để sử dụng
        </div>

        <form onSubmit={handleLogin} autoComplete="off">
          <div style={{ marginBottom: 15 }}>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Email hoặc Username
            </label>
            <input
              type="text"
              placeholder="Nhập email hoặc username"
              style={{
                width: "100%",
                padding: "12px 10px",
                background: "#23272b",
                color: "#fff",
                border: "1px solid #282a36",
                borderRadius: 6,
                marginBottom: 4,
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 15 }}>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Mật khẩu
            </label>
            <input
              type="password"
              placeholder="Nhập mật khẩu"
              style={{
                width: "100%",
                padding: "12px 10px",
                background: "#23272b",
                color: "#fff",
                border: "1px solid #282a36",
                borderRadius: 6,
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
              color: "#ccc",
              fontSize: 15,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ marginRight: 6, accentColor: "#2196f3" }}
              />
              Ghi nhớ đăng nhập
            </label>
            <Link
              to="/quen-mat-khau"
              style={{ color: "#33aaff", textDecoration: "none" }}
            >
              Quên mật khẩu?
            </Link>
          </div>
          <button
            type="submit"
            style={{
              width: "100%",
              background: "#2196f3",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              borderRadius: 6,
              padding: "14px 0",
              fontSize: 18,
              margin: "18px 0",
              cursor: "pointer",
              letterSpacing: 1,
              boxSizing: "border-box",
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            ĐĂNG NHẬP
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 10 }}>
         
        </div>
      </div>
    </div>
  );
}

export default Login;
