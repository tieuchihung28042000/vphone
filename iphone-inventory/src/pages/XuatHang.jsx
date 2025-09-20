import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import FormCard from "../components/FormCard";
import FilterCard from "../components/FilterCard";
import DataTable from "../components/DataTable";
import * as XLSX from 'xlsx';

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
    da_thanh_toan: "", // Số tiền đã thanh toán
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

  // ✅ States cho modal trả hàng bán
  const [returnModal, setReturnModal] = useState({ open: false, item: null });
  const [returnForm, setReturnForm] = useState({
    return_amount: '',
    return_method: 'cash',
    return_reason: '',
    note: ''
  });

  // ===== STORY 05: Batch xuất hàng + payments + kênh/nhân viên + In bill =====
  const [batchMode, setBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState([]); // {imei, sku, product_name, quantity, price_sell}
  const [batchRow, setBatchRow] = useState({ imei: '', sku: '', product_name: '', quantity: '1', price_sell: '' });
  const [batchPayments, setBatchPayments] = useState([{ source: 'tien_mat', amount: '' }]);
  const [salesChannel, setSalesChannel] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [autoCashbook, setAutoCashbook] = useState(true);
  const [lastBatchResponse, setLastBatchResponse] = useState(null);

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
      // ✅ Sửa: Gọi API tồn kho (đường dẫn tương đối)
      const res = await fetch(`/api/ton-kho`);
      
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      
      const data = await res.json();
      if (!data.items) return;
      
      // ✅ Chỉ lấy những item có quantity > 0 (thực tế còn tồn kho)
      const available = data.items.filter(item => {
        if (item.imei) {
          // Sản phẩm có IMEI: chỉ lấy nếu status !== 'sold'
          return item.status !== 'sold';
        } else {
          // Phụ kiện: chỉ lấy nếu quantity > 0 (đã được tính toán từ API tồn kho)
          return (item.quantity || 0) > 0;
        }
      });
      
      setAvailableItems(available);
      console.log('✅ Fetched available items from ton-kho API:', available.length);
    } catch (err) {
      console.error("❌ Lỗi khi tải sản phẩm khả dụng:", err);
    }
  };

  const fetchSoldItems = async () => {
    try {
      const res = await fetch(`/api/xuat-hang-list`);
      
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
      const res = await fetch(`/api/branches`);
      const data = await res.json();
      setBranches(data);
    } catch (err) {
      console.error('❌ Lỗi fetch branches:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/categories`);
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
      // ✅ Thêm timestamp để tránh cache
      const timestamp = Date.now();
      const res = await fetch(`/api/ton-kho?t=${timestamp}`);
      const data = await res.json();
      const lowerQuery = query.trim().toLowerCase();
      
      // API đã được đơn giản hóa
      
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
        if (item.imei && item.status !== 'sold') {
          // Chỉ thêm IMEI nếu chưa bán
          group[key].imeis.push(item.imei);
        } else if (!item.imei) {
          // ✅ Phụ kiện: sử dụng quantity trực tiếp (logic đơn giản)
          group[key].soLuong += Number(item.quantity || 0);
        }
      });
      
      // ✅ Lọc bỏ những sản phẩm không có tồn kho
      const availableItems = Object.values(group).filter(item => {
        if (item.isAccessory) {
          return item.soLuong > 0; // Phụ kiện phải có số lượng > 0
        } else {
          return item.imeis.length > 0; // Sản phẩm IMEI phải có ít nhất 1 IMEI chưa bán
        }
      });
      
      setSuggestList(availableItems);
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
    
    if (name === "sale_price" || name === "da_thanh_toan") {
      // Giữ nguyên giá trị đã format để hiển thị, nhưng lưu số nguyên vào state
      const cleanNumber = parseNumber(value);
      setFormData((prev) => ({ ...prev, [name]: cleanNumber }));
    } else if (name === "imei" && value.trim()) {
      // Auto-fill product info when IMEI is entered
      try {
        const res = await fetch(`/api/find-by-imei?imei=${value.trim()}`);
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
      da_thanh_toan: "", // Số tiền đã thanh toán
      sale_date: getToday(),
      buyer_name: "",
      buyer_phone: "",
      branch: formData.branch,
      note: "",
      source: "tien_mat"
    });
    setEditingItemId(null);
    setIsAccessory(false); // Reset trạng thái phụ kiện
    
    // ✅ Reset suggestion list khi reset form
    setSuggestList([]);
    setShowSuggest(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingItemId ? "PUT" : "POST";
      const url = editingItemId
        ? `/api/xuat-hang/${editingItemId}`
        : `/api/xuat-hang`;

      // ✅ Chuẩn bị data - không tự động tính da_thanh_toan
      const salePrice = parseFloat(parseNumber(formData.sale_price)) || 0;
      const quantity = parseInt(formData.quantity) || 1;
      const daTT = parseFloat(parseNumber(formData.da_thanh_toan)) || 0; // ✅ Chuyển thành number
      
      // ✅ FIX: Không tự động tính da_thanh_toan, lưu đúng giá trị người dùng nhập (kể cả 0)
      const finalDaTT = daTT; // Bỏ logic tự động tính
      
      const submitData = {
        ...formData,
        sale_price: salePrice,
        price_sell: salePrice, // Backend compatibility
        quantity: quantity,
        da_thanh_toan: finalDaTT,
        is_accessory: isAccessory || !formData.imei, // Đánh dấu phụ kiện nếu không có IMEI
        // Mapping fields cho backend
        customer_name: formData.buyer_name || formData.customer_name,
        customer_phone: formData.buyer_phone || formData.customer_phone,
        sold_date: formData.sale_date
      };

      console.log('🔄 Submitting request:', { method, url, submitData });
      console.log('🔍 DEBUG calculated da_thanh_toan:', finalDaTT);
      console.log('🔍 DEBUG form da_thanh_toan input:', formData.da_thanh_toan);
      console.log('🔍 DEBUG parsed daTT:', daTT);
      console.log('🔍 DEBUG parseNumber result:', parseNumber(formData.da_thanh_toan));
      console.log('🔍 DEBUG salePrice:', salePrice, 'quantity:', quantity);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData)
      });

      const data = await res.json();
      if (res.ok) {
        console.log('✅ API Response success:', data);
        setMessage(`✅ ${data.message}`);
        resetForm();
        
        // ✅ Force refresh data để đảm bảo UI cập nhật
        console.log('🔄 Refreshing data after successful operation...');
        await Promise.all([
          fetchSoldItems(),
          fetchAvailableItems()
        ]);
        
        // ✅ Refresh suggestion list nếu đang hiển thị
        if (showSuggest && formData.product_name) {
          console.log('🔄 Refreshing suggestion list after successful operation...');
          await fetchSuggestList(formData.product_name);
        }
        
        console.log('✅ Data refresh completed');
        
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
      da_thanh_toan: (item.da_thanh_toan || "").toString(), // Số tiền đã thanh toán
      sale_date: item.sale_date?.slice(0, 10) || getToday(),
      buyer_name: item.customer_name || item.buyer_name || "",
      buyer_phone: item.customer_phone || item.buyer_phone || "",
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

  // ✅ Xử lý mở modal trả hàng bán
  const handleOpenReturnModal = (item) => {
    setReturnModal({ open: true, item });
    setReturnForm({
      return_amount: item.sale_price || '',
      return_method: 'cash',
      return_reason: '',
      note: ''
    });
  };

  // ✅ Xử lý đóng modal trả hàng bán
  const handleCloseReturnModal = () => {
    setReturnModal({ open: false, item: null });
    setReturnForm({
      return_amount: '',
      return_method: 'cash',
      return_reason: '',
      note: ''
    });
  };

  // ✅ Xử lý thay đổi form trả hàng
  const handleReturnFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "return_amount") {
      setReturnForm(prev => ({ ...prev, [name]: parseNumber(value) }));
    } else {
      setReturnForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // ✅ Xử lý submit trả hàng bán
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    
    const returnAmount = parseFloat(parseNumber(returnForm.return_amount)) || 0;
    
    if (returnAmount <= 0) {
      setMessage("❌ Số tiền trả lại phải lớn hơn 0");
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
      const res = await fetch(`/api/return-export`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          original_export_id: returnModal.item._id,
          return_amount: returnAmount,
          return_method: returnForm.return_method,
          return_reason: returnForm.return_reason,
          note: returnForm.note
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage("✅ Đã tạo phiếu trả hàng thành công");
        handleCloseReturnModal();
        
        // Refresh data
        await Promise.all([
          fetchSoldItems(),
          fetchAvailableItems()
        ]);
        
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

  // ---- Batch helpers ----
  const addBatchItem = () => {
    if (!(batchRow.product_name || batchRow.imei || batchRow.sku)) return;
    const q = parseInt(batchRow.quantity) || 1;
    const p = parseFloat(parseNumber(batchRow.price_sell)) || 0;
    setBatchItems(prev => [...prev, { ...batchRow, quantity: String(q), price_sell: String(p) }]);
    setBatchRow({ imei: '', sku: '', product_name: '', quantity: '1', price_sell: '' });
  };
  const removeBatchItem = (idx) => setBatchItems(prev => prev.filter((_, i) => i !== idx));
  const addPaymentRow = () => setBatchPayments(prev => [...prev, { source: 'tien_mat', amount: '' }]);
  const removePaymentRow = (idx) => setBatchPayments(prev => prev.filter((_, i) => i !== idx));
  const updatePaymentRow = (idx, key, val) => {
    setBatchPayments(prev => prev.map((p, i) => i === idx ? { ...p, [key]: key === 'amount' ? parseNumber(val) : val } : p));
  };
  const totalBatchPayment = () => batchPayments.reduce((s, p) => s + (parseFloat(parseNumber(p.amount)) || 0), 0);

  const handleSubmitBatch = async () => {
    if (batchItems.length === 0) {
      setMessage('❌ Vui lòng thêm ít nhất 1 dòng sản phẩm');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    const items = batchItems.map(i => ({
      imei: i.imei || undefined,
      sku: i.sku || undefined,
      product_name: i.product_name || undefined,
      quantity: parseInt(i.quantity) || 1,
      price_sell: parseFloat(parseNumber(i.price_sell)) || 0
    }));
    const payments = batchPayments
      .map(p => ({ source: p.source, amount: parseFloat(parseNumber(p.amount)) || 0 }))
      .filter(p => p.amount > 0);

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/report/xuat-hang-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          items,
          customer_name: formData.buyer_name,
          customer_phone: formData.buyer_phone,
          branch: formData.branch,
          sold_date: formData.sale_date,
          note: formData.note,
          payments,
          sales_channel: salesChannel,
          salesperson,
          auto_cashbook: autoCashbook
        })
      });
      const data = await res.json();
      if (res.ok) {
        setLastBatchResponse(data);
        setMessage('✅ Tạo đơn batch thành công');
        // reset
        setBatchItems([]);
        setBatchPayments([{ source: 'tien_mat', amount: '' }]);
        await Promise.all([fetchSoldItems(), fetchAvailableItems()]);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ ${data.message || 'Tạo batch thất bại'}`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (e) {
      setMessage('❌ Lỗi kết nối khi tạo batch');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handlePrintLastBatch = () => {
    if (!lastBatchResponse) return;
    const { batch_id, items = [] } = lastBatchResponse;
    const wnd = window.open('', '_blank');
    const total = items.reduce((s, it) => s + (it.price_sell || 0) * (it.quantity || 1), 0);
    wnd.document.write(`
      <html><head><title>Hóa đơn ${batch_id}</title>
      <style>body{font-family:Arial;padding:16px} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ccc;padding:6px;text-align:left}</style>
      </head><body>
      <h2>VPHONE - HÓA ĐƠN BÁN HÀNG</h2>
      <p>Mã phiếu: <strong>${batch_id}</strong></p>
      <p>Khách hàng: ${formData.buyer_name || ''} - ${formData.buyer_phone || ''}</p>
      <p>Chi nhánh: ${formData.branch || ''} - Ngày: ${formData.sale_date}</p>
      <p>Kênh bán: ${salesChannel || ''} - Nhân viên: ${salesperson || ''}</p>
      <table><thead><tr><th>Tên hàng</th><th>SKU/IMEI</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>
      ${items.map(it => `<tr><td>${it.product_name || ''}</td><td>${it.sku || it.imei || ''}</td><td>${it.quantity || 1}</td><td>${(it.price_sell||0).toLocaleString()}</td><td>${(((it.price_sell||0)*(it.quantity||1))||0).toLocaleString()}</td></tr>`).join('')}
      </tbody></table>
      <h3 style="text-align:right">Tổng: ${total.toLocaleString()} đ</h3>
      <script>window.print();</script>
      </body></html>
    `);
    wnd.document.close();
  };

  // Clear filters function
  const clearFilters = () => {
    setSearch("");
    setFilterDate("");
    setFilterBranch("");
    setFilterCategory("");
    setFilterBuyer("");
  };

  // ✅ Export to Excel function
  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredItems.map(item => ({
        "IMEI": item.item?.imei || "",
        "Tên sản phẩm": item.item?.product_name || item.item?.tenSanPham || "",
        "SKU": item.item?.sku || "",
        "Giá bán": item.sale_price || item.price_sell || 0,
        "Đã thanh toán": item.da_thanh_toan || 0,
        "Công nợ": Math.max((item.sale_price || item.price_sell || 0) - (item.da_thanh_toan || 0), 0),
        "Ngày bán": item.sale_date ? new Date(item.sale_date).toLocaleDateString('vi-VN') : "",
        "Khách hàng": item.buyer_name || item.customer_name || "",
        "SĐT khách": item.buyer_phone || item.customer_phone || "",
        "Chi nhánh": item.branch || "",
        "Số lượng": item.quantity || 1,
        "Bảo hành": item.warranty || "",
        "Ghi chú": item.note || "",
        "Nguồn tiền": item.source || ""
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      const colWidths = [
        { wch: 15 }, // IMEI
        { wch: 30 }, // Tên sản phẩm
        { wch: 15 }, // SKU
        { wch: 12 }, // Giá bán
        { wch: 12 }, // Đã thanh toán
        { wch: 12 }, // Công nợ
        { wch: 12 }, // Ngày bán
        { wch: 20 }, // Khách hàng
        { wch: 15 }, // SĐT khách
        { wch: 15 }, // Chi nhánh
        { wch: 10 }, // Số lượng
        { wch: 15 }, // Bảo hành
        { wch: 25 }, // Ghi chú
        { wch: 12 }  // Nguồn tiền
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Danh sách xuất hàng");
      
      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const filename = `DanhSachXuatHang_${dateStr}.xlsx`;
      
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

  // ✅ Import from Excel function
  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMessage("🔄 Đang xử lý file Excel...");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setMessage("❌ File Excel không có dữ liệu");
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
          sale_price: row['Giá bán'] || row['Gia ban'] || row['sale_price'] || "",
          da_thanh_toan: row['Đã thanh toán'] || row['Da thanh toan'] || row['da_thanh_toan'] || "",
          sale_date: row['Ngày bán'] || row['Ngay ban'] || row['sale_date'] || getToday(),
          buyer_name: row['Khách hàng'] || row['Khach hang'] || row['buyer_name'] || "",
          buyer_phone: row['SĐT khách'] || row['SDT khach'] || row['buyer_phone'] || "",
          branch: row['Chi nhánh'] || row['Chi nhanh'] || row['branch'] || formData.branch,
          quantity: row['Số lượng'] || row['So luong'] || row['quantity'] || "1",
          warranty: row['Bảo hành'] || row['Bao hanh'] || row['warranty'] || "",
          note: row['Ghi chú'] || row['Ghi chu'] || row['note'] || "",
          source: row['Nguồn tiền'] || row['Nguon tien'] || row['source'] || "tien_mat"
        };

        // Validate required fields
        if (!importData.sale_price || !importData.branch) {
          errors.push(`Hàng ${i + 1}: Thiếu thông tin bắt buộc (Giá bán, Chi nhánh)`);
          errorCount++;
          continue;
        }

        // Convert date format if needed
        if (importData.sale_date && typeof importData.sale_date === 'number') {
          const excelDate = new Date((importData.sale_date - 25569) * 86400 * 1000);
          importData.sale_date = excelDate.toISOString().slice(0, 10);
        } else if (importData.sale_date && typeof importData.sale_date === 'string') {
          const dateObj = new Date(importData.sale_date);
          if (!isNaN(dateObj.getTime())) {
            importData.sale_date = dateObj.toISOString().slice(0, 10);
          } else {
            importData.sale_date = getToday();
          }
        }

        try {
          // Prepare data for submission
          const salePrice = parseNumber(importData.sale_price) || 0;
          const quantity = parseInt(importData.quantity) || 1;
          const daTT = parseNumber(importData.da_thanh_toan) || 0;
          // ✅ FIX: Không tự động tính da_thanh_toan, lưu đúng giá trị người dùng nhập (kể cả 0)
          const finalDaTT = daTT; // Bỏ logic tự động tính: || (salePrice * quantity)
          
          const submitData = {
            ...importData,
            sale_price: salePrice,
            price_sell: salePrice,
            quantity: quantity,
            da_thanh_toan: finalDaTT,
            is_accessory: !importData.imei,
            customer_name: importData.buyer_name,
            customer_phone: importData.buyer_phone,
            sold_date: importData.sale_date
          };

          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/xuat-hang`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submitData)
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
      let resultMessage = `✅ Nhập thành công ${successCount} giao dịch`;
      if (errorCount > 0) {
        resultMessage += `, ${errorCount} lỗi`;
        console.log("Chi tiết lỗi:", errors);
      }
      
      setMessage(resultMessage);
      fetchSoldItems(); // Reload data
      fetchAvailableItems();
      setTimeout(() => setMessage(""), 5000);

    } catch (err) {
      console.error("❌ Lỗi khi xử lý file Excel:", err);
      setMessage("❌ Lỗi khi xử lý file Excel");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      // Reset file input
      e.target.value = '';
    }
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
      header: "Đã thanh toán",
      key: "da_thanh_toan",
      render: (item) => {
        const daTT = parseFloat(item.da_thanh_toan) || 0;
        return (
          <div className="text-sm font-bold text-blue-600">
            {daTT > 0 ? formatCurrency(daTT) : (
              <span className="text-gray-400 italic">0đ</span>
            )}
          </div>
        );
      }
    },
    {
      header: "Công nợ",
      key: "calculated_debt", // ✅ CHANGED: Không dùng field debt nữa, tính trực tiếp
      render: (item) => {
        const daTT = parseFloat(item.da_thanh_toan) || 0;
        const giaBan = parseFloat(item.sale_price) || 0;
        const soLuong = parseInt(item.quantity) || 1;
        const congNo = Math.max((giaBan * soLuong) - daTT, 0); // ✅ Tính công nợ = (giá bán × số lượng) - đã thanh toán
        return (
          <div className={`text-sm font-bold ${congNo > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {congNo > 0 ? formatCurrency(congNo) : (
              <span className="text-green-600">✓ Đã thanh toán</span>
            )}
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
            onClick={() => handleOpenReturnModal(item)} 
            className="btn-action-return text-xs px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
            title="Phiếu trả hàng"
          >
            🔄 Trả hàng
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
                  {item.product_name || item.tenSanPham} - 
                  {item.imei ? ` IMEI: ${item.imei}` : ` SL: ${item.quantity || 0}`} - 
                  {formatNumber(item.price_import)}đ
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
            <label className="block text-sm font-semibold text-gray-700 mb-3">Đã thanh toán</label>
            <input
              name="da_thanh_toan"
              type="text"
              placeholder="Nhập số tiền khách đã thanh toán (để trống = 0)"
              value={formatNumber(formData.da_thanh_toan)}
              onChange={handleChange}
              className="form-input"
            />
            <div className="text-xs text-gray-500 mt-1">
              {(() => {
                const salePrice = parseNumber(formData.sale_price) || 0;
                const quantity = parseInt(formData.quantity) || 1;
                const daTT = parseNumber(formData.da_thanh_toan) || 0;
                const autoAmount = salePrice * quantity;
                const finalDaTT = daTT; // ✅ Không tự động tính nữa
                const congNo = Math.max(autoAmount - finalDaTT, 0);
                
                return (
                  <div className="p-2 bg-green-50 rounded border border-green-200">
                    <div className="font-medium text-green-900">💡 Tính toán:</div>
                    <div className="text-green-700">
                      <strong>Tổng tiền bán:</strong> {formatCurrency(salePrice)} × {quantity} = <strong>{formatCurrency(autoAmount)}</strong>
                    </div>
                    <div className="text-green-700">
                      <strong>Khách thanh toán:</strong> {formatCurrency(finalDaTT)}
                    </div>
                    <div className={`font-semibold ${congNo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <strong>Công nợ khách:</strong> {formatCurrency(congNo)} {congNo === 0 && '✅ Đã thanh toán đủ'}
                    </div>
                  </div>
                );
              })()}
            </div>
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

      {/* STORY 05: Batch export */}
      <FormCard
        title={batchMode ? '📦 Xuất hàng batch (nhiều dòng)' : '📦 Xuất hàng batch (bấm để bật)'}
        subtitle="Thêm nhiều dòng sản phẩm, thanh toán đa nguồn, kênh/nhân viên"
        onReset={() => { setBatchMode(!batchMode); }}
        showReset
        resetLabel={batchMode ? 'Tắt batch' : 'Bật batch'}
        message={lastBatchResponse ? `✅ Đã tạo: ${lastBatchResponse.batch_id}` : ''}
      >
        {batchMode && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <input className="form-input" placeholder="IMEI" value={batchRow.imei} onChange={e=>setBatchRow({...batchRow, imei:e.target.value})} />
              <input className="form-input" placeholder="SKU" value={batchRow.sku} onChange={e=>setBatchRow({...batchRow, sku:e.target.value})} />
              <input className="form-input" placeholder="Tên sản phẩm" value={batchRow.product_name} onChange={e=>setBatchRow({...batchRow, product_name:e.target.value})} />
              <input className="form-input" placeholder="SL" type="number" value={batchRow.quantity} onChange={e=>setBatchRow({...batchRow, quantity:e.target.value})} />
              <input className="form-input" placeholder="Giá bán" value={batchRow.price_sell} onChange={e=>setBatchRow({...batchRow, price_sell:e.target.value})} />
              <button type="button" onClick={addBatchItem} className="bg-blue-600 text-white rounded-lg px-3">+ Thêm dòng</button>
            </div>
            {batchItems.length>0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr><th className="p-2 border">Tên</th><th className="p-2 border">SKU/IMEI</th><th className="p-2 border">SL</th><th className="p-2 border">Giá</th><th className="p-2 border"></th></tr></thead>
                  <tbody>
                    {batchItems.map((it, idx)=> (
                      <tr key={idx}>
                        <td className="p-2 border">{it.product_name}</td>
                        <td className="p-2 border">{it.sku||it.imei}</td>
                        <td className="p-2 border">{it.quantity}</td>
                        <td className="p-2 border">{formatCurrency(parseFloat(parseNumber(it.price_sell))||0)}</td>
                        <td className="p-2 border text-right"><button className="text-red-600" onClick={()=>removeBatchItem(idx)}>Xóa</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="form-input" placeholder="Kênh bán (Facebook/Zalo/Shop...)" value={salesChannel} onChange={e=>setSalesChannel(e.target.value)} />
              <input className="form-input" placeholder="Nhân viên bán" value={salesperson} onChange={e=>setSalesperson(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="font-semibold">Thanh toán đa nguồn</div>
              {batchPayments.map((p, idx)=> (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                  <select className="form-input" value={p.source} onChange={e=>updatePaymentRow(idx,'source',e.target.value)}>
                    <option value="tien_mat">💵 Tiền mặt</option>
                    <option value="the">💳 Thẻ</option>
                    <option value="vi_dien_tu">📱 Ví điện tử</option>
                  </select>
                  <input className="form-input" placeholder="Số tiền" value={formatNumber(p.amount)} onChange={e=>updatePaymentRow(idx,'amount',e.target.value)} />
                  <div className="text-sm text-gray-600">Tổng hiện tại: {formatCurrency(totalBatchPayment())}</div>
                  <button type="button" className="text-red-600" onClick={()=>removePaymentRow(idx)}>Xóa</button>
                </div>
              ))}
              <button type="button" onClick={addPaymentRow} className="bg-gray-100 px-3 py-2 rounded">+ Thêm nguồn</button>
            </div>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={autoCashbook} onChange={e=>setAutoCashbook(e.target.checked)} />
              <span>Tự động ghi sổ quỹ</span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={handleSubmitBatch} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">💾 Gửi batch</button>
              <button type="button" disabled={!lastBatchResponse} onClick={handlePrintLastBatch} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg">🖨️ In bill</button>
            </div>
          </div>
        )}
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
        
        {/* ✅ Excel Import/Export Buttons */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            📊 Xuất Excel
          </button>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="excel-import"
            />
            <label
              htmlFor="excel-import"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 cursor-pointer flex items-center gap-2"
            >
              📥 Nhập từ Excel
            </label>
          </div>
          <div className="text-sm text-gray-600 flex items-center">
            💡 Mẹo: Xuất Excel để có template chuẩn, sau đó nhập lại
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

      {/* Return Export Modal */}
      {returnModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">🔄 Phiếu trả hàng</h3>
            
            {/* Thông tin giao dịch */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">📋 Thông tin giao dịch</h4>
              <div className="text-sm space-y-1">
                <div><strong>Sản phẩm:</strong> {returnModal.item?.product_name}</div>
                <div><strong>SKU:</strong> {returnModal.item?.sku}</div>
                {returnModal.item?.imei && <div><strong>IMEI:</strong> {returnModal.item?.imei}</div>}
                <div><strong>Giá bán:</strong> {formatCurrency(returnModal.item?.sale_price)}</div>
                <div><strong>Khách hàng:</strong> {returnModal.item?.buyer_name}</div>
                <div><strong>SĐT:</strong> {returnModal.item?.buyer_phone}</div>
                <div><strong>Ngày bán:</strong> {returnModal.item?.sale_date?.slice(0, 10)}</div>
              </div>
            </div>
            
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền trả lại khách *</label>
                <input
                  type="text"
                  name="return_amount"
                  value={formatNumber(returnForm.return_amount)}
                  onChange={handleReturnFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Số tiền trả lại khách hàng"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phương thức trả tiền *</label>
                <select
                  name="return_method"
                  value={returnForm.return_method}
                  onChange={handleReturnFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="cash">💵 Tiền mặt</option>
                  <option value="transfer">🏦 Chuyển khoản</option>
                </select>
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
                  <option value="khong_vua_y">Không vừa ý</option>
                  <option value="sai_don_hang">Sai đơn hàng</option>
                  <option value="khong_can_nua">Không cần nữa</option>
                  <option value="bao_hanh">Bảo hành</option>
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

              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <div className="font-medium text-blue-900 mb-1">💡 Lưu ý:</div>
                <div className="text-blue-700">
                  • Sản phẩm sẽ được đưa trở lại tồn kho<br/>
                  • Phiếu trả hàng sẽ được ghi vào sổ quỹ<br/>
                  • Hành động này không thể hoàn tác
                </div>
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

export default XuatHang;
