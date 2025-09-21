import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import DataTable from "../components/DataTable";

function LichSuHoatDong() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    user: "",
    module: "all",
    branch: "all"
  });

  // Helper function để lấy headers với token
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchLogs = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.user) params.append('user', filters.user);
      if (filters.module && filters.module !== 'all') params.append('module', filters.module);
      if (filters.branch && filters.branch !== 'all') params.append('branch', filters.branch);
      params.append('page', String(p));
      params.append('limit', String(limit));

        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/activity-logs?${params.toString()}`;
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      
      if (res.ok) {
        setItems(json.items || []);
        setTotal(json.total || 0);
        setPage(json.page || 1);
      } else {
        console.error('Load activity logs failed:', json);
        setItems([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    fetchLogs(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchLogs(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    fetchLogs(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Table columns
  const columns = [
    {
      header: "Thời gian",
      key: "createdAt",
      render: (item) => (
        <div className="text-sm text-gray-900">
          {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
        </div>
      )
    },
    {
      header: "Người dùng",
      key: "username",
      render: (item) => (
        <div className="text-sm font-medium text-gray-900">
          {item.username || 'N/A'}
        </div>
      )
    },
    {
      header: "Vai trò",
      key: "role",
      render: (item) => {
        const roleLabels = {
          admin: "👑 Admin",
          quan_ly: "👨‍💼 Quản lý",
          thu_ngan: "💰 Thu ngân",
          nhan_vien_ban_hang: "🛒 Nhân viên bán hàng",
          user: "👤 User"
        };
        return (
          <span className="text-sm text-gray-600">
            {roleLabels[item.role] || item.role}
          </span>
        );
      }
    },
    {
      header: "Module",
      key: "module",
      render: (item) => (
        <span className="text-sm text-blue-600 font-medium">
          {item.module || 'N/A'}
        </span>
      )
    },
    {
      header: "Hành động",
      key: "action",
      render: (item) => {
        const actionColors = {
          create: "green",
          update: "blue", 
          delete: "red"
        };
        const color = actionColors[item.action] || "gray";
        return (
          <span className={`badge-${color}`}>
            {item.action || 'N/A'}
          </span>
        );
      }
    },
    {
      header: "Chi nhánh",
      key: "branch",
      render: (item) => (
        <div className="text-sm text-gray-600">
          {item.branch || 'N/A'}
        </div>
      )
    },
    {
      header: "ID tham chiếu",
      key: "ref_id",
      render: (item) => (
        <div className="text-xs font-mono text-gray-500">
          {item.ref_id ? item.ref_id.substring(0, 8) + '...' : 'N/A'}
        </div>
      )
    }
  ];

  // Stats
  const stats = {
    total: total,
    today: items.filter(item => {
      const today = new Date().toDateString();
      const itemDate = new Date(item.createdAt).toDateString();
      return itemDate === today;
    }).length,
    modules: [...new Set(items.map(item => item.module))].length
  };

  return (
    <Layout 
      activeTab="lich-su-hoat-dong"
      title="📋 Lịch sử hoạt động"
      subtitle="Theo dõi và quản lý hoạt động hệ thống"
    >
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Tổng hoạt động"
          value={stats.total.toString()}
          icon="📊"
          color="blue"
          subtitle="Tất cả hoạt động"
        />
        <StatsCard
          title="Hôm nay"
          value={stats.today.toString()}
          icon="📅"
          color="green"
          subtitle="Hoạt động hôm nay"
        />
        <StatsCard
          title="Module"
          value={stats.modules.toString()}
          icon="🔧"
          color="purple"
          subtitle="Module đã hoạt động"
        />
      </div>

      {/* Filter Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Bộ lọc và tìm kiếm</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Từ ngày</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Đến ngày</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Người dùng</label>
            <input
              type="text"
              placeholder="Tên đăng nhập hoặc email"
              value={filters.user}
              onChange={(e) => handleFilterChange('user', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Module</label>
            <select
              value={filters.module}
              onChange={(e) => handleFilterChange('module', e.target.value)}
              className="form-input"
            >
              <option value="all">Tất cả module</option>
              <option value="cashbook">Sổ quỹ</option>
              <option value="return_import">Trả hàng nhập</option>
              <option value="return_export">Trả hàng bán</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Chi nhánh</label>
            <input
              type="text"
              placeholder="Tên chi nhánh"
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="form-input"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl font-medium transition-colors"
            >
              🔍 Tìm kiếm
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        title="📋 Danh sách hoạt động"
        data={items.map(item => ({ ...item, id: item._id }))}
        columns={columns}
        currentPage={page}
        totalPages={totalPages}
        itemsPerPage={limit}
        totalItems={total}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        loading={loading}
        emptyMessage="Không có hoạt động nào được ghi nhận"
      />
    </Layout>
  );
}

export default LichSuHoatDong;
