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

        const url = `${import.meta.env.VITE_API_URL || ''}/api/activity-logs?${params.toString()}`;
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      
      if (res.ok) {
        // Backend trả về: { success, data, pagination }
        const data = Array.isArray(json.data) ? json.data : (json.items || []);
        const pagination = json.pagination || {};
        
        // Debug: Kiểm tra dữ liệu nhận được
        console.log('🔍 Frontend received data:', data.slice(0, 2));
        if (data.length > 0) {
          console.log('🔍 First item description:', data[0].description);
          console.log('🔍 First item keys:', Object.keys(data[0]));
        }
        
        setItems(data);
        setTotal(pagination.total || json.total || data.length || 0);
        setPage(pagination.page || json.page || 1);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Table columns - điều chỉnh độ rộng để mô tả chi tiết rộng hơn
  const columns = [
    {
      header: "Thời gian",
      key: "createdAt",
      width: "w-32", // Thu nhỏ cột thời gian
      render: (item) => (
        <div className="text-xs text-gray-900">
          {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : ''}
        </div>
      )
    },
    {
      header: "Người dùng",
      key: "username",
      width: "w-40", // Thu nhỏ cột người dùng
      render: (item) => (
        <div className="text-xs font-medium text-gray-900 truncate">
          {item.username || 'N/A'}
        </div>
      )
    },
    {
      header: "Vai trò",
      key: "role",
      width: "w-24", // Thu nhỏ cột vai trò
      render: (item) => {
        const roleLabels = {
          admin: "👑 Admin",
          thu_ngan: "💰 Thu ngân",
          nhan_vien_ban_hang: "🛒 NV",
          user: "👤 User"
        };
        return (
          <span className="text-xs text-gray-600">
            {roleLabels[item.role] || item.role}
          </span>
        );
      }
    },
    {
      header: "Mô tả chi tiết",
      key: "description",
      width: "flex-1", // Mô tả chi tiết chiếm phần còn lại
      render: (item) => {
        // Debug: Log để kiểm tra
        console.log('🔍 Rendering item:', { 
          id: item._id, 
          description: item.description, 
          action: item.action, 
          module: item.module 
        });
        
        const description = item.description || `${item.action || 'Thao tác'} ${item.module || 'mục'}`;
        
        return (
          <div className="text-sm text-gray-800 leading-relaxed">
            {description}
          </div>
        );
      }
    },
    {
      header: "Chi nhánh",
      key: "branch",
      width: "w-32", // Thu nhỏ cột chi nhánh
      render: (item) => (
        <div className="text-xs text-gray-600 truncate">
          {item.branch || 'N/A'}
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
