import { useState } from "react";
import LogoutButton from "./LogoutButton";

// Sidebar Component - Layout chung
const Sidebar = ({ activeTab }) => {
  const menuItems = [
    { id: 'nhap-hang', label: 'Nhập hàng', icon: '📥', path: '/nhap-hang' },
    { id: 'xuat-hang', label: 'Xuất hàng', icon: '📤', path: '/xuat-hang' },
    { id: 'ton-kho', label: 'Tồn kho', icon: '📦', path: '/ton-kho-so-luong' },
    { id: 'so-quy', label: 'Sổ quỹ', icon: '💰', path: '/so-quy' },
    { id: 'cong-no', label: 'Công nợ', icon: '💳', path: '/cong-no' },
    { id: 'bao-cao', label: 'Báo cáo', icon: '📊', path: '/bao-cao' },
    { id: 'quan-ly-user', label: 'Quản lý User', icon: '👥', path: '/quan-ly-user' },
  ];

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
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-xl">👤</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold">Admin User</p>
              <p className="text-xs text-white/70">Quản trị viên</p>
            </div>
          </div>
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