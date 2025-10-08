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
    da_thanh_toan_nhap: "", // Số tiền đã thanh toán cho nhà cung cấp
    import_date: getToday(),
    supplier: "",
    branch: getLocalBranch(),
    note: "",
    tenSanPham: "",
    quantity: "1",
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
  
  // ✅ Thêm state cho quản lý danh mục
  const [categoryModal, setCategoryModal] = useState({ open: false, type: 'add', data: null });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  
  // ✅ Thêm states cho autocomplete
  const [suggestList, setSuggestList] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  // ✅ Autocomplete nhà cung cấp
  const [supplierSuggestList, setSupplierSuggestList] = useState([]);
  const [showSupplierSuggest, setShowSupplierSuggest] = useState(false);

  // ✅ States cho modal trả hàng
  const [returnModal, setReturnModal] = useState({ open: false, item: null });
  const [returnForm, setReturnForm] = useState({
    return_amount: '',
    return_cash: '',
    return_transfer: '',
    return_reason: '',
    note: ''
  });

  // ✅ Filter and pagination - Moved up to use in stats
  const filteredItems = items.filter((item) => {
    // ✅ Cải thiện tìm kiếm - xử lý null/undefined
    const searchText = search.toLowerCase().trim();
    const matchSearch = !searchText || 
      (item.imei && item.imei.toLowerCase().includes(searchText)) ||
      ((item.product_name || item.tenSanPham || '').toLowerCase().includes(searchText)) ||
      (item.sku && item.sku.toLowerCase().includes(searchText));
    
    // ✅ Cải thiện filter ngày - xử lý format ngày
    const matchDate = !filterDate || 
      (item.import_date && item.import_date.slice(0, 10) === filterDate);
    
    // ✅ Cải thiện filter chi nhánh - xử lý empty string
    const matchBranch = !filterBranch || 
      (item.branch && item.branch.trim() === filterBranch.trim());
    
    // ✅ Cải thiện filter danh mục - xử lý empty string  
    const matchCategory = !filterCategory || 
      (item.category && item.category.trim() === filterCategory.trim());
    
    // ✅ Cải thiện filter nhà cung cấp - xử lý empty string
    const matchSupplier = !filterSupplier || 
      (item.supplier && item.supplier.trim() === filterSupplier.trim());
    
    return matchSearch && matchDate && matchBranch && matchCategory && matchSupplier;
  });

  // ✅ Stats calculation - Cập nhật theo bộ lọc và hiển thị số liệu chính xác
  const stats = {
    totalItems: filteredItems.length,
    // ✅ SỬA: Chỉ tính giá trị nhập của những sản phẩm còn lại trong kho (status !== 'sold')
    totalValue: filteredItems
      .filter(item => item.status !== 'sold')
      .reduce((sum, item) => sum + (item.price_import * (item.quantity || 1)), 0),
    soldItems: filteredItems.filter(item => item.status === 'sold').length,
    inStock: filteredItems.filter(item => item.status !== 'sold').length,
    // ✅ Thêm stats so sánh với xuất hàng
    totalItemsAll: items.length, // Tổng tất cả items không filter
    totalSoldAll: items.filter(item => item.status === 'sold').length,
    totalInStockAll: items.filter(item => item.status !== 'sold').length
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

  // ✅ Thêm function để fetch gợi ý sản phẩm
  const fetchSuggestList = async (query) => {
    if (!query || query.length < 2) {
      setSuggestList([]);
      setShowSuggest(false);
      return;
    }
    
    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/ton-kho`);
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
            isAccessory: !item.imei,
            price_import: item.price_import || 0,
            category: item.category || ""
          };
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

  // ✅ Sửa function để chọn suggestion - CHỈ ĐIỀN FORM, KHÔNG TỰ ĐỘNG CHUYỂN SANG EDIT
  const handleSelectSuggest = (item) => {
    // Chỉ điền thông tin vào form để người dùng có thể nhập mới
    setFormData(prev => ({
      ...prev,
      product_name: item.name,
      sku: item.sku,
      category: item.category,
      price_import: item.price_import || prev.price_import
    }));
    setShowSuggest(false);
    console.log('💡 Đã điền thông tin gợi ý vào form');
  };

  // ✅ Gợi ý nhà cung cấp dựa trên dữ liệu đã nhập trước đó
  const fetchSupplierSuggest = (query) => {
    const q = (query || '').trim().toLowerCase();
    if (q.length < 1) { setSupplierSuggestList([]); setShowSupplierSuggest(false); return; }
    const all = Array.from(new Set(items.map(it => it.supplier).filter(Boolean)));
    const matched = all
      .filter(name => (name || '').toLowerCase().includes(q))
      .slice(0, 10);
    setSupplierSuggestList(matched);
    setShowSupplierSuggest(matched.length > 0);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "branch") localStorage.setItem('lastBranch', value);
    if (name === "category") localStorage.setItem('lastCategory', value);
    if (name === "price_import" || name === "da_thanh_toan_nhap") {
      setFormData((prev) => ({ ...prev, [name]: parseNumber(value) }));
    } else if (name === 'supplier') {
      setFormData((prev) => ({ ...prev, supplier: value }));
      fetchSupplierSuggest(value);
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
      da_thanh_toan_nhap: "", // Số tiền đã thanh toán cho nhà cung cấp
      import_date: getToday(),
      supplier: "",
      branch: formData.branch,
      note: "",
      tenSanPham: "",
      quantity: "1",
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
        ? `${import.meta.env.VITE_API_URL || ''}/api/nhap-hang/${editingItemId}`
        : `${import.meta.env.VITE_API_URL || ''}/api/nhap-hang`;

      // ✅ Chuẩn hóa số liệu: nếu để trống đã thanh toán -> 0
      const normalizedDaTT = parseFloat(parseNumber(formData.da_thanh_toan_nhap)) || 0;

      const payload = { 
        ...formData, 
        da_thanh_toan_nhap: normalizedDaTT,
        tenSanPham: formData.product_name || formData.tenSanPham 
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
      da_thanh_toan_nhap: item.da_thanh_toan_nhap || "", // Số tiền đã thanh toán cho nhà cung cấp
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

  // ✅ Xử lý mở modal trả hàng
  const handleOpenReturnModal = (item) => {
    setReturnModal({ open: true, item });
    setReturnForm({
      return_amount: item.price_import || '',
      return_cash: '',
      return_transfer: '',
      return_reason: '',
      note: ''
    });
  };

  // ✅ Xử lý đóng modal trả hàng
  const handleCloseReturnModal = () => {
    setReturnModal({ open: false, item: null });
    setReturnForm({
      return_amount: '',
      return_cash: '',
      return_transfer: '',
      return_reason: '',
      note: ''
    });
  };

  // ✅ Xử lý thay đổi form trả hàng
  const handleReturnFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "return_amount" || name === "return_cash" || name === "return_transfer") {
      setReturnForm(prev => ({ ...prev, [name]: parseNumber(value) }));
    } else {
      setReturnForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // ✅ Xử lý submit trả hàng
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    
    const returnAmount = parseFloat(parseNumber(returnForm.return_amount)) || 0;
    const returnCash = parseFloat(parseNumber(returnForm.return_cash)) || 0;
    const returnTransfer = parseFloat(parseNumber(returnForm.return_transfer)) || 0;
    
    // Kiểm tra tổng tiền trả
    if (returnCash + returnTransfer !== returnAmount) {
      setMessage("❌ Tổng tiền mặt + chuyển khoản phải bằng số tiền trả");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    
    if (!returnForm.return_reason.trim()) {
      setMessage("❌ Vui lòng nhập lý do trả hàng");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/return-import`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          original_inventory_id: returnModal.item._id,
          return_amount: returnAmount,
          return_cash: returnCash,
          return_transfer: returnTransfer,
          return_reason: returnForm.return_reason,
          note: returnForm.note
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage("✅ Đã tạo phiếu trả hàng thành công");
        handleCloseReturnModal();
        fetchItems();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`❌ ${data.message}`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ Lỗi khi tạo phiếu trả hàng");
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
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/nhap-hang`, {
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
        ? `${import.meta.env.VITE_API_URL || ''}/api/branches/${branchModal.data._id}`
        : `${import.meta.env.VITE_API_URL || ''}/api/branches`;
      
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/branches/${branchId}`, {
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

  // ✅ Thêm các function quản lý danh mục
  const handleOpenCategoryModal = (type, category = null) => {
    setCategoryModal({ open: true, type, data: category });
    if (type === 'edit' && category) {
      setCategoryForm({
        name: category.name || '',
        description: category.description || ''
      });
    } else {
      setCategoryForm({ name: '', description: '' });
    }
  };

  const handleCloseCategoryModal = () => {
    setCategoryModal({ open: false, type: 'add', data: null });
    setCategoryForm({ name: '', description: '' });
  };

  const handleCategoryFormChange = (e) => {
    const { name, value } = e.target;
    setCategoryForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    
    try {
      const method = categoryModal.type === 'edit' ? 'PUT' : 'POST';
      const url = categoryModal.type === 'edit' 
        ? `${import.meta.env.VITE_API_URL || ''}/api/categories/${categoryModal.data._id}`
        : `${import.meta.env.VITE_API_URL || ''}/api/categories`;
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      });
      
      if (res.ok) {
        setMessage(`✅ ${categoryModal.type === 'edit' ? 'Cập nhật' : 'Thêm'} danh mục thành công`);
        await fetchCategories();
        handleCloseCategoryModal();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ Lỗi khi lưu danh mục');
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (err) {
      console.error('Save category error:', err);
      setMessage('❌ Lỗi kết nối khi lưu danh mục');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/categories/${categoryId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setMessage('✅ Đã xóa danh mục thành công');
        await fetchCategories();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ Lỗi khi xóa danh mục');
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (err) {
      console.error('Delete category error:', err);
      setMessage('❌ Lỗi kết nối khi xóa danh mục');
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Pagination
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
      header: "Đã trả NCC",
      key: "da_thanh_toan_nhap",
      render: (item) => {
        const totalPaid = parseFloat(item.da_thanh_toan_nhap) || 0;
        const qty = parseInt(item.quantity) || 1;
        const paidPerUnit = totalPaid / qty;
        return (
          <div className="text-sm font-bold text-blue-600" title={`Tổng đã trả: ${formatCurrency(totalPaid)} cho ${qty} sp`}>
            {totalPaid > 0 ? formatCurrency(totalPaid) : (
              <span className="text-gray-400 italic">0đ</span>
            )}
          </div>
        );
      }
    },
    {
      header: "Nợ NCC",
      key: "supplier_debt",
      render: (item) => {
        const totalPaid = parseFloat(item.da_thanh_toan_nhap) || 0;
        const giaNhap = parseFloat(item.price_import) || 0;
        const soLuong = parseInt(item.quantity) || 1;
        const totalDebt = Math.max(giaNhap * soLuong - totalPaid, 0);
        return (
          <div className={`text-sm font-bold ${totalDebt > 0 ? 'text-red-600' : 'text-gray-400'}`} title={`Tổng nợ: ${formatCurrency(totalDebt)}`}>
            {totalDebt > 0 ? formatCurrency(totalDebt) : (
              <span className="text-green-600">✓ Đã trả</span>
            )}
          </div>
        );
      }
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
        const supplier = item.supplier || item.nha_cung_cap || '';
        const supplierDisplay = supplier.trim();
        
        return (
          <div className="text-sm text-gray-700">
            {supplierDisplay ? (
              <span className="font-medium">{supplierDisplay}</span>
            ) : (
              <span className="text-gray-400 italic">Chưa có NCC</span>
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
          {item.status !== 'sold' ? (
            <button 
              onClick={() => handleOpenReturnModal(item)} 
              className="btn-action-return text-xs px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
              title="Trả hàng nhập"
            >
              🔄 Trả hàng
          </button>
          ) : (
            <span className="text-xs text-gray-400 italic">Đã bán</span>
          )}
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
          subtitle={`${stats.totalItemsAll.toLocaleString()} tổng (${filteredItems.length !== items.length ? 'đã lọc' : 'tất cả'})`}
        />
        <StatsCard
          title="Giá trị nhập (còn lại)"
          value={formatCurrency(stats.totalValue)}
          icon="💰"
          color="green"
          subtitle="Chỉ tính sản phẩm còn trong kho"
        />
        <StatsCard
          title="Đã bán"
          value={stats.soldItems.toLocaleString()}
          icon="✅"
          color="purple"
          subtitle={`${stats.totalSoldAll.toLocaleString()} tổng đã bán`}
        />
        <StatsCard
          title="Tồn kho"
          value={stats.inStock.toLocaleString()}
          icon="📋"
          color="orange"
          subtitle={`${stats.totalInStockAll.toLocaleString()} tổng còn lại`}
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
          
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Tên sản phẩm *</label>
            <input
              name="product_name"
              placeholder="Nhập 2-3 ký tự để gợi ý..."
              value={formData.product_name}
              onChange={handleProductNameChange}
              className="form-input"
              required
              autoComplete="off"
            />
            {/* ✅ Dropdown gợi ý */}
            {showSuggest && suggestList.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {suggestList.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleSelectSuggest(item)}
                  >
                    <div className="font-semibold text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">
                      SKU: {item.sku} • {item.category} • {formatCurrency(item.price_import)}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <label className="block text-sm font-semibold text-gray-700 mb-3">Đã thanh toán NCC</label>
            <input
              name="da_thanh_toan_nhap"
              type="text"
              placeholder="Để trống = 0"
              value={formatNumber(formData.da_thanh_toan_nhap)}
              onChange={handleChange}
              className="form-input"
            />
            <div className="text-xs text-gray-500 mt-1">
              {(() => {
                const importPrice = parseNumber(formData.price_import) || 0;
                const quantity = parseInt(formData.quantity) || 1;
                const daTT = parseNumber(formData.da_thanh_toan_nhap) || 0;
                const totalAmount = importPrice * quantity;
                const finalDaTT = daTT; // ✅ Không tự động full, mặc định 0 nếu trống
                const congNo = Math.max(totalAmount - finalDaTT, 0);
                
                return (
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-medium text-blue-900">💡 Tính toán:</div>
                    <div className="text-blue-700">
                      <strong>Tổng tiền hàng:</strong> {formatCurrency(importPrice)} × {quantity} = <strong>{formatCurrency(totalAmount)}</strong>
                    </div>
                    <div className="text-blue-700">
                      <strong>Đã thanh toán:</strong> {formatCurrency(finalDaTT)}
                    </div>
                    <div className={`font-semibold ${congNo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <strong>Nợ NCC:</strong> {formatCurrency(congNo)} {congNo === 0 && '✅ Đã trả đủ'}
                    </div>
                  </div>
                );
              })()}
            </div>
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

          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Nhà cung cấp</label>
            <input
              name="supplier"
              placeholder="Nhập để gợi ý nhà cung cấp..."
              value={formData.supplier}
              onChange={handleChange}
              className="form-input"
              autoComplete="off"
            />
            {showSupplierSuggest && supplierSuggestList.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {supplierSuggestList.map((name, idx) => (
                  <div
                    key={name + idx}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => { setFormData(prev => ({ ...prev, supplier: name })); setShowSupplierSuggest(false); }}
                  >
                    <div className="text-sm text-gray-900 font-medium">{name}</div>
                  </div>
                ))}
              </div>
            )}
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
            <div className="flex gap-2">
              <select 
                name="category" 
                value={formData.category} 
                onChange={handleChange} 
                className="form-input flex-1"
                required
              >
                <option value="">Chọn thư mục</option>
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleOpenCategoryModal('add')}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg transition-colors duration-200 text-sm"
                title="Quản lý danh mục"
              >
                📁
              </button>
            </div>
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

      {/* Category Management Modal */}
      {categoryModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {categoryModal.type === 'edit' ? '✏️ Chỉnh sửa danh mục' : '➕ Thêm danh mục mới'}
            </h3>
            
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tên danh mục *</label>
                <input
                  type="text"
                  name="name"
                  value={categoryForm.name}
                  onChange={handleCategoryFormChange}
                  className="form-input"
                  placeholder="Nhập tên danh mục"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả</label>
                <textarea
                  name="description"
                  value={categoryForm.description}
                  onChange={handleCategoryFormChange}
                  className="form-input"
                  placeholder="Mô tả danh mục"
                  rows="3"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseCategoryModal}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  ❌ Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  {categoryModal.type === 'edit' ? '💾 Cập nhật' : '➕ Thêm mới'}
                </button>
              </div>
            </form>

            {/* Category List for Management */}
            {categoryModal.type === 'add' && categories.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">📁 Danh sách danh mục hiện tại</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {categories.map((category) => (
                    <div key={category._id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{category.name}</div>
                        {category.description && (
                          <div className="text-sm text-gray-500">{category.description}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenCategoryModal('edit', category)}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category._id)}
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

      {/* Return Import Modal */}
      {returnModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">🔄 Trả hàng nhập</h3>
            
            {/* Thông tin sản phẩm */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">📦 Thông tin sản phẩm</h4>
              <div className="text-sm space-y-1">
                <div><strong>Tên:</strong> {returnModal.item?.product_name}</div>
                <div><strong>SKU:</strong> {returnModal.item?.sku}</div>
                {returnModal.item?.imei && <div><strong>IMEI:</strong> {returnModal.item?.imei}</div>}
                <div><strong>Giá nhập:</strong> {formatCurrency(returnModal.item?.price_import)}</div>
                <div><strong>Nhà cung cấp:</strong> {returnModal.item?.supplier}</div>
              </div>
            </div>
            
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền trả lại *</label>
                <input
                  type="text"
                  name="return_amount"
                  value={formatNumber(returnForm.return_amount)}
                  onChange={handleReturnFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Số tiền trả lại nhà cung cấp"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tiền mặt</label>
                  <input
                    type="text"
                    name="return_cash"
                    value={formatNumber(returnForm.return_cash)}
                    onChange={handleReturnFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Chuyển khoản</label>
                  <input
                    type="text"
                    name="return_transfer"
                    value={formatNumber(returnForm.return_transfer)}
                    onChange={handleReturnFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Tính toán tự động */}
              <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                {(() => {
                  const returnAmount = parseFloat(parseNumber(returnForm.return_amount)) || 0;
                  const returnCash = parseFloat(parseNumber(returnForm.return_cash)) || 0;
                  const returnTransfer = parseFloat(parseNumber(returnForm.return_transfer)) || 0;
                  const total = returnCash + returnTransfer;
                  const isValid = total === returnAmount;
                  
                  return (
                    <div>
                      <div className="font-medium text-blue-900 mb-1">💡 Kiểm tra thanh toán:</div>
                      <div className="text-blue-700">
                        Tiền mặt: {formatCurrency(returnCash)} + Chuyển khoản: {formatCurrency(returnTransfer)} = <strong>{formatCurrency(total)}</strong>
                      </div>
                      <div className={`font-semibold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {isValid ? '✅ Hợp lệ' : `❌ Chênh lệch: ${formatCurrency(Math.abs(returnAmount - total))}`}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Lý do trả hàng *</label>
                <select
                  name="return_reason"
                  value={returnForm.return_reason}
                  onChange={handleReturnFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Chọn lý do trả hàng</option>
                  <option value="hang_loi">Hàng lỗi</option>
                  <option value="sai_don_hang">Sai đơn hàng</option>
                  <option value="khong_can_nua">Không cần nữa</option>
                  <option value="gia_cao">Giá cao</option>
                  <option value="khac">Lý do khác</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
                <textarea
                  name="note"
                  value={returnForm.note}
                  onChange={handleReturnFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows="3"
                  placeholder="Ghi chú thêm về việc trả hàng..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseReturnModal}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  ❌ Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  🔄 Tạo phiếu trả hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default NhapHang;
