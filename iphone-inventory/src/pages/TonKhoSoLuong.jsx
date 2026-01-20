import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import FilterCard from "../components/FilterCard";
import DataTable from "../components/DataTable";

// Utility functions
function formatNumber(val) {
  if (val === undefined || val === null || val === "") return "";
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function TonKhoSoLuong() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [selectedSKU, setSelectedSKU] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null); // ✅ Lưu row hiện tại để có thể retry
  const [imeiList, setImeiList] = useState([]);
  const [imeiDetails, setImeiDetails] = useState([]);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [branches, setBranches] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [userBranch, setUserBranch] = useState(null);
  const navigate = useNavigate();

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    // ✅ Dùng endpoint báo cáo (có tính sẵn totalImport/totalSold/totalRemain)
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/report/ton-kho`, {
      headers: getAuthHeaders()
    })
      .then((res) => {
        console.log("📡 Response status:", res.status, res.statusText);
        if (!res.ok) {
          return res.json().then(err => {
            console.error("❌ API error:", err);
            throw new Error(err.message || 'API error');
          });
        }
        return res.json();
      })
      .then((res) => {
        console.log("✅ API trả về:", res);

        const grouped = {};

        // ✅ FIX: API đã tính sẵn totalSold, totalImport và totalRemain
        // Với iPhone (có IMEI): API đã filter và chỉ trả về các IMEI còn tồn kho (totalRemain > 0)
        // Với phụ kiện (không IMEI): API đã gom nhóm và tính sẵn totalRemain, chỉ trả về các nhóm còn tồn kho
        res.items.forEach((item) => {
          const importDate = item.import_date ? new Date(item.import_date) : null;
          const importMonth =
            importDate && !isNaN(importDate)
              ? `${importDate.getFullYear()}-${String(importDate.getMonth() + 1).padStart(2, "0")}`
              : "Không rõ";

          const isAccessory = !item.imei;
          
        // ✅ Gom nhóm theo SKU + tên + category + branch + tháng nhập (để khớp tổng nhập/IMEI)
          const uniqueKey = item.sku && item.sku.trim()
            ? item.sku
            : item.product_name || item.tenSanPham || `product_${item._id}`;
        const key = uniqueKey + "|" + (item.product_name || item.tenSanPham || "") + "|" + (item.category || "") + "|" + (item.branch || "") + "|" + importMonth;

          if (!grouped[key]) {
            // ✅ Dùng trực tiếp giá trị từ API (API đã tính sẵn)
            grouped[key] = {
              sku: item.sku || "Không rõ",
              tenSanPham: item.tenSanPham || item.product_name || "Không rõ",
              branch: (item.branch || "Mặc định").trim(),
              importMonth,
              category: item.category || "Không rõ",
              totalImport: item.totalImport !== undefined ? item.totalImport : 0,
              totalSold: item.totalSold !== undefined ? item.totalSold : 0,
              totalRemain: item.totalRemain !== undefined ? item.totalRemain : 0,
              imeis: [],
            };
          } else {
            // ✅ Cập nhật giá trị từ API nếu lớn hơn (đảm bảo dùng giá trị đúng của cả nhóm)
            if (item.totalImport !== undefined && item.totalImport > grouped[key].totalImport) {
              grouped[key].totalImport = item.totalImport;
            }
            if (item.totalSold !== undefined && item.totalSold > grouped[key].totalSold) {
              grouped[key].totalSold = item.totalSold;
            }
            if (item.totalRemain !== undefined && item.totalRemain > grouped[key].totalRemain) {
              grouped[key].totalRemain = item.totalRemain;
            }
          }

          // ✅ Thêm IMEI vào danh sách (chỉ với iPhone)
          if (!isAccessory && item.imei) {
            grouped[key].imeis.push(item.imei);
          }
        });

        console.log("📊 Sau khi group:", Object.keys(grouped).length, "nhóm");
        
        // ✅ API đã filter sẵn các items có totalRemain > 0, nhưng vẫn filter lại để chắc chắn
        const result = Object.values(grouped)
          .map((g) => {
            const calculatedRemain = g.totalRemain > 0 ? g.totalRemain : Math.max(0, g.totalImport - g.totalSold);
            return {
            ...g,
              // ✅ Tính lại totalRemain để đảm bảo chính xác (nếu API chưa tính đúng)
              totalRemain: calculatedRemain,
            };
          })
          .filter((g) => {
            const shouldShow = g.totalRemain > 0;
            if (!shouldShow) {
              console.log("🚫 Filtered out:", g.sku, "totalRemain:", g.totalRemain, "totalImport:", g.totalImport, "totalSold:", g.totalSold);
            }
            return shouldShow;
          }); // ✅ Chỉ hiển thị sản phẩm còn tồn kho > 0

        console.log("✅ Kết quả cuối cùng:", result.length, "items");
        setData(result);

        // ✅ Get unique branches - đảm bảo có "Mặc định" cho dữ liệu cũ
        const branchesSet = new Set();
        result.forEach(row => {
          const branch = (row.branch || "").trim();
          if (branch) {
            branchesSet.add(branch);
          } else {
            branchesSet.add("Mặc định");
          }
        });
        const allBranches = Array.from(branchesSet).sort();
        setBranches(allBranches);

        // ✅ Get unique categories - đảm bảo có "Không rõ" cho dữ liệu cũ  
        const categoriesSet = new Set();
        result.forEach(row => {
          const category = (row.category || "").trim();
          if (category) {
            categoriesSet.add(category);
          } else {
            categoriesSet.add("Không rõ");
          }
        });
        const allCategories = Array.from(categoriesSet).sort();
        setCategories(allCategories);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi:", err);
        setLoading(false);
      });
  }, []);

  // Lấy role và branch từ token
  useEffect(() => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role || null);
        setUserBranch(payload.branch_name || null);

        // Nếu là admin chi nhánh, nhân viên hoặc thu ngân, tự động set branch
        if (payload.branch_name && (
          payload.role === 'quan_ly_chi_nhanh' ||
          payload.role === 'nhan_vien_ban_hang' ||
          payload.role === 'thu_ngan' ||
          (payload.role === 'admin' && payload.branch_name)
        )) {
          setBranchFilter(payload.branch_name);
        }
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
  }, []);

  const filteredData = data.filter((row) => {
    const combined = `${row.tenSanPham} ${row.sku}`.toLowerCase();
    const matchSearch = combined.includes(search.toLowerCase());

    // ✅ Cải thiện logic filter để xử lý dữ liệu thiếu branch/category
    const matchBranch = branchFilter === "all" ||
      row.branch === branchFilter ||
      (branchFilter === "Mặc định" && (!row.branch || row.branch === ""));

    const matchCategory = categoryFilter === "all" ||
      row.category === categoryFilter ||
      (categoryFilter === "Không rõ" && (!row.category || row.category === ""));

    const matchMonth = monthFilter === "" || row.importMonth === monthFilter;
    const matchLowStock = !showLowStockOnly || row.totalRemain < 2;

    return matchSearch && matchBranch && matchMonth && matchLowStock && matchCategory;
  });

  // Stats calculation
  const totalProducts = filteredData.length;
  const totalStock = filteredData.reduce((sum, item) => sum + item.totalRemain, 0);
  const lowStockItems = filteredData.filter(item => item.totalRemain < 2).length;
  const outOfStockItems = filteredData.filter(item => item.totalRemain === 0).length;

  const stats = {
    totalProducts,
    totalStock,
    lowStockItems,
    outOfStockItems
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TonKho");
    XLSX.writeFile(workbook, "TonKho.xlsx");
  };

  const handleShowIMEI = async (row) => {
    setSelectedSKU(row.sku);
    setSelectedRow(row); // ✅ Lưu row để có thể retry
    setImeiList([]);
    setImeiDetails([]); // ✅ Reset data trước khi load

    try {
      // ✅ Fetch lại danh sách IMEI từ API để đảm bảo đầy đủ và chính xác
      console.log('🔍 Fetching IMEIs for:', row.sku, row.tenSanPham, row.branch, row.category, row.importMonth);
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/report/ton-kho`, {
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch IMEI list');
      }
      
      const data = await res.json();
      
      // ✅ Filter IMEIs theo đúng tiêu chí của row (SKU + tên + category + branch + importMonth)
      const importDate = row.importMonth && row.importMonth !== 'Không rõ' 
        ? new Date(row.importMonth + '-01') 
        : null;
      const importMonth = row.importMonth || 'Không rõ';
      
      const filteredImeis = (data.items || []).filter(item => {
        const itemImportDate = item.import_date ? new Date(item.import_date) : null;
        const itemImportMonth = itemImportDate && !isNaN(itemImportDate)
          ? `${itemImportDate.getFullYear()}-${String(itemImportDate.getMonth() + 1).padStart(2, "0")}`
          : "Không rõ";
        
        return item.imei && 
               item.sku === row.sku &&
               (item.product_name || item.tenSanPham) === row.tenSanPham &&
               (item.category || '') === (row.category || '') &&
               (item.branch || '') === (row.branch || '') &&
               itemImportMonth === importMonth &&
               item.status === 'in_stock'; // Chỉ lấy IMEI còn tồn kho
      });
      
      const imeiList = filteredImeis.map(item => item.imei).filter(Boolean);
      
      if (imeiList.length === 0) {
        console.warn('⚠️ Không có IMEI nào để hiển thị');
        setImeiList([]);
        setImeiDetails([{
          error: true,
          message: 'Không tìm thấy IMEI nào cho sản phẩm này.'
        }]);
        return;
      }
      
      setImeiList(imeiList);
      console.log('✅ Found IMEIs:', imeiList.length, imeiList);

      // Fetch detailed info for each IMEI
      const imeiDetailsPromises = imeiList.map(async (imei) => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/imei-detail/${imei}`, {
            headers: getAuthHeaders()
          });
          console.log(`📱 IMEI ${imei} response status:`, res.status); // Debug

          if (res.ok) {
            const data = await res.json();
            console.log(`📱 IMEI ${imei} data:`, data.item); // Debug
            return data.item;
          } else {
            const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
            console.warn(`⚠️ IMEI ${imei} error:`, errorData.message);
            return null;
          }
        } catch (error) {
          console.error(`❌ Error fetching IMEI ${imei}:`, error);
          return null;
        }
      });

      // ✅ Đặt timeout để tránh loading vô hạn
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000)
      );

      const details = await Promise.race([
        Promise.all(imeiDetailsPromises),
        timeoutPromise
      ]);

      const validDetails = details.filter(item => item !== null);
      console.log('✅ Valid IMEI details:', validDetails); // Debug

      setImeiDetails(validDetails);

      // ✅ Nếu không có details nào thì hiển thị thông báo
      if (validDetails.length === 0) {
        console.warn('⚠️ Không có thông tin chi tiết nào được tải');
        // Đặt một object đặc biệt để báo lỗi
        setImeiDetails([{
          error: true,
          message: 'Không thể tải thông tin chi tiết IMEI. Vui lòng thử lại.'
        }]);
      }
    } catch (err) {
      console.error('❌ Error fetching IMEI details:', err);
      // ✅ Đảm bảo luôn có feedback cho user
      setImeiDetails([{
        error: true,
        message: err.message || 'Lỗi kết nối. Vui lòng thử lại sau.'
      }]);
    }
  };

  // Clear filters function
  const clearFilters = () => {
    setSearch("");
    setBranchFilter("all");
    setMonthFilter("");
    setCategoryFilter("all");
    setShowLowStockOnly(false);
  };

  // Table columns definition
  const tableColumns = [
    {
      header: "Sản phẩm",
      key: "product",
      render: (row) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">{row.tenSanPham}</div>
          <div className="text-sm text-gray-500">SKU: {row.sku}</div>
        </div>
      )
    },
    {
      header: "Chi nhánh",
      key: "branch",
      render: (row) => (
        <span className="badge-blue text-xs">{row.branch}</span>
      )
    },
    {
      header: "Danh mục",
      key: "category",
      render: (row) => (
        <span className="badge-purple text-xs">{row.category}</span>
      )
    },
    {
      header: "Tháng nhập",
      key: "importMonth",
      render: (row) => (
        <div className="text-sm text-gray-600">{row.importMonth}</div>
      )
    },
    {
      header: "Tổng nhập",
      key: "totalImport",
      render: (row) => (
        <div className="text-sm font-semibold text-blue-600">{formatNumber(row.totalImport)}</div>
      )
    },
    {
      header: "Đã bán",
      key: "totalSold",
      render: (row) => (
        <div className="text-sm font-semibold text-green-600">{formatNumber(row.totalSold)}</div>
      )
    },
    {
      header: "Tồn kho",
      key: "totalRemain",
      render: (row) => {
        let colorClass = "text-green-600";
        let icon = "✅";

        if (row.totalRemain === 0) {
          colorClass = "text-red-600";
          icon = "❌";
        } else if (row.totalRemain < 2) {
          colorClass = "text-orange-600";
          icon = "⚠️";
        }

        return (
          <div className={`text-sm font-bold ${colorClass}`}>
            {icon} {formatNumber(row.totalRemain)}
          </div>
        );
      }
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (row) => {
        // ✅ Hiển thị số IMEI dựa trên totalRemain (khớp với tổng nhập - đã bán)
        // Với sản phẩm có IMEI: totalRemain = số lượng IMEI còn tồn kho
        // Với phụ kiện: không hiển thị nút IMEI
        const hasImei = row.imeis && row.imeis.length > 0;
        const imeiCount = hasImei ? row.totalRemain : 0;
        
        return (
          <div className="flex gap-2">
            {hasImei && imeiCount > 0 && (
              <button
                onClick={() => handleShowIMEI(row)}
                className="btn-action-edit text-xs"
              >
                📱 IMEI ({imeiCount})
              </button>
            )}
          </div>
        );
      }
    }
  ];

  if (loading) {
    return (
      <Layout
        activeTab="ton-kho"
        title="📦 Tồn Kho"
        subtitle="Theo dõi số lượng tồn kho"
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải dữ liệu tồn kho...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      activeTab="ton-kho"
      title="📦 Tồn Kho"
      subtitle="Theo dõi số lượng tồn kho"
    >
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Tổng sản phẩm"
          value={stats.totalProducts.toString()}
          icon="📦"
          color="blue"
          subtitle="Loại sản phẩm"
        />
        <StatsCard
          title="Tổng tồn kho"
          value={formatNumber(stats.totalStock)}
          icon="📊"
          color="green"
          subtitle="Số lượng còn lại"
        />
        <StatsCard
          title="Sắp hết hàng"
          value={stats.lowStockItems.toString()}
          icon="⚠️"
          color="orange"
          subtitle="Dưới 2 sản phẩm"
        />
        <StatsCard
          title="Hết hàng"
          value={stats.outOfStockItems.toString()}
          icon="❌"
          color="red"
          subtitle="Cần nhập thêm"
        />
      </div>

      {/* Filters */}
      <FilterCard onClearFilters={clearFilters}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <input
              type="text"
              placeholder="🔍 Tìm tên hoặc SKU..."
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <select
              className="form-input"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={
                (userRole === 'admin' && userBranch) ||
                userRole === 'quan_ly_chi_nhanh' ||
                userRole === 'nhan_vien_ban_hang' ||
                userRole === 'thu_ngan'
              }
              style={{
                cursor: ((userRole === 'admin' && userBranch) || userRole === 'quan_ly_chi_nhanh' || userRole === 'nhan_vien_ban_hang' || userRole === 'thu_ngan') ? 'not-allowed' : 'pointer',
                opacity: ((userRole === 'admin' && userBranch) || userRole === 'quan_ly_chi_nhanh' || userRole === 'nhan_vien_ban_hang' || userRole === 'thu_ngan') ? 0.6 : 1
              }}
            >
              <option value="all">🏢 Tất cả chi nhánh</option>
              {/* Admin tổng thấy tất cả, admin chi nhánh chỉ thấy chi nhánh của mình */}
              {((userRole === 'admin' && !userBranch) ? branches : (userBranch ? branches.filter(b => b === userBranch) : branches)).map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="form-input"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">📁 Tất cả danh mục</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="month"
              className="form-input"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Chỉ hàng sắp hết</span>
            </label>
          </div>
          <div>
            <button
              onClick={exportToExcel}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-xl transition-all font-medium text-sm"
            >
              📊 Xuất Excel
            </button>
          </div>
        </div>
      </FilterCard>

      {/* Data Table */}
      <DataTable
        title="📋 Báo cáo tồn kho chi tiết"
        data={filteredData.map((item, index) => ({ ...item, id: index }))}
        columns={tableColumns}
        currentPage={1}
        totalPages={1}
        itemsPerPage={filteredData.length}
        totalItems={filteredData.length}
      />

      {/* IMEI Detail Modal */}
      {selectedSKU && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-6xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">📱 Chi tiết IMEI - SKU: {selectedSKU}</h3>
              <div className="text-sm text-gray-600">
                Tổng cộng: <span className="font-semibold text-blue-600">{imeiList.length}</span> IMEI
              </div>
            </div>

            {imeiList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Không có IMEI nào để hiển thị.</p>
              </div>
            ) : imeiDetails.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Đang tải thông tin chi tiết...</p>
                <p className="text-xs text-gray-400 mt-2">Tải {imeiList.length} IMEI...</p>
              </div>
            ) : imeiDetails.length === 1 && imeiDetails[0].error ? (
              <div className="text-center py-8">
                <div className="text-red-500 text-6xl mb-4">⚠️</div>
                <p className="text-red-600 font-semibold mb-2">Lỗi tải dữ liệu</p>
                <p className="text-gray-600 mb-4">{imeiDetails[0].message}</p>
                <button
                  onClick={() => {
                    // ✅ Dùng lại row đã lưu để retry
                    if (selectedRow) {
                      handleShowIMEI(selectedRow);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all"
                >
                  🔄 Thử lại
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">IMEI</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tên sản phẩm</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Chi nhánh</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Giá nhập</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Ngày nhập</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Nhà cung cấp</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imeiDetails.filter(item => !item.error).map((item, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm font-semibold text-blue-600">{item.imei}</div>
                          <div className="text-xs text-gray-400 mt-1">#{item._id?.slice(-6) || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">{item.product_name || item.tenSanPham}</div>
                          <div className="text-xs text-gray-500">{item.category}</div>
                          {item.sku && <div className="text-xs text-blue-500">SKU: {item.sku}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            🏢 {item.branch || 'Không rõ'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-green-600">
                            {formatNumber(item.price_import || 0)}đ
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600">
                            {item.import_date ? new Date(item.import_date).toLocaleDateString('vi-VN') : 'Không rõ'}
                          </div>
                          {item.import_date && (
                            <div className="text-xs text-gray-400">
                              {new Date(item.import_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700">{item.supplier || 'Không rõ'}</div>
                          {item.note && (
                            <div className="text-xs text-gray-500 italic">{item.note}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.status === 'sold'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                            }`}>
                            {item.status === 'sold' ? '✅ Đã bán' : '📦 Tồn kho'}
                          </span>
                          {item.status === 'sold' && (
                            <div className="text-xs text-gray-500 mt-1 space-y-1">
                              {item.sold_date && (
                                <div>📅 Bán: {new Date(item.sold_date).toLocaleDateString('vi-VN')}</div>
                              )}
                              {item.customer_name && (
                                <div>👤 KH: {item.customer_name}</div>
                              )}
                              {item.sale_price && (
                                <div className="text-green-600 font-semibold">
                                  💰 Giá bán: {formatNumber(item.sale_price)}đ
                                </div>
                              )}
                              {item.sale_price && item.price_import && (
                                <div className="text-blue-600 font-semibold">
                                  📈 Lợi nhuận: +{formatNumber(item.sale_price - item.price_import)}đ
                                </div>
                              )}
                            </div>
                          )}
                          {item.status !== 'sold' && (
                            <div className="text-xs text-green-600 mt-1">
                              🏪 Có sẵn tại {item.branch || 'cửa hàng'}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setSelectedSKU(null);
                  setSelectedRow(null); // ✅ Reset row khi đóng
                  setImeiList([]);
                  setImeiDetails([]);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition-all"
              >
                ❌ Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default TonKhoSoLuong;
