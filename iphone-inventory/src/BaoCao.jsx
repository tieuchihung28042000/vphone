import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import StatsCard from "./components/StatsCard";
import FilterCard from "./components/FilterCard";
import DataTable from "./components/DataTable";

// Utility functions
function formatNumber(val) {
  if (val === undefined || val === null || val === "") return "";
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatCurrency(amount) {
  if (!amount || amount === 0) return "0đ";
  
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1)}Tỷ`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}Tr`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return `${formatNumber(amount)}đ`;
}

function BaoCao() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState("Hôm nay");
  const [branch, setBranch] = useState("all");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Predefined date ranges
  const predefined = {
    "Hôm nay": [new Date(), new Date()],
    "Hôm qua": [
      new Date(new Date().setDate(new Date().getDate() - 1)),
      new Date(new Date().setDate(new Date().getDate() - 1)),
    ],
    "Tuần này": [
      new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)),
      new Date(),
    ],
    "Tháng này": [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()],
    "Năm nay": [new Date(new Date().getFullYear(), 0, 1), new Date()],
  };

  // API call to fetch report data
  const fetchData = async (fromDate, toDate, branch) => {
    setLoading(true);
    try {
      let api = `${import.meta.env.VITE_API_URL}/api/bao-cao-loi-nhuan`;
      if (fromDate && toDate) {
        api += `?from=${fromDate}&to=${toDate}&branch=${branch}`;
      }
      const res = await fetch(api);
      const json = await res.json();
      console.log("Dữ liệu báo cáo trả về:", json);
      setData(json);
    } catch (err) {
      console.error("❌ Lỗi khi fetch báo cáo:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Update dates and fetch data when filter or branch changes
  useEffect(() => {
    if (filter !== "Tùy chọn") {
      const [f, t] = predefined[filter];
      const fromDate = f.toISOString().slice(0, 10);
      const toDate = t.toISOString().slice(0, 10);
      setFrom(fromDate);
      setTo(toDate);
      fetchData(fromDate, toDate, branch);
    }
  }, [filter, branch]);

  // Handle custom date range submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (from && to) {
      fetchData(from, to, branch);
    }
  };

  // Calculate stats
  const stats = data ? {
    totalOrders: data.totalDevicesSold || 0,
    totalRevenue: data.totalRevenue || 0,
    totalCost: data.totalCost || 0,
    totalProfit: data.totalProfit || 0,
    profitMargin: data.totalRevenue > 0 ? ((data.totalProfit / data.totalRevenue) * 100).toFixed(1) : 0
  } : {};

  // Get order details
  const orders = data?.orders || data?.items || [];

  // Clear filters function
  const clearFilters = () => {
    setFilter("Hôm nay");
    setBranch("all");
    setShowDetails(false);
  };

  // Table columns definition
  const tableColumns = [
    {
      header: "Sản phẩm",
      key: "product",
      render: (order) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">{order.tenSanPham || order.product_name || 'N/A'}</div>
          <div className="text-sm text-gray-500">SKU: {order.sku || 'N/A'}</div>
        </div>
      )
    },
    {
      header: "IMEI",
      key: "imei",
      render: (order) => (
        <div className="text-sm font-mono text-gray-700">{order.imei || 'N/A'}</div>
      )
    },
    {
      header: "Khách hàng",
      key: "customer",
      render: (order) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{order.buyer_name || 'N/A'}</div>
          <div className="text-sm text-gray-500">{order.buyer_phone || 'N/A'}</div>
        </div>
      )
    },
    {
      header: "Chi nhánh",
      key: "branch",
      render: (order) => (
        <span className="badge-blue text-xs">{order.branch || 'N/A'}</span>
      )
    },
    {
      header: "Giá nhập",
      key: "import_price",
      render: (order) => (
        <div className="text-sm font-semibold text-orange-600">{formatCurrency(order.import_price || order.cost || 0)}</div>
      )
    },
    {
      header: "Giá bán",
      key: "sale_price",
      render: (order) => (
        <div className="text-sm font-semibold text-green-600">{formatCurrency(order.sale_price || order.revenue || 0)}</div>
      )
    },
    {
      header: "Lợi nhuận",
      key: "profit",
      render: (order) => {
        const profit = (order.sale_price || order.revenue || 0) - (order.import_price || order.cost || 0);
        return (
          <div className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
          </div>
        );
      }
    },
    {
      header: "Ngày bán",
      key: "sale_date",
      render: (order) => (
        <div className="text-sm text-gray-600">
          {order.sale_date ? new Date(order.sale_date).toLocaleDateString('vi-VN') : 'N/A'}
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <Layout 
        activeTab="bao-cao"
        title="📊 Báo Cáo"
        subtitle="Phân tích doanh thu và lợi nhuận"
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải báo cáo...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      activeTab="bao-cao"
      title="📊 Báo Cáo"
      subtitle="Phân tích doanh thu và lợi nhuận"
    >
      {/* Stats Dashboard */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Tổng đơn hàng"
            value={stats.totalOrders.toString()}
            icon="🛒"
            color="blue"
            subtitle="Đơn đã bán"
          />
          <StatsCard
            title="Doanh thu"
            value={formatCurrency(stats.totalRevenue)}
            icon="💰"
            color="green"
            subtitle="Tổng thu được"
          />
          <StatsCard
            title="Chi phí"
            value={formatCurrency(stats.totalCost)}
            icon="💸"
            color="orange"
            subtitle="Tổng chi phí"
          />
          <StatsCard
            title="Lợi nhuận"
            value={formatCurrency(stats.totalProfit)}
            icon="📈"
            color="purple"
            subtitle="Margin: ${stats.profitMargin}%"
          />
      </div>
      )}

      {/* Filters */}
      <FilterCard onClearFilters={clearFilters}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Khoảng thời gian</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
              className="form-input"
        >
          {["Hôm nay", "Hôm qua", "Tuần này", "Tháng này", "Năm nay", "Tùy chọn"].map((option) => (
                <option key={option} value={option}>{option}</option>
          ))}
        </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Chi nhánh</label>
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
              className="form-input"
        >
              <option value="all">🏢 Tất cả chi nhánh</option>
          <option value="Dĩ An">Chi nhánh Dĩ An</option>
          <option value="Gò Vấp">Chi nhánh Gò Vấp</option>
          <option value="Thủ Đức">Chi nhánh Thủ Đức</option>
        </select>
          </div>

        {filter === "Tùy chọn" && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Từ ngày</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
                  className="form-input"
              required
            />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Đến ngày</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
                  className="form-input"
              required
            />
              </div>
            </>
          )}
        </div>

        {filter === "Tùy chọn" && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button 
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all font-medium"
            >
              🔍 Áp dụng bộ lọc
            </button>
          </div>
        )}
      </FilterCard>

      {/* No Data State */}
      {!data && !loading && (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Chưa có dữ liệu báo cáo</h3>
          <p className="text-gray-600">Vui lòng chọn khoảng thời gian để xem báo cáo.</p>
      </div>
      )}

      {/* Toggle Details Button */}
      {data && orders.length > 0 && (
        <div className="flex justify-between items-center">
          <div></div>
              <button
                onClick={() => setShowDetails(!showDetails)}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              showDetails 
                ? 'bg-gray-500 hover:bg-gray-600 text-white' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
              >
            {showDetails ? '🔼 Ẩn chi tiết' : '🔽 Xem chi tiết đơn hàng'}
              </button>
        </div>
      )}

      {/* Detailed Orders Table */}
      {showDetails && orders.length > 0 && (
        <DataTable
          title="📋 Chi tiết đơn hàng"
          data={orders.map((item, index) => ({ ...item, id: index }))}
          columns={tableColumns}
          currentPage={1}
          totalPages={1}
          itemsPerPage={orders.length}
          totalItems={orders.length}
        />
      )}

      {/* Empty Orders State */}
      {data && orders.length === 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Không có đơn hàng</h3>
          <p className="text-gray-600">Không có đơn hàng nào trong khoảng thời gian đã chọn.</p>
        </div>
      )}
    </Layout>
  );
}

export default BaoCao;
