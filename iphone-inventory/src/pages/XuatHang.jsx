import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import FormCard from "../components/FormCard";
import FilterCard from "../components/FilterCard";
import DataTable from "../components/DataTable";

// Utility functions
const getToday = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

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

function parseNumber(val) {
  if (!val) return "";
  return val.toString().replace(/\s/g, "");
}

function XuatHang() {
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  
  const getLocalBranch = () => localStorage.getItem('lastBranch') || "";

  const [formData, setFormData] = useState({
    item_id: "",
    imei: "",
    product_name: "",
    sku: "",
    quantity: "1",
    warranty: "",
    sale_price: "",
    sale_date: getToday(),
    buyer_name: "",
    buyer_phone: "",
    branch: getLocalBranch(),
    note: "",
    source: "tien_mat"
  });

  const [message, setMessage] = useState("");
  const [soldItems, setSoldItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBuyer, setFilterBuyer] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  const [editingItemId, setEditingItemId] = useState(null);

  // ✅ Thêm states cho autocomplete
  const [suggestList, setSuggestList] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  
  // ✅ Thêm state để track phụ kiện
  const [isAccessory, setIsAccessory] = useState(false);

  // Stats calculation
  const stats = {
    totalSold: soldItems.length,
    totalRevenue: soldItems.reduce((sum, item) => sum + (parseFloat(item.sale_price) || 0), 0),
    todaySales: soldItems.filter(item => item.sale_date?.slice(0, 10) === getToday()).length,
    availableStock: availableItems.length
  };

  // API functions
  const fetchAvailableItems = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const res = await fetch(`${apiUrl}/api/nhap-hang`);
      
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      
      const data = await res.json();
      if (!data.items) return;
      
      const available = data.items.filter(item => item.status !== 'sold');
      setAvailableItems(available);
    } catch (err) {
      console.error("❌ Lỗi khi tải sản phẩm khả dụng:", err);
    }
  };

  const fetchSoldItems = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const res = await fetch(`${apiUrl}/api/xuat-hang-list`);
      
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      
      const data = await res.json();
      if (!data.items) return;
      
      const sorted = data.items.sort((a, b) => {
        const dateA = a.sale_date || '';
        const dateB = b.sale_date || '';
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
        return b._id.localeCompare(a._id);
      });
      
      setSoldItems(sorted);
    } catch (err) {
      console.error("❌ Lỗi khi tải dữ liệu đã bán:", err);
    }
  };

  const fetchBranches = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const res = await fetch(`${apiUrl}/api/branches`);
      const data = await res.json();
      setBranches(data);
    } catch (err) {
      console.error('❌ Lỗi fetch branches:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const res = await fetch(`${apiUrl}/api/categories`);
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error('❌ Lỗi fetch categories:', err);
    }
  };

  useEffect(() => {
    fetchSoldItems();
    fetchAvailableItems();
    fetchBranches();
    fetchCategories();
  }, []);

  // ✅ Thêm function để fetch suggestion list cho autocomplete
  const fetchSuggestList = async (query) => {
    if (!query || query.length < 2) {
      setSuggestList([]);
      setShowSuggest(false);
      return;
    }
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ton-kho`);
      const data = await res.json();
      const lowerQuery = query.trim().toLowerCase();
      
      const filtered = (data.items || []).filter(
        item =>
          (item.product_name || item.tenSanPham || "")
            .toLowerCase()
            .includes(lowerQuery) ||
          (item.sku || "").toLowerCase().includes(lowerQuery)
      );
      
      // Gom nhóm sản phẩm
      const group = {};
      filtered.forEach(item => {
        const key = (item.product_name || item.tenSanPham || "Không rõ") + "_" + (item.sku || "Không rõ");
        if (!group[key]) {
          group[key] = {
            name: item.product_name || item.tenSanPham || "Không rõ",
            sku: item.sku || "",
            imeis: [],
            soLuong: 0,
            isAccessory: !item.imei,
            price_import: item.price_import || 0
          };
        }
        if (item.imei) {
          group[key].imeis.push(item.imei);
        } else {
          group[key].soLuong += Number(item.soLuongConLai || item.quantity || 1);
        }
      });
      
      setSuggestList(Object.values(group));
      setShowSuggest(true);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setSuggestList([]);
      setShowSuggest(false);
    }
  };

  // ✅ Thêm function để handle khi nhập tên sản phẩm
  const handleProductNameChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, product_name: value }));
    fetchSuggestList(value);
  };

  // ✅ Thêm function để chọn suggestion
  const handleSelectSuggest = (item) => {
    setFormData(prev => ({
      ...prev,
      product_name: item.name,
      sku: item.sku,
      imei: item.isAccessory ? "" : (item.imeis.length === 1 ? item.imeis[0] : ""),
    }));
    
    // Set trạng thái phụ kiện
    setIsAccessory(item.isAccessory);
    
    setShowSuggest(false);
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    if (name === "branch") localStorage.setItem('lastBranch', value);
    
    if (name === "sale_price") {
      // Giữ nguyên giá trị đã format để hiển thị, nhưng lưu số nguyên vào state
      const cleanNumber = parseNumber(value);
      setFormData((prev) => ({ ...prev, [name]: cleanNumber }));
    } else if (name === "imei" && value.trim()) {
      // Auto-fill product info when IMEI is entered
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/find-by-imei?imei=${value.trim()}`);
        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({ 
            ...prev, 
            imei: value,
            item_id: data._id,
            product_name: data.product_name || data.tenSanPham || "",
            sku: data.sku || "",
            sale_price: prev.sale_price || data.price_sell || ""
          }));
        } else {
          setFormData((prev) => ({ ...prev, [name]: value }));
        }
      } catch (err) {
        console.error("Error fetching product by IMEI:", err);
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setFormData({
      item_id: "",
      imei: "",
      product_name: "",
      sku: "",
      quantity: "1",
      warranty: "",
      sale_price: "",
      sale_date: getToday(),
      buyer_name: "",
      buyer_phone: "",
      branch: formData.branch,
      note: "",
      source: "tien_mat"
    });
    setEditingItemId(null);
    setIsAccessory(false); // Reset trạng thái phụ kiện
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingItemId ? "PUT" : "POST";
      const url = editingItemId
        ? `${import.meta.env.VITE_API_URL}/api/xuat-hang/${editingItemId}`
        : `${import.meta.env.VITE_API_URL}/api/xuat-hang`;

      // Prepare data for API
      const salePriceNumber = parseInt(parseNumber(formData.sale_price)) || 0;
      
      const apiData = {
        imei: isAccessory ? "" : formData.imei, // Phụ kiện không cần IMEI
        sku: formData.sku,
        product_name: formData.product_name,
        quantity: parseInt(formData.quantity) || 1,
        warranty: formData.warranty,
        price_sell: salePriceNumber, // ✅ Backend expects price_sell
        customer_name: formData.buyer_name, // ✅ Backend expects customer_name
        customer_phone: formData.buyer_phone, // ✅ Backend expects customer_phone
        branch: formData.branch,
        note: formData.note,
        source: formData.source,
        sold_date: formData.sale_date, // ✅ Backend expects sold_date
        is_accessory: isAccessory, // Thêm flag để backend biết đây là phụ kiện
        debt: 0 // ✅ Thêm debt field mặc định
      };

      // Debug logging cho giá bán
      console.log('💰 Sale Price Debug:', {
        formValue: formData.sale_price,
        parsedNumber: parseNumber(formData.sale_price),
        finalNumber: salePriceNumber
      });

      // ✅ Debug logging
      if (editingItemId) {
        console.log('🔄 EDIT mode - Submitting PUT request');
        console.log('EditingID:', editingItemId);
        console.log('API URL:', url);
        console.log('API Data:', apiData);
      } else {
        console.log('🆕 CREATE mode - Submitting POST request');
        console.log('API Data:', apiData);
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData)
      });

      const data = await res.json();
      if (res.ok) {
        console.log('✅ API Response success:', data);
        setMessage(`✅ ${data.message}`);
        resetForm();
        fetchSoldItems(); // This should refresh the list with updated data
        fetchAvailableItems();
        setTimeout(() => setMessage(""), 3000);
      } else {
        console.error('❌ API Response error:', data);
        setMessage(`❌ ${data.message}`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ Lỗi kết nối tới server");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleEdit = (item) => {
    console.log('✏️ EDIT clicked - Item data:', item); // Debug
    
    // Cải thiện cách lấy dữ liệu để edit (thêm price_sell từ ExportHistory)
    const salePrice = item.sale_price || item.selling_price || item.price_sell || "";
    const editFormData = {
      item_id: item.item_id || item.item?._id || "",
      imei: item.item?.imei || item.imei || "",
      product_name: item.item?.product_name || item.item?.tenSanPham || item.product_name || "",
      sku: item.item?.sku || item.sku || "",
      quantity: item.quantity || "1",
      warranty: item.warranty || "",
      sale_price: salePrice.toString(), // Đảm bảo là string để hiển thị đúng
      sale_date: item.sale_date?.slice(0, 10) || getToday(),
      buyer_name: item.buyer_name || "",
      buyer_phone: item.buyer_phone || "",
      branch: item.branch || "",
      note: item.note || "",
      source: item.source || "tien_mat"
    };
    
    console.log('✏️ Setting form data for edit:', editFormData); // Debug
    console.log('✏️ Original sale_price:', item.sale_price, 'Formatted:', salePrice); // Debug
    
    setFormData(editFormData);
    setEditingItemId(item._id);
    
    // Set trạng thái phụ kiện dựa trên IMEI (nếu không có IMEI thì có thể là phụ kiện)
    setIsAccessory(item.is_accessory || (!item.item?.imei && !item.imei));
    
    setMessage(""); // Clear any previous messages
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này? Hành động này không thể hoàn tác.")) return;
    
    setMessage("🔄 Đang xóa giao dịch...");
    
    try {
      console.log('🗑️ DELETE request for ID:', id); // Debug
      
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/xuat-hang/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      const data = await res.json();
      console.log('🗑️ DELETE response:', data); // Debug
      
      if (res.ok) {
        setMessage("✅ Đã xóa giao dịch thành công");
        
        // Refresh data
        await Promise.all([
          fetchSoldItems(),
          fetchAvailableItems()
        ]);
        
        // Reset editing state if we're deleting the item being edited
        if (editingItemId === id) {
          resetForm();
        }
        
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`❌ Lỗi xóa: ${data.message || 'Không thể xóa giao dịch'}`);
        setTimeout(() => setMessage(""), 5000);
      }
    } catch (err) {
      console.error('❌ Delete error:', err);
      setMessage("❌ Lỗi kết nối khi xóa giao dịch");
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // Clear filters function
  const clearFilters = () => {
    setSearch("");
    setFilterDate("");
    setFilterBranch("");
    setFilterCategory("");
    setFilterBuyer("");
  };

  // Filter and pagination
  const filteredItems = soldItems.filter((item) => {
    const matchSearch =
      item.item?.imei?.toLowerCase().includes(search.toLowerCase()) ||
      item.item?.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.item?.sku?.toLowerCase().includes(search.toLowerCase()) ||
      item.buyer_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.buyer_phone?.toLowerCase().includes(search.toLowerCase()) ||
      item.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.customer_phone?.toLowerCase().includes(search.toLowerCase());
    const matchDate = filterDate ? item.sale_date?.slice(0, 10) === filterDate : true;
    const matchBranch = filterBranch ? item.branch === filterBranch : true;
    const matchCategory = filterCategory ? item.item?.category === filterCategory : true;
    const matchBuyer = filterBuyer ? 
      (item.buyer_name?.toLowerCase().includes(filterBuyer.toLowerCase()) ||
       item.buyer_phone?.toLowerCase().includes(filterBuyer.toLowerCase()) ||
       item.customer_name?.toLowerCase().includes(filterBuyer.toLowerCase()) ||
       item.customer_phone?.toLowerCase().includes(filterBuyer.toLowerCase())) : true;
    return matchSearch && matchDate && matchBranch && matchCategory && matchBuyer;
  });

  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Table columns definition
  const tableColumns = [
    {
      header: "Sản phẩm",
      key: "item",
      render: (item) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {item.item?.product_name || item.item?.tenSanPham}
          </div>
          <div className="text-sm text-gray-500">
            IMEI: {item.item?.imei || 'N/A'} • SKU: {item.item?.sku}
          </div>
          <div className="text-xs text-gray-400">
            {item.item?.category} • {item.branch}
          </div>
        </div>
      )
    },
    {
      header: "Giá bán",
      key: "sale_price",
      render: (item) => {
        // ✅ Cải thiện logic parse giá bán (thêm price_sell từ ExportHistory)
        const rawPrice = item.sale_price || item.selling_price || item.price_sell || 0;
        const salePrice = parseFloat(rawPrice) || 0;
        return (
          <div className="text-sm font-bold text-green-600">
            {salePrice > 0 ? formatCurrency(salePrice) : (
              <span className="text-red-500 italic">Chưa có giá</span>
            )}
            {/* Debug info đã tắt */}
          </div>
        );
      }
    },
    {
      header: "Ngày bán",
      key: "sale_date",
      render: (item) => (
        <div className="text-sm text-gray-500">
          {item.sale_date?.slice(0, 10)}
        </div>
      )
    },
    {
      header: "Số lượng",
      key: "quantity",
      render: (item) => (
        <div className="text-sm font-bold text-center">
          {item.quantity || 1}
        </div>
      )
    },
    {
      header: "Khách hàng",
      key: "buyer",
      render: (item) => {
        // ✅ Cải thiện mapping để lấy đúng data từ nhiều nguồn field
        const buyerName = item.buyer_name || item.customer_name || '';
        const buyerPhone = item.buyer_phone || item.customer_phone || '';
        
        return (
        <div>
          <div className="text-sm font-medium text-gray-900">
              {buyerName || <span className="text-gray-400 italic">Chưa có</span>}
          </div>
          <div className="text-sm text-gray-500">
              {buyerPhone || <span className="text-gray-400 italic">Chưa có SĐT</span>}
          </div>
            {/* Debug info đã tắt để tránh hiển thị thông tin nhạy cảm */}
        </div>
        );
      }
    },
    {
      header: "Nguồn tiền",
      key: "source",
      render: (item) => {
        const sourceMap = {
          'tien_mat': { label: 'Tiền mặt', color: 'green', icon: '💵' },
          'the': { label: 'Thẻ', color: 'blue', icon: '💳' },
          'vi_dien_tu': { label: 'Ví điện tử', color: 'purple', icon: '📱' },
          'cong_no': { label: 'Công nợ', color: 'orange', icon: '📝' }
        };
        const source = sourceMap[item.source] || sourceMap.tien_mat;
        return (
          <span className={`badge-${source.color}`}>
            {source.icon} {source.label}
          </span>
        );
      }
    },
    {
      header: "Ghi chú",
      key: "note",
      render: (item) => (
        <div className="text-sm text-gray-500 max-w-xs truncate">
          {item.note || <span className="text-gray-400 italic">Không có</span>}
        </div>
      )
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (item) => (
        <div className="flex gap-2">
          <button 
            onClick={() => handleEdit(item)} 
            className="btn-action-edit text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            title="Chỉnh sửa giao dịch"
          >
            ✏️ Sửa
          </button>
          <button 
            onClick={() => handleDelete(item._id)} 
            className="btn-action-delete text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
            title="Xóa giao dịch"
          >
            🗑️ Xóa
          </button>
        </div>
      )
    }
  ];

  return (
    <Layout 
      activeTab="xuat-hang"
      title="📤 Xuất Hàng"
      subtitle="Quản lý bán hàng và theo dõi doanh thu"
    >
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Tổng đã bán"
          value={stats.totalSold.toLocaleString()}
          icon="✅"
          color="green"
          subtitle="Sản phẩm đã xuất"
        />
        <StatsCard
          title="Doanh thu"
          value={formatCurrency(stats.totalRevenue)}
          icon="💰"
          color="blue"
          subtitle="Tổng tiền thu được"
        />
        <StatsCard
          title="Bán hôm nay"
          value={stats.todaySales.toLocaleString()}
          icon="📊"
          color="purple"
          subtitle="Sản phẩm bán hôm nay"
        />
        <StatsCard
          title="Còn tồn kho"
          value={stats.availableStock.toLocaleString()}
          icon="📦"
          color="orange"
          subtitle="Sản phẩm còn lại"
        />
      </div>

      {/* Form Card */}
      <FormCard
        title={editingItemId ? '✏️ Chỉnh sửa giao dịch' : '➕ Thêm giao dịch bán hàng'}
        subtitle="Chọn sản phẩm và điền thông tin khách hàng"
        onReset={resetForm}
        showReset={!!editingItemId}
        resetLabel="Hủy chỉnh sửa"
        message={message}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Checkbox phụ kiện */}
          <div className="lg:col-span-3">
            <label className="flex items-center space-x-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <input
                type="checkbox"
                checked={isAccessory}
                onChange={(e) => {
                  setIsAccessory(e.target.checked);
                  if (e.target.checked) {
                    setFormData(prev => ({ ...prev, imei: "" }));
                  }
                }}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-semibold text-blue-900">🔧 Đây là phụ kiện</span>
                <p className="text-xs text-blue-700">Phụ kiện không cần IMEI (tai nghe, sạc, ốp lưng...)</p>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              IMEI {!isAccessory && "*"}
              {isAccessory && <span className="text-blue-500 text-xs">(Không bắt buộc cho phụ kiện)</span>}
            </label>
            <input
              name="imei"
              placeholder={isAccessory ? "Phụ kiện không cần IMEI" : "Nhập IMEI để tự động điền thông tin"}
              value={formData.imei}
              onChange={handleChange}
              className={`form-input ${isAccessory ? 'bg-gray-100 text-gray-500' : ''}`}
              required={!isAccessory}
              disabled={isAccessory}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Tên sản phẩm *</label>
            <div className="relative">
              <input
                name="product_name"
                placeholder="Nhập 2-4 chữ để tìm sản phẩm..."
                value={formData.product_name}
                onChange={handleProductNameChange}
                className="form-input"
                required
                autoComplete="off"
              />
              
              {/* ✅ Thêm dropdown gợi ý sản phẩm */}
              {showSuggest && suggestList.length > 0 && (
                <div className="absolute z-50 left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1">
                  {suggestList.map((item, idx) => (
                    <div
                      key={item.sku + idx}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleSelectSuggest(item)}
                    >
                      <div className="font-medium text-blue-600 text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        SKU: {item.sku} • 
                        {item.isAccessory 
                          ? ` SL còn: ${item.soLuong}` 
                          : ` IMEI có sẵn: ${item.imeis.length}`
                        }
                        {item.price_import > 0 && ` • Giá nhập: ${formatCurrency(item.price_import)}`}
                      </div>
                      {!item.isAccessory && item.imeis.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          IMEI: {item.imeis.slice(0, 3).join(", ")}{item.imeis.length > 3 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">SKU *</label>
            <input
              name="sku"
              placeholder="SKU sản phẩm (tự động điền)"
              value={formData.sku}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Số lượng *</label>
            <input
              name="quantity"
              type="number"
              min="1"
              placeholder="1"
              value={formData.quantity}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Bảo hành</label>
            <input
              name="warranty"
              placeholder="VD: 12 tháng"
              value={formData.warranty}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Chọn sản phẩm từ danh sách (tuỳ chọn)</label>
            <select
              name="item_id"
              value={formData.item_id}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">-- Hoặc chọn từ danh sách --</option>
              {availableItems.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.product_name || item.tenSanPham} - {item.imei} - {formatNumber(item.price_import)}đ
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Giá bán *</label>
            <input
              name="sale_price"
              type="text"
              placeholder="0"
              value={formatNumber(formData.sale_price)}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Ngày bán *</label>
            <input
              name="sale_date"
              type="date"
              value={formData.sale_date}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Tên khách hàng</label>
            <input
              name="buyer_name"
              placeholder="Họ tên khách hàng"
              value={formData.buyer_name}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Số điện thoại</label>
            <input
              name="buyer_phone"
              placeholder="Số điện thoại"
              value={formData.buyer_phone}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Chi nhánh *</label>
            <select 
              name="branch" 
              value={formData.branch} 
              onChange={handleChange} 
              className="form-input"
              required
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((b) => (
                <option key={b._id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Nguồn tiền *</label>
            <select 
              name="source" 
              value={formData.source} 
              onChange={handleChange} 
              className="form-input"
              required
            >
              <option value="tien_mat">💵 Tiền mặt</option>
              <option value="the">💳 Thẻ</option>
              <option value="vi_dien_tu">📱 Ví điện tử</option>
              <option value="cong_no">📝 Công nợ</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Ghi chú</label>
            <input
              name="note"
              placeholder="Ghi chú thêm về giao dịch"
              value={formData.note}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <button 
              type="submit" 
              className="w-full btn-gradient text-white py-4 px-8 rounded-2xl font-bold text-lg transition-all duration-300"
            >
              {editingItemId ? "🔄 Cập nhật giao dịch" : "💰 Thực hiện bán hàng"}
            </button>
          </div>
        </form>
      </FormCard>

      {/* Filters */}
      <FilterCard onClearFilters={clearFilters}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <input
              type="text"
              placeholder="🔍 Tìm sản phẩm, khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="form-input"
            >
              <option value="">Tất cả chi nhánh</option>
              {branches.map((b) => (
                <option key={b._id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="form-input"
            >
              <option value="">Tất cả thư mục</option>
              {categories.map((c) => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="text"
              placeholder="Tên khách hàng"
              value={filterBuyer}
              onChange={(e) => setFilterBuyer(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </FilterCard>

      {/* Data Table */}
      <DataTable
        title="💰 Lịch sử giao dịch bán hàng"
        data={paginatedItems.map(item => ({ ...item, id: item._id }))}
        columns={tableColumns}
        currentPage={page}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={filteredItems.length}
        onPageChange={setPage}
      />
    </Layout>
  );
}

export default XuatHang;
