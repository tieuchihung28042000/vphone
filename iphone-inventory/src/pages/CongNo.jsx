import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import FilterCard from "../components/FilterCard";
import DataTable from "../components/DataTable";

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

function parseNumber(val) {
  if (!val) return "";
  return val.toString().replace(/[^\d]/g, "");
}

function getPaymentSourceName(source) {
  const sourceMap = {
    'tien_mat': '💵 Tiền mặt',
    'the': '💳 Thẻ',
    'vi_dien_tu': '📱 Ví điện tử'
  };
  return sourceMap[source] || '💵 Tiền mặt';
}

function CongNo() {
  // Tab state - có 2 tab: khach_no (khách nợ mình) và minh_no_ncc (mình nợ nhà cung cấp)
  const [activeTab, setActiveTab] = useState("khach_no");
  
  const [debts, setDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  
  // Filter states
  const [searchText, setSearchText] = useState("");
  const [showAll, setShowAll] = useState(false);
  
  // Edit modal states - ĐƠN GIẢN HÓA: Chỉ có modal cập nhật
  const [editModal, setEditModal] = useState({ 
    open: false, 
    type: '', // 'customer' hoặc 'supplier'
    data: null 
  });
  const [historyModal, setHistoryModal] = useState({ open: false, type: '', name: '' });
  const [historyItems, setHistoryItems] = useState([]);
  const [editForm, setEditForm] = useState({ 
    name: '', 
    phone: '', 
    da_thanh_toan: '' 
  });
  // Trả từng phần như ngân hàng
  const [paymentSource, setPaymentSource] = useState('tien_mat');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Stats calculation - tách riêng cho 2 tab
  const customerStats = {
    totalDebt: debts.reduce((sum, debt) => sum + debt.total_debt, 0),
    totalCustomers: debts.length,
    largestDebt: Math.max(...debts.map(debt => debt.total_debt), 0),
    averageDebt: debts.length > 0 ? debts.reduce((sum, debt) => sum + debt.total_debt, 0) / debts.length : 0
  };

  const supplierStats = {
    totalDebt: supplierDebts.reduce((sum, debt) => sum + debt.total_debt, 0),
    totalCustomers: supplierDebts.length,
    largestDebt: Math.max(...supplierDebts.map(debt => debt.total_debt), 0),
    averageDebt: supplierDebts.length > 0 ? supplierDebts.reduce((sum, debt) => sum + debt.total_debt, 0) / supplierDebts.length : 0
  };

  const stats = activeTab === "khach_no" ? customerStats : supplierStats;

  // API functions
  const fetchDebts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchText.trim()) params.append('search', searchText.trim());
      if (showAll) params.append('show_all', 'true');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/cong-no/cong-no-list?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`
        }
      });
      const data = await res.json();
      // Backend trả về trực tiếp mảng
      setDebts(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      console.error('❌ Error fetching customer debts:', err);
      setDebts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierDebts = async () => {
    const params = new URLSearchParams();
    if (searchText.trim()) params.append('search', searchText.trim());
    if (showAll) params.append('show_all', 'true');
    
    try {
      setSupplierLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/cong-no/supplier-debt-list?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token') || ''}`
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setSupplierDebts(Array.isArray(data) ? data : (data.suppliers || data.items || []));
    } catch (err) {
      console.error('❌ Error fetching supplier debts:', err);
      setSupplierDebts([]);
      alert(`❌ Lỗi tải dữ liệu nhà cung cấp: ${err.message}`);
    } finally {
      setSupplierLoading(false);
    }
  };

  // ✅ ĐƠN GIẢN HÓA: Chỉ có thao tác cập nhật
  const handleEdit = (item, type) => {
    setEditModal({ open: true, type, data: item });
    
    if (type === 'customer') {
      setEditForm({
        name: item.customer_name || "",
        phone: item.customer_phone || "",
        da_thanh_toan: item.total_paid || 0 // Hiển thị số tiền đã trả thực tế
      });
    } else if (type === 'supplier') {
      setEditForm({
        name: item.supplier_name || "",
        phone: item.supplier_phone || "",
        da_thanh_toan: item.total_paid || 0 // Hiển thị số tiền đã trả thực tế
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) {
      alert("❌ Vui lòng nhập tên");
      return;
    }
    
    try {
      const { type, data } = editModal;
      let ok = true;
      
      // Nếu có nhập số tiền trả thì gọi API trả nợ
      const paymentAmountValue = parseFloat(paymentAmount) || 0;
      if (paymentAmountValue > 0) {
        const payList = [{ source: paymentSource, amount: paymentAmountValue }];
        if (type === 'customer') {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/cong-no/cong-no-pay-customer`, {
            method: 'PUT',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ 
              customer_name: data.customer_name, 
              customer_phone: data.customer_phone, 
              payments: payList,
              note: paymentNote.trim() || ''
            })
          });
          ok = res.ok;
        } else {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/cong-no/supplier-debt-pay`, {
            method: 'PUT',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ 
              supplier_name: data.supplier_name || data.supplier, 
              payments: payList,
              note: paymentNote.trim() || ''
            })
          });
          ok = res.ok;
        }
      }
      
      // Cập nhật thông tin tên/điện thoại nếu có thay đổi
      if (editForm.name.trim() !== (data.customer_name || data.supplier_name || data.supplier) || 
          editForm.phone.trim() !== (data.customer_phone || data.supplier_phone || '')) {
        const apiEndpoint = type === 'customer' ? 'update-customer' : 'update-supplier';
        const payload = type === 'customer' ? {
          old_customer_name: data.customer_name,
          old_customer_phone: data.customer_phone || '',
          new_customer_name: editForm.name.trim(),
          new_customer_phone: editForm.phone.trim()
        } : {
          old_supplier_name: data.supplier_name || data.supplier,
          old_supplier_phone: data.supplier_phone || '',
          new_supplier_name: editForm.name.trim(),
          new_supplier_phone: editForm.phone.trim()
        };
        const res2 = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/cong-no/${apiEndpoint}`, {
          method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        ok = ok && res2.ok;
      }
       
      if (ok) {
        if (paymentAmountValue > 0) {
          alert(`✅ Đã ghi nhận thanh toán ${formatCurrency(paymentAmountValue)} cho ${type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}!`);
        } else {
          alert(`✅ Đã cập nhật thông tin ${type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}!`);
        }
        type === 'customer' ? await fetchDebts() : await fetchSupplierDebts();
      } else {
        alert("❌ Cập nhật thất bại!");
      }
      
      setEditModal({ open: false, type: '', data: null });
      setEditForm({ name: "", phone: "", da_thanh_toan: "" });
      setPaymentSource('tien_mat');
      setPaymentAmount('');
      setPaymentNote('');
    } catch (err) {
      console.error('❌ Error saving edit:', err);
      alert("❌ Lỗi kết nối khi cập nhật!");
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setShowAll(false);
  };

  // Fetch histories
  const openHistory = async (type, entity) => {
    try {
      setHistoryModal({ open: true, type, name: type==='customer' ? entity.customer_name : (entity.supplier_name || entity.supplier) });
      let url = '';
      if (type === 'customer') {
        const params = new URLSearchParams({ customer_name: entity.customer_name });
        url = `${import.meta.env.VITE_API_URL || ''}/api/cong-no/customer-history?${params}`;
      } else {
        const params = new URLSearchParams({ supplier_name: entity.supplier_name || entity.supplier });
        url = `${import.meta.env.VITE_API_URL || ''}/api/cong-no/supplier-history?${params}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setHistoryItems(data.history || []);
    } catch (e) {
      setHistoryItems([]);
    }
  };

  // Table columns definition - ĐƠN GIẢN HÓA: Chỉ có thao tác cập nhật
  const tableColumns = activeTab === "khach_no" ? [
    {
      header: "Khách hàng",
      key: "customer",
      render: (customer) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">{customer.customer_name}</div>
          <div className="text-sm text-gray-500">{customer.customer_phone || 'Chưa có SĐT'}</div>
        </div>
      )
    },
    {
      header: "Tổng giá bán",
      key: "total_sale_price",
      render: (customer) => (
        <div className="text-sm font-bold text-blue-600">
          {formatCurrency(customer.total_sale_price)}
        </div>
      )
    },
    {
      header: "Đã trả",
      key: "total_paid",
      render: (customer) => (
        <div className="text-sm font-bold text-green-600">
          {formatCurrency(customer.total_paid)}
        </div>
      )
    },
    {
      header: "Còn nợ",
      key: "remaining",
      render: (customer) => {
        const remaining = customer.total_debt;
  return (
          <div className={`text-sm font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {formatCurrency(remaining)}
      </div>
        );
      }
    },
    {
      header: "Trạng thái",
      key: "status",
      render: (customer) => {
        const remaining = customer.total_debt;
        if (remaining <= 0) {
          return <span className="badge-success">✅ Đã thanh toán</span>;
        } else if (customer.total_paid > 0) {
          return <span className="badge-yellow">⚠️ Đã trả một phần</span>;
        } else {
          return <span className="badge-danger">❌ Chưa trả</span>;
        }
      }
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (customer) => (
        <div className="flex gap-2">
          <button onClick={() => handleEdit(customer, 'customer')} className="btn-action-edit text-xs">✏️ Cập nhật</button>
          <button onClick={() => openHistory('customer', customer)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">🕑 Lịch sử</button>
        </div>
      )
    }
  ] : [
    // Supplier Debt columns
    {
      header: "Nhà cung cấp",
      key: "supplier",
      render: (supplier) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">{supplier.supplier_name}</div>
          <div className="text-sm text-gray-500">{supplier.supplier_phone || 'Chưa có SĐT'}</div>
        </div>
      )
    },
    {
      header: "Tổng giá nhập",
      key: "total_import_price",
      render: (supplier) => (
        <div className="text-sm font-bold text-blue-600">
          {formatCurrency(supplier.total_import_price)}
        </div>
      )
    },
    {
      header: "Đã trả",
      key: "total_paid",
      render: (supplier) => (
        <div className="text-sm font-bold text-green-600">
          {formatCurrency(supplier.total_paid)}
        </div>
      )
    },
    {
      header: "Còn nợ",
      key: "remaining",
      render: (supplier) => {
        const remaining = supplier.total_debt;
        return (
          <div className={`text-sm font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {formatCurrency(remaining)}
          </div>
        );
      }
    },
    {
      header: "Trạng thái",
      key: "status",
      render: (supplier) => {
        const remaining = supplier.total_debt;
        if (remaining <= 0) {
          return <span className="badge-success">✅ Đã thanh toán</span>;
        } else if (supplier.total_paid > 0) {
          return <span className="badge-yellow">⚠️ Đã trả một phần</span>;
        } else {
          return <span className="badge-danger">❌ Chưa trả</span>;
        }
      }
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (supplier) => (
          <div className="flex gap-2">
            <button onClick={() => handleEdit(supplier, 'supplier')} className="btn-action-edit text-xs">✏️ Cập nhật</button>
            <button onClick={() => openHistory('supplier', supplier)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">🕑 Lịch sử</button>
          </div>
      )
    }
  ];

  // useEffect để fetch data khi tab thay đổi
  useEffect(() => {
    if (activeTab === "khach_no") {
      fetchDebts();
    } else {
      fetchSupplierDebts();
    }
  }, [activeTab, searchText, showAll]);

  // Show loading spinner khi đang fetch
  if ((activeTab === "khach_no" && loading) || (activeTab === "minh_no_ncc" && supplierLoading)) {
    return (
      <Layout 
        activeTab="cong-no"
        title="💳 Công Nợ"
        subtitle="Đang tải dữ liệu..."
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải dữ liệu công nợ...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      activeTab="cong-no"
      title="💳 Công Nợ"
      subtitle="Quản lý công nợ khách hàng và nhà cung cấp"
    >
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
          <button
          onClick={() => setActiveTab("khach_no")}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "khach_no"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
          👥 Khách nợ mình ({debts.length})
          </button>
          <button
          onClick={() => setActiveTab("minh_no_ncc")}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "minh_no_ncc"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
          🏪 Mình nợ NCC ({supplierDebts.length})
          </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatsCard
          title="Tổng công nợ"
          value={formatCurrency(stats.totalDebt)}
          icon="💰"
          color="red"
            />
        <StatsCard
          title={activeTab === "khach_no" ? "Tổng khách hàng" : "Tổng nhà cung cấp"}
          value={stats.totalCustomers.toString()}
          icon={activeTab === "khach_no" ? "👥" : "🏪"}
          color="blue"
        />
        <StatsCard
          title="Nợ lớn nhất"
          value={formatCurrency(stats.largestDebt)}
          icon="📈"
          color="orange"
            />
        <StatsCard
          title="Nợ trung bình"
          value={formatCurrency(stats.averageDebt)}
          icon="📊"
          color="green"
        />
      </div>

      {/* Filters */}
      <FilterCard onClearFilters={clearFilters}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder={`🔍 Tìm ${activeTab === "khach_no" ? "khách hàng" : "nhà cung cấp"}...`}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="form-checkbox"
              />
              <span className="text-sm text-gray-700">Hiển thị tất cả (kể cả đã thanh toán)</span>
            </label>
          </div>
        </div>
      </FilterCard>

      {/* Data Table */}
      <DataTable
        title={activeTab === "khach_no" ? "📋 Danh sách khách nợ" : "📋 Danh sách nợ nhà cung cấp"}
        data={(activeTab === "khach_no" ? debts : supplierDebts).map(item => ({ ...item, id: item._id || Math.random() }))}
        columns={tableColumns}
        currentPage={1}
        totalPages={1}
        itemsPerPage={50}
        totalItems={activeTab === "khach_no" ? debts.length : supplierDebts.length}
        onPageChange={() => {}}
      />

      {/* Edit Modal - ĐƠN GIẢN HÓA */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">
              💳 Trả nợ {editModal.type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên {editModal.type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="form-input"
                  placeholder="Nhập tên..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  className="form-input"
                  placeholder="Nhập số điện thoại..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền trả lần này</label>
                <input
                  type="text"
                  value={formatNumber(paymentAmount)}
                  onChange={(e) => setPaymentAmount(parseNumber(e.target.value))}
                  className="form-input"
                  placeholder="Nhập số tiền trả lần này..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Để trống nếu chỉ cập nhật thông tin khách hàng
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nguồn tiền</label>
                <select 
                  value={paymentSource} 
                  onChange={(e) => setPaymentSource(e.target.value)} 
                  className="form-input"
                >
                  <option value="tien_mat">💵 Tiền mặt</option>
                  <option value="the">💳 Thẻ</option>
                  <option value="vi_dien_tu">📱 Ví điện tử</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="form-input"
                  placeholder="Nhập ghi chú về lần trả nợ này..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ví dụ: Trả nợ tháng 10, Trả một phần, v.v.
                </p>
              </div>
            </div>
           
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                ✅ Lưu
              </button>
              <button
                onClick={() => {
                  setEditModal({ open: false, type: '', data: null });
                  setEditForm({ name: "", phone: "", da_thanh_toan: "" });
                  setPaymentSource('tien_mat');
                  setPaymentAmount('');
                  setPaymentNote('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                ❌ Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">🕑 Lịch sử {historyModal.type==='customer'?'trả nợ khách':'trả nợ NCC'} - {historyModal.name}</h3>
              <button className="text-gray-600" onClick={()=>{setHistoryModal({open:false,type:'',name:''}); setHistoryItems([]);}}>✖</button>
            </div>
            {historyItems.length===0 ? (
              <div className="text-sm text-gray-500">Chưa có lịch sử.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="p-2 text-left">Ngày</th>
                    <th className="p-2 text-right">Số tiền</th>
                    <th className="p-2">Nguồn</th>
                    <th className="p-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((h, idx)=> (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{new Date(h.date).toLocaleString('vi-VN')}</td>
                      <td className="p-2 text-right">{formatCurrency(h.amount)}</td>
                      <td className="p-2 text-center">{getPaymentSourceName(h.source)}</td>
                      <td className="p-2">{h.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default CongNo;