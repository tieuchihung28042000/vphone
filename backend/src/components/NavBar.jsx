import { useNavigate } from "react-router-dom";
import * as jwt_decode from "jwt-decode";

function NavBar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  let role = null;
  try {
    role = token ? jwt_decode.default(token)?.role : null;
  } catch {}

  const btnClass =
    "px-3 py-1 rounded text-white font-medium hover:opacity-90";

  return (
    <div className="flex justify-center gap-2 mb-6">
      {role !== 'nhan_vien_ban_hang' && (
        <button
          onClick={() => navigate("/nhap-hang")}
          className={`${btnClass} bg-blue-600`}
        >
          📥 Nhập hàng
        </button>
      )}
      <button
        onClick={() => navigate("/xuat-hang")}
        className={`${btnClass} bg-green-600`}
      >
        📤 Xuất hàng
      </button>
      {role !== 'nhan_vien_ban_hang' && (
        <button
          onClick={() => navigate("/ton-kho-so-luong")}
          className={`${btnClass} bg-yellow-600`}
        >
          📦 Tồn kho
        </button>
      )}
      {role !== 'thu_ngan' && (
        <button
          onClick={() => navigate("/bao-cao")}
          className={`${btnClass} bg-purple-600`}
        >
          📊 Doanh thu
        </button>
      )}
      {(role === 'admin' || role === 'quan_ly') && (
        <button
          onClick={() => navigate("/lich-su-hoat-dong")}
          className={`${btnClass} bg-gray-700`}
        >
          📜 Lịch sử
        </button>
      )}
    </div>
  );
}

export default NavBar;
