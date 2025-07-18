import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import DangKy from "./pages/DangKy";
import QuenMatKhau from "./pages/QuenMatKhau";
import ResetMatKhau from "./pages/ResetMatKhau";
import NhapHang from "./pages/NhapHang";
import XuatHang from "./pages/XuatHang";
import TonKhoSoLuong from "./pages/TonKhoSoLuong";
import BaoCao from "./BaoCao"; // Nếu BaoCao.jsx nằm ngoài thư mục pages
import PrivateRoute from "./components/PrivateRoute";
import CongNo from "./pages/CongNo";
import QuanLyUser from "./pages/QuanLyUser";
import NotAuthorized from "./pages/NotAuthorized";
import DanhSachCanhBao from "./pages/DanhSachCanhBao";

// === THÊM DÒNG NÀY ===
import Cashbook from "./pages/Cashbook"; // <--- Sổ quỹ

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dang-ky" element={<DangKy />} />
      <Route path="/quen-mat-khau" element={<QuenMatKhau />} />
      <Route path="/reset-mat-khau/:token" element={<ResetMatKhau />} />

      {/* Private routes */}
      <Route
        path="/nhap-hang"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly"]}>
            <NhapHang />
          </PrivateRoute>
        }
      />
      <Route
        path="/xuat-hang"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly", "thu_ngan", "nhan_vien_ban_hang"]}>
            <XuatHang />
          </PrivateRoute>
        }
      />
      <Route
        path="/ton-kho-so-luong"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly"]}>
            <TonKhoSoLuong />
          </PrivateRoute>
        }
      />
      <Route
        path="/bao-cao"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly"]} requireReportAccess={true}>
            <BaoCao />
          </PrivateRoute>
        }
      />
      <Route
        path="/cong-no"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly", "thu_ngan"]}>
            <CongNo />
          </PrivateRoute>
        }
      />

      <Route
        path="/canh-bao-ton-kho"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly", "thu_ngan"]}>
            <DanhSachCanhBao />
          </PrivateRoute>
        }
      />

      {/* ===== THÊM ROUTE SỔ QUỸ ===== */}
      <Route
        path="/so-quy"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly"]}>
            <Cashbook />
          </PrivateRoute>
        }
      />

      {/* Quản lý User */}
      <Route
        path="/quan-ly-user"
        element={
          <PrivateRoute requiredRole={["admin", "quan_ly"]}>
            <QuanLyUser />
          </PrivateRoute>
        }
      />

      {/* Not authorized */}
      <Route path="/not-authorized" element={<NotAuthorized />} />
    </Routes>
  );
}

export default App;
