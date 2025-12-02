import { useEffect, useMemo, useState } from "react";
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
  const [financial, setFinancial] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState("Hôm nay"); // ✅ Mặc định hôm nay
  const [branch, setBranch] = useState("all");
  const [userRole, setUserRole] = useState(null);
  const [userBranch, setUserBranch] = useState(null);

  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
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
    "Tất cả": [new Date("2020-01-01"), new Date("2030-12-31")], // Khoảng thời gian rất rộng để lấy tất cả
  };

  // ✅ Load branches từ API
  const loadBranches = async () => {
    try {
      console.log('📊 Loading branches for report...'); // Debug
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/branches`);
      const data = await response.json();
      
      if (response.ok && data.length > 0) {
        const branchNames = data.map(branch => branch.name);
        setBranches(branchNames);
        console.log('📊 Loaded branches:', branchNames); // Debug
      } else {
        // Fallback nếu không load được
        const fallbackBranches = ['Dĩ An', 'Quận 9'];
        setBranches(fallbackBranches);
        console.log('📊 Using fallback branches:', fallbackBranches); // Debug
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      // Fallback nếu có lỗi
      const fallbackBranches = ['Dĩ An', 'Quận 9'];
      setBranches(fallbackBranches);
      console.log('📊 Using error fallback branches:', fallbackBranches); // Debug
    }
  };

  // API call to fetch report data
  const fetchData = async (fromDate, toDate, branchParam) => {
    // Thu ngân chỉ xem chi nhánh của mình
    if (userRole === 'thu_ngan' && userBranch) {
      branchParam = userBranch;
    } else if (!branchParam) {
      console.log('⚠️ Branch not set, using "all":', branchParam);
      branchParam = "all"; // Đặt mặc định là "all"
    }
    
    console.log('📊 Fetching report data:', { fromDate, toDate, branch: branchParam }); // Debug
    setLoading(true);
    try {
      let api = `${import.meta.env.VITE_API_URL || ''}/api/report/bao-cao-loi-nhuan`;
      if (fromDate && toDate) {
        api += `?from=${fromDate}&to=${toDate}&branch=${branchParam}`;
      }
      
      console.log('📊 API URL:', api); // Debug
      
      // Lấy token từ localStorage hoặc sessionStorage
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      const res = await fetch(api, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      console.log("📊 Dữ liệu báo cáo trả về:", json);
      setData(json);

      // ✅ Gọi thêm API tóm tắt tài chính cho 6 metrics
      if (fromDate && toDate) {
        const urlFinancial = `${import.meta.env.VITE_API_URL || ''}/api/report/financial-report/summary?from=${fromDate}&to=${toDate}&branch=${branchParam}`;
        const resFinancial = await fetch(urlFinancial, { headers: { 'Authorization': `Bearer ${token}` } });
        if (resFinancial.ok) {
          const fin = await resFinancial.json();
          setFinancial(fin);
        } else {
          setFinancial(null);
        }
      }
    } catch (err) {
      console.error("❌ Lỗi khi fetch báo cáo:", err);
      setData(null);
      setFinancial(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load branches khi component mount
  // Lấy role và branch từ token
  useEffect(() => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || null);
        setUserBranch(payload.branch_name || null);
        
        // Thu ngân tự động set branch của mình
        if (payload.role === 'thu_ngan' && payload.branch_name) {
          setBranch(payload.branch_name);
        }
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, []);

  // ✅ Update dates and fetch data when filter or branch changes (với debounce nhẹ)
  useEffect(() => {
    // ✅ Thêm timeout nhỏ để tránh load nhiều lần khi chuyển chi nhánh
    const timeoutId = setTimeout(() => {
      if (filter !== "Tùy chọn" && branch && predefined[filter]) {
        console.log('📊 useEffect triggered:', { filter, branch }); // Debug
        const [f, t] = predefined[filter];
        const fromDate = f.toISOString().slice(0, 10);
        const toDate = t.toISOString().slice(0, 10);
        setFrom(fromDate);
        setTo(toDate);
        fetchData(fromDate, toDate, branch);
      }
    }, 50); // Giảm xuống 50ms để responsive hơn

    return () => clearTimeout(timeoutId);
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

  const metrics = useMemo(() => {
    const fin = financial || {};
    return [
      { key: 'totalRevenue', title: 'Tổng doanh thu bán hàng', value: fin.totalRevenue || 0, icon: '💰', color: 'green', subtitle: 'Chưa trừ trả hàng' },
      { key: 'totalReturnRevenue', title: 'Tổng doanh thu trả hàng', value: fin.totalReturnRevenue || 0, icon: '↩️', color: 'red', subtitle: 'Phiếu trả hàng' },
      { key: 'netRevenue', title: 'Doanh thu thuần', value: fin.netRevenue || 0, icon: '🧮', color: 'blue', subtitle: 'Doanh thu sau trả hàng' },
      { key: 'totalExpense', title: 'Chi phí', value: fin.totalExpense || 0, icon: '💸', color: 'orange', subtitle: 'Tổng chi phí sổ quỹ' },
      { key: 'otherIncome', title: 'Thu nhập khác', value: fin.otherIncome || 0, icon: '🎯', color: 'indigo', subtitle: 'Tổng phiếu thu khác' },
      { key: 'netProfit', title: 'Lợi nhuận thuần', value: fin.netProfit || 0, icon: '📈', color: 'purple', subtitle: '= Doanh thu thuần - Chi phí + Thu khác' }
    ];
  }, [financial]);

  // Get order details
  const orders = data?.orders || data?.items || [];

  // Clear filters function
  const clearFilters = () => {
    setFilter("Tất cả"); // Đổi về "Tất cả" để hiển thị dữ liệu
    setBranch("all");
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
          <div className="text-sm font-medium text-gray-900">{order.buyer_name || order.customer_name || 'Khách lẻ'}</div>
          <div className="text-sm text-gray-500">{order.buyer_phone || order.customer_phone || 'N/A'}</div>
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
        <div className="text-sm font-semibold text-orange-600">
          {formatCurrency(order.import_price || order.price_import || order.cost || 0)}
          {(!order.import_price && !order.price_import && !order.cost) && (
            <div className="text-xs text-red-500 italic">Chưa có giá</div>
          )}
        </div>
      )
    },
    {
      header: "Giá bán",
      key: "sale_price",
      render: (order) => (
        <div className="text-sm font-semibold text-green-600">
          {formatCurrency(order.sale_price || order.price_sell || order.revenue || order.selling_price || 0)}
          {(!order.sale_price && !order.price_sell && !order.revenue && !order.selling_price) && (
            <div className="text-xs text-red-500 italic">Chưa có giá</div>
          )}
        </div>
      )
    },
    {
      header: "Số lượng",
      key: "quantity",
      render: (order) => (
        <div className="text-sm font-bold text-center">
          {order.quantity || 1}
        </div>
      )
    },
    {
      header: "Lợi nhuận",
      key: "profit",
      render: (order) => {
        const salePrice = order.sale_price || order.price_sell || order.revenue || order.selling_price || 0;
        const importPrice = order.import_price || order.price_import || order.cost || 0;
        const quantity = parseInt(order.quantity) || 1;
        const profit = (salePrice * quantity) - (importPrice * quantity);
        
        // Kiểm tra nếu thiếu dữ liệu
        if (salePrice === 0 && importPrice === 0) {
          return (
            <div className="text-sm text-red-500 italic">
              Thiếu dữ liệu giá
            </div>
          );
        }
        
        const profitMargin = salePrice > 0 ? ((profit / salePrice) * 100).toFixed(1) : 0;
        
        return (
          <div className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <div>{profit >= 0 ? '+' : ''}{formatCurrency(profit)}</div>
            <div className="text-xs font-normal text-gray-500">
              Margin: {profitMargin}%
            </div>
          </div>
        );
      }
    },
    {
      header: "Ngày bán",
      key: "sale_date", 
      render: (order) => {
        const saleDate = order.sale_date || order.sold_date || order.date;
        if (!saleDate) {
          return (
            <div className="text-sm text-red-500 italic">
              Chưa có ngày
            </div>
          );
        }
        
        try {
          const date = new Date(saleDate);
          if (isNaN(date.getTime())) {
            return (
              <div className="text-sm text-red-500 italic">
                Ngày không hợp lệ
              </div>
            );
          }
          
          return (
            <div className="text-sm text-gray-600">
              <div className="font-medium">{date.toLocaleDateString('vi-VN')}</div>
              <div className="text-xs text-gray-400">{date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          );
        } catch (err) {
          return (
            <div className="text-sm text-red-500 italic">
              Lỗi hiển thị ngày
            </div>
          );
        }
      }
    }
  ];

  if (loading && !data) {
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
      {(financial || data) && (
        <>
          {/* Hàng 6 metrics: 2 hàng x 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {metrics.slice(0,3).map(m => (
              <StatsCard key={m.key} title={m.title} value={formatCurrency(m.value)} icon={m.icon} color={m.color} subtitle={m.subtitle} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {metrics.slice(3).map(m => (
              <StatsCard key={m.key} title={m.title} value={formatCurrency(m.value)} icon={m.icon} color={m.color} subtitle={m.subtitle} />
            ))}
          </div>

          {/* Removed old stats block as requested */}
        </>
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
          {["Hôm nay", "Hôm qua", "Tuần này", "Tháng này", "Năm nay", "Tất cả", "Tùy chọn"].map((option) => (
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
          disabled={userRole === 'thu_ngan'}
        >
              <option value="all">🏢 Tất cả chi nhánh</option>
              {branches.map((branchName) => (
                <option key={branchName} value={branchName}>
                  📍 Chi nhánh {branchName}
                </option>
              ))}
        </select>
        {userRole === 'thu_ngan' && (
          <div className="text-xs text-gray-500 mt-1">Thu ngân chỉ xem báo cáo của chi nhánh được phân công</div>
        )}
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

      {/* Detailed Orders Table - Always Show */}
      {data && orders.length > 0 && (
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
