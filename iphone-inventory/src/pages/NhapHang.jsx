import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import FormCard from "../components/FormCard";
import FilterCard from "../components/FilterCard";
import DataTable from "../components/DataTable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

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

function NhapHang() {
  // State management
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const getLocalBranch = () => localStorage.getItem('lastBranch') || "";
  const getLocalCategory = () => localStorage.getItem('lastCategory') || "";

  const [formData, setFormData] = useState({
    imei: "",
    product_name: "",
    sku: "",
    price_import: "",
    import_date: getToday(),
    supplier: "",
    branch: getLocalBranch(),
    note: "",
    tenSanPham: "",
    quantity: "",
    category: getLocalCategory(),
    source: "tien_mat"
  });

  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterBranch, setFilterBranch] = useState("");  
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  const [editingItemId, setEditingItemId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [branchModal, setBranchModal] = useState({ open: false, type: 'add', data: null });
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '', note: '' });

  // Stats calculation
  const stats = {
    totalItems: items.length,
    totalValue: items.reduce((sum, item) => sum + (item.price_import * (item.quantity || 1)), 0),
    soldItems: items.filter(item => item.status === 'sold').length,
    inStock: items.filter(item => item.status !== 'sold').length
  };

  // API functions
  const fetchItems = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const res = await fetch(`${apiUrl}/api/nhap-hang`);
      
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      
      const data = await res.json();
      if (!data.items) return;
      
      const sorted = data.items.sort((a, b) => {
        const dateA = a.import_date || '';
        const dateB = b.import_date || '';
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
        return b._id.localeCompare(a._id);
      });
      
      setItems(sorted);
    } catch (err) {
      console.error("❌ Lỗi khi tải dữ liệu:", err);
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
    fetchItems();
    fetchBranches();
    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "branch") localStorage.setItem('lastBranch', value);
    if (name === "category") localStorage.setItem('lastCategory', value);
    if (name === "price_import") {
      setFormData((prev) => ({ ...prev, [name]: parseNumber(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setFormData({
      imei: "",
      product_name: "",
      sku: "",
      price_import: "",
      import_date: getToday(),
      supplier: "",
      branch: formData.branch,
      note: "",
      tenSanPham: "",
      quantity: "",
      category: formData.category,
      source: "tien_mat"
    });
    setEditingItemId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingItemId ? "PUT" : "POST";
      const url = editingItemId
        ? `${import.meta.env.VITE_API_URL}/api/nhap-hang/${editingItemId}`
        : `${import.meta.env.VITE_API_URL}/api/nhap-hang`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, tenSanPham: formData.product_name || formData.tenSanPham })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        resetForm();
        fetchItems();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`❌ ${data.message}`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ Lỗi kết nối tới server");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      imei: item.imei || "",
      product_name: item.product_name || item.tenSanPham || "",
      sku: item.sku || "",
      price_import: item.price_import || "",
      import_date: item.import_date?.slice(0, 10) || getToday(),
      supplier: item.supplier || "",
      branch: item.branch || "",
      note: item.note || "",
      tenSanPham: item.tenSanPham || item.product_name || "",
      quantity: item.quantity || "",
      category: item.category || "",
      source: item.source || "tien_mat"
    });
    setEditingItemId(item._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/nhap-hang/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage("✅ Đã xóa thành công");
        fetchItems();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`❌ ${data.message}`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ Lỗi khi xóa");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Clear filters function
  const clearFilters = () => {
    setSearch("");
    setFilterDate("");
    setFilterBranch("");
    setFilterCategory("");
    setFilterSupplier("");
  };

  // Export to Excel function
  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredItems.map(item => ({
        "IMEI": item.imei || "",
        "Tên sản phẩm": item.product_name || item.tenSanPham || "",
        "SKU": item.sku || "",
        "Giá nhập": item.price_import || 0,
        "Ngày nhập": item.import_date ? new Date(item.import_date).toLocaleDateString('vi-VN') : "",
        "Nhà cung cấp": item.supplier || "",
        "Chi nhánh": item.branch || "",
        "Thư mục": item.category || "",
        "Số lượng": item.quantity || 1,
        "Ghi chú": item.note || "",
        "Trạng thái": item.status === 'sold' ? 'Đã bán' : 'Tồn kho'
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      const colWidths = [
        { wch: 15 }, // IMEI
        { wch: 30 }, // Tên sản phẩm
        { wch: 15 }, // SKU
        { wch: 12 }, // Giá nhập
        { wch: 12 }, // Ngày nhập
        { wch: 20 }, // Nhà cung cấp
        { wch: 15 }, // Chi nhánh
        { wch: 15 }, // Thư mục
        { wch: 10 }, // Số lượng
        { wch: 25 }, // Ghi chú
        { wch: 12 }  // Trạng thái
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Danh sách nhập hàng");
      
      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `DanhSachNhapHang_${dateStr}.xlsx`;
      
      // Save file
      XLSX.writeFile(wb, filename);
      
      setMessage("✅ Đã xuất file Excel thành công!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("❌ Lỗi khi xuất Excel:", err);
      setMessage("❌ Lỗi khi xuất Excel");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Import from Excel function
  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setMessage("🔄 Đang xử lý file Excel...");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setMessage("❌ File Excel không có dữ liệu");
        setImporting(false);
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        // Map Excel columns to form data
        const importData = {
          imei: row['IMEI'] || row['imei'] || "",
          product_name: row['Tên sản phẩm'] || row['Ten san pham'] || row['product_name'] || "",
          sku: row['SKU'] || row['sku'] || "",
          price_import: row['Giá nhập'] || row['Gia nhap'] || row['price_import'] || "",
          import_date: row['Ngày nhập'] || row['Ngay nhap'] || row['import_date'] || getToday(),
          supplier: row['Nhà cung cấp'] || row['Nha cung cap'] || row['supplier'] || "",
          branch: row['Chi nhánh'] || row['Chi nhanh'] || row['branch'] || formData.branch,
          note: row['Ghi chú'] || row['Ghi chu'] || row['note'] || "",
          quantity: row['Số lượng'] || row['So luong'] || row['quantity'] || "1",
          category: row['Thư mục'] || row['Thu muc'] || row['category'] || formData.category,
          source: row['Nguồn tiền'] || row['Nguon tien'] || row['source'] || "tien_mat"
        };

        // Validate required fields
        if (!importData.product_name || !importData.price_import || !importData.branch) {
          errors.push(`Hàng ${i + 1}: Thiếu thông tin bắt buộc (Tên sản phẩm, Giá nhập, Chi nhánh)`);
          errorCount++;
          continue;
        }

        // Convert date format if needed
        if (importData.import_date && typeof importData.import_date === 'number') {
          const excelDate = new Date((importData.import_date - 25569) * 86400 * 1000);
          importData.import_date = excelDate.toISOString().slice(0, 10);
        } else if (importData.import_date && typeof importData.import_date === 'string') {
          // Try to parse different date formats
          const dateObj = new Date(importData.import_date);
          if (!isNaN(dateObj.getTime())) {
            importData.import_date = dateObj.toISOString().slice(0, 10);
          } else {
            importData.import_date = getToday();
          }
        }

        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/nhap-hang`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...importData, tenSanPham: importData.product_name })
          });

          if (res.ok) {
            successCount++;
          } else {
            const errorData = await res.json();
            errors.push(`Hàng ${i + 1}: ${errorData.message || 'Lỗi không xác định'}`);
            errorCount++;
          }
        } catch (err) {
          errors.push(`Hàng ${i + 1}: Lỗi kết nối server`);
          errorCount++;
        }
      }

      // Show results
      let resultMessage = `✅ Nhập thành công ${successCount} sản phẩm`;
      if (errorCount > 0) {
        resultMessage += `, ${errorCount} lỗi`;
        console.log("Chi tiết lỗi:", errors);
      }
      
      setMessage(resultMessage);
      fetchItems(); // Reload data
      setTimeout(() => setMessage(""), 5000);

    } catch (err) {
      console.error("❌ Lỗi khi xử lý file Excel:", err);
      setMessage("❌ Lỗi khi xử lý file Excel");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setImporting(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Branch management functions
  const handleOpenBranchModal = (type, branch = null) => {
    setBranchModal({ open: true, type, data: branch });
    if (branch) {
      setBranchForm({
        name: branch.name || '',
        address: branch.address || '',
        phone: branch.phone || '',
        note: branch.note || ''
      });
    } else {
      setBranchForm({ name: '', address: '', phone: '', note: '' });
    }
  };

  const handleCloseBranchModal = () => {
    setBranchModal({ open: false, type: 'add', data: null });
    setBranchForm({ name: '', address: '', phone: '', note: '' });
  };

  const handleBranchFormChange = (e) => {
    const { name, value } = e.target;
    setBranchForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.name.trim()) {
      setMessage("❌ Vui lòng nhập tên chi nhánh");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    try {
      const url = branchModal.type === 'edit' 
        ? `${import.meta.env.VITE_API_URL}/api/branches/${branchModal.data._id}`
        : `${import.meta.env.VITE_API_URL}/api/branches`;
      
      const method = branchModal.type === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchForm)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${branchModal.type === 'edit' ? 'Cập nhật' : 'Thêm'} chi nhánh thành công`);
        fetchBranches(); // Reload branches
        handleCloseBranchModal();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`❌ ${data.message || 'Có lỗi xảy ra'}`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ Lỗi kết nối tới server");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chi nhánh này?')) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/branches/${branchId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Xóa chi nhánh thành công");
        fetchBranches(); // Reload branches
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`❌ ${data.message || 'Không thể xóa chi nhánh'}`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ Lỗi kết nối tới server");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Filter and pagination
  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.imei?.toLowerCase().includes(search.toLowerCase()) ||
      (item.product_name || item.tenSanPham)?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase());
    const matchDate = filterDate ? item.import_date?.slice(0, 10) === filterDate : true;
    const matchBranch = filterBranch ? item.branch === filterBranch : true;
    const matchCategory = filterCategory ? item.category === filterCategory : true;
    const matchSupplier = filterSupplier ? (item.supplier && item.supplier === filterSupplier) : true;
    return matchSearch && matchDate && matchBranch && matchCategory && matchSupplier;
  });

  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Table columns definition
  const tableColumns = [
    {
      header: "IMEI",
      key: "imei",
      render: (item) => (
        <div className="text-sm font-medium text-gray-900">
          {item.imei || <span className="text-gray-400 italic">Không có</span>}
        </div>
      )
    },
    {
      header: "Sản phẩm",
      key: "product_name",
      render: (item) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">{item.product_name || item.tenSanPham}</div>
          <div className="text-sm text-gray-500">{item.category} • {item.branch}</div>
        </div>
      )
    },
    {
      header: "SKU",
      key: "sku",
      render: (item) => (
        <div className="text-sm text-gray-900 font-mono">{item.sku}</div>
      )
    },
    {
      header: "Giá nhập",
      key: "price_import",
      render: (item) => (
        <div className="text-sm font-bold text-green-600">
          {formatCurrency(item.price_import)}
        </div>
      )
    },
    {
      header: "Ngày nhập",
      key: "import_date",
      render: (item) => (
        <div className="text-sm text-gray-500">
          {item.import_date?.slice(0, 10)}
        </div>
      )
    },
    {
      header: "Số lượng",
      key: "quantity",
      render: (item) => (
        <div className="text-sm font-semibold text-gray-900">
          {item.quantity || 1}
        </div>
      )
    },
    {
      header: "Nhà cung cấp",
      key: "supplier",
      render: (item) => {
        // ✅ Cải thiện hiển thị supplier để xử lý dữ liệu cũ
        const supplier = item.supplier || item.nha_cung_cap || '';
        const supplierDisplay = supplier.trim();
        
        return (
          <div className="text-sm text-gray-700">
            {supplierDisplay ? (
              <span>{supplierDisplay}</span>
            ) : (
              <span className="text-gray-400 italic">Chưa có nhà cung cấp</span>
            )}
            {/* ✅ Debug info để kiểm tra dữ liệu cũ */}
            {process.env.NODE_ENV === 'development' && !supplierDisplay && (
              <div className="text-xs text-red-400 mt-1">
                Debug: {JSON.stringify({
                  supplier: item.supplier,
                  nha_cung_cap: item.nha_cung_cap,
                  _id: item._id
                })}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: "Ghi chú",
      key: "note",
      render: (item) => (
        <div className="text-sm text-gray-700 max-w-xs">
          <div className="truncate" title={item.note}>
            {item.note || <span className="text-gray-400 italic">Không có</span>}
          </div>
        </div>
      )
    },
    {
      header: "Trạng thái",
      key: "status",
      render: (item) => (
        item.status === 'sold' ? (
          <span className="badge-danger">Đã bán</span>
        ) : (
          <span className="badge-success">Còn hàng</span>
        )
      )
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (item) => (
        <div className="flex gap-2">
          <button onClick={() => handleEdit(item)} className="btn-action-edit">
            ✏️ Sửa
          </button>
          <button onClick={() => handleDelete(item._id)} className="btn-action-delete">
            🗑️ Xóa
          </button>
        </div>
      )
    }
  ];

  return (
    <Layout 
      activeTab="nhap-hang"
      title="📥 Nhập Hàng"
      subtitle="Quản lý nhập hàng và theo dõi tồn kho"
    >
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Tổng sản phẩm"
          value={stats.totalItems.toLocaleString()}
          icon="📦"
          color="blue"
          subtitle="Tất cả sản phẩm nhập"
        />
        <StatsCard
          title="Giá trị nhập"
          value={formatCurrency(stats.totalValue)}
          icon="💰"
          color="green"
          subtitle="Tổng tiền đã nhập"
        />
        <StatsCard
          title="Đã bán"
          value={stats.soldItems.toLocaleString()}
          icon="✅"
          color="purple"
          subtitle="Sản phẩm đã xuất"
        />
        <StatsCard
          title="Tồn kho"
          value={stats.inStock.toLocaleString()}
          icon="📋"
          color="orange"
          subtitle="Còn lại trong kho"
        />
      </div>

      {/* Form Card */}
      <FormCard
        title={editingItemId ? '✏️ Chỉnh sửa sản phẩm' : '➕ Thêm sản phẩm mới'}
        subtitle="Điền thông tin chi tiết sản phẩm"
        onReset={resetForm}
        showReset={!!editingItemId}
        resetLabel="Hủy chỉnh sửa"
        message={message}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">IMEI</label>
            <input
              name="imei"
              placeholder="Nhập mã IMEI"
              value={formData.imei}
              onChange={handleChange}
              className="form-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Tên sản phẩm *</label>
            <input
              name="product_name"
              placeholder="Nhập tên sản phẩm"
              value={formData.product_name}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">SKU *</label>
            <input
              name="sku"
              placeholder="Mã SKU sản phẩm"
              value={formData.sku}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Giá nhập *</label>
            <input
              name="price_import"
              type="text"
              placeholder="0"
              value={formatNumber(formData.price_import)}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Ngày nhập *</label>
            <input
              name="import_date"
              type="date"
              value={formData.import_date}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Nhà cung cấp</label>
            <input
              name="supplier"
              placeholder="Tên nhà cung cấp"
              value={formData.supplier}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Chi nhánh *</label>
            <div className="flex gap-2">
              <select 
                name="branch" 
                value={formData.branch} 
                onChange={handleChange} 
                className="form-input flex-1"
                required
              >
                <option value="">Chọn chi nhánh</option>
                {branches.map((b) => (
                  <option key={b._id} value={b.name}>{b.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleOpenBranchModal('add')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors duration-200 text-sm"
                title="Quản lý chi nhánh"
              >
                🏢
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Thư mục *</label>
            <select 
              name="category" 
              value={formData.category} 
              onChange={handleChange} 
              className="form-input"
              required
            >
              <option value="">Chọn thư mục</option>
              {categories.map((c) => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Số lượng *</label>
            <input
              name="quantity"
              type="number"
              placeholder="Số lượng"
              value={formData.quantity}
              onChange={handleChange}
              className="form-input"
              required
            />
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
              <option value="cong_no">📝 Công nợ (nhà cung cấp)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Ghi chú</label>
            <input
              name="note"
              placeholder="Ghi chú thêm"
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
              {editingItemId ? "🔄 Cập nhật sản phẩm" : "➕ Thêm sản phẩm mới"}
            </button>
          </div>
        </form>
      </FormCard>

      {/* Filters */}
      <FilterCard onClearFilters={clearFilters}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="🔍 Tìm IMEI, tên, SKU..."
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
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="form-input"
            >
              <option value="">Tất cả nhà cung cấp</option>
              {Array.from(new Set(items.map(item => item.supplier).filter(Boolean))).map((supplier) => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 gap-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
              id="excel-import"
              disabled={importing}
            />
            <label
              htmlFor="excel-import"
              className={`w-full ${importing ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer`}
            >
              {importing ? '⏳ Đang nhập...' : '📥 Nhập Excel'}
            </label>
            <button
              onClick={exportToExcel}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
            >
              📊 Xuất Excel
            </button>
          </div>
        </div>
      </FilterCard>

      {/* Data Table */}
      <DataTable
        title="📋 Danh sách sản phẩm đã nhập"
        data={paginatedItems.map(item => ({ ...item, id: item._id }))}
        columns={tableColumns}
        currentPage={page}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={filteredItems.length}
        onPageChange={setPage}
      />

      {/* Branch Management Modal */}
      {branchModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {branchModal.type === 'edit' ? '✏️ Chỉnh sửa chi nhánh' : '➕ Thêm chi nhánh mới'}
            </h3>
            
            <form onSubmit={handleSaveBranch} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tên chi nhánh *</label>
                <input
                  type="text"
                  name="name"
                  value={branchForm.name}
                  onChange={handleBranchFormChange}
                  className="form-input"
                  placeholder="Nhập tên chi nhánh"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Địa chỉ</label>
                <input
                  type="text"
                  name="address"
                  value={branchForm.address}
                  onChange={handleBranchFormChange}
                  className="form-input"
                  placeholder="Nhập địa chỉ chi nhánh"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số điện thoại</label>
                <input
                  type="text"
                  name="phone"
                  value={branchForm.phone}
                  onChange={handleBranchFormChange}
                  className="form-input"
                  placeholder="Nhập số điện thoại"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
                <textarea
                  name="note"
                  value={branchForm.note}
                  onChange={handleBranchFormChange}
                  className="form-input"
                  placeholder="Ghi chú thêm"
                  rows="3"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseBranchModal}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  ❌ Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  {branchModal.type === 'edit' ? '💾 Cập nhật' : '➕ Thêm mới'}
                </button>
              </div>
            </form>

            {/* Branch List for Management */}
            {branchModal.type === 'add' && branches.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">📋 Danh sách chi nhánh hiện tại</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {branches.map((branch) => (
                    <div key={branch._id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{branch.name}</div>
                        {branch.address && (
                          <div className="text-sm text-gray-500">{branch.address}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBranchModal('edit', branch)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(branch._id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default NhapHang;
