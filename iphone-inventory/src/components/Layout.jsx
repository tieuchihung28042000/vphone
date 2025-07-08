import { useState } from "react";
import LogoutButton from "./LogoutButton";
import * as jwt_decode from "jwt-decode";

// Sidebar Component - Layout chung
const Sidebar = ({ activeTab }) => {
  // Lấy thông tin user từ token
  const getUserInfo = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return null;
    try {
      const decoded = jwt_decode.default(token);
      return {
        role: decoded.role,
        full_name: decoded.full_name,
        branch_name: decoded.branch_name,
        email: decoded.email
      };
    } catch {
      return null;
    }
  };

  const userInfo = getUserInfo();
  const userRole = userInfo?.role;

  // Định nghĩa tất cả menu items
  const allMenuItems = [
    { id: 'nhap-hang', label: 'Nhập hàng', icon: '📥', path: '/nhap-hang', roles: ['admin', 'quan_ly', 'thu_ngan'] },
    { id: 'xuat-hang', label: 'Xuất hàng', icon: '📤', path: '/xuat-hang', roles: ['admin', 'quan_ly', 'thu_ngan', 'nhan_vien_ban_hang'] },
    { id: 'ton-kho', label: 'Tồn kho', icon: '📦', path: '/ton-kho-so-luong', roles: ['admin', 'quan_ly', 'thu_ngan'] },
    { id: 'so-quy', label: 'Sổ quỹ', icon: '💰', path: '/so-quy', roles: ['admin', 'quan_ly', 'thu_ngan', 'nhan_vien_ban_hang'] },
    { id: 'cong-no', label: 'Công nợ', icon: '💳', path: '/cong-no', roles: ['admin', 'quan_ly', 'thu_ngan'] },
    { id: 'bao-cao', label: 'Báo cáo', icon: '📊', path: '/bao-cao', roles: ['admin', 'quan_ly'] },
    { id: 'quan-ly-user', label: 'Quản lý User', icon: '👥', path: '/quan-ly-user', roles: ['admin', 'quan_ly'] },
  ];

  // Lọc menu theo quyền
  const menuItems = allMenuItems.filter(item => {
    if (!userRole || userRole === 'user') return true; // Fallback cho role cũ
    return item.roles.includes(userRole);
  });

  const getRoleLabel = (role) => {
    const roleLabels = {
      admin: "👑 Admin",
      quan_ly: "👨‍💼 Quản lý", 
      thu_ngan: "💰 Thu ngân",
      nhan_vien_ban_hang: "🛒 Nhân viên bán hàng",
      user: "👤 User"
    };
    return roleLabels[role] || role;
  };

  return (
    <div className="w-72 sidebar-gradient min-h-screen text-white shadow-2xl relative flex flex-col">
      {/* Logo Header */}
      <div className="p-8 border-b border-white/20">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
            <span className="text-2xl">📱</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Manager</h1>
            <p className="text-white/70 text-sm">Quản lý kho hàng</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="mt-8 flex-1">
        {menuItems.map((item) => (
          <a
            key={item.id}
            href={item.path}
            className={`sidebar-menu-item ${activeTab === item.id ? 'active' : ''}`}
          >
            <span className="mr-4 text-lg">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </a>
        ))}
      </nav>

      {/* Bottom User Profile */}
      <div className="m-8 mt-auto">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
          {userInfo ? (
            <div>
              <div className="flex items-center mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-xl">👤</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-semibold">{userInfo.full_name || userInfo.email}</p>
                  <p className="text-xs text-white/70">{getRoleLabel(userInfo.role)}</p>
                </div>
              </div>
              {userInfo.branch_name && (
                <div className="text-xs text-white/60 bg-white/5 rounded-lg px-2 py-1">
                  🏢 {userInfo.branch_name}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">👤</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold">Guest User</p>
                <p className="text-xs text-white/70">Chưa đăng nhập</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Header Component
const Header = ({ title, subtitle }) => (
  <div className="bg-white/70 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
    <div className="flex items-center justify-between px-8 py-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1">{subtitle}</p>
      </div>
      <LogoutButton />
    </div>
  </div>
);

// Main Layout Component
const Layout = ({ children, activeTab, title, subtitle }) => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <Header title={title} subtitle={subtitle} />

        {/* Content Area */}
        <div className="p-8 space-y-8">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout; 