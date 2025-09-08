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
  const [editForm, setEditForm] = useState({ 
    name: '', 
    phone: '', 
    da_thanh_toan: '' 
  });
  // STORY 07: multi-payment
  const [payments, setPayments] = useState([{ source: 'tien_mat', amount: '' }]);
  const addPayRow = () => setPayments(prev => [...prev, { source: 'tien_mat', amount: '' }]);
  const rmPayRow = (idx) => setPayments(prev => prev.filter((_, i) => i !== idx));
  const upPayRow = (idx, key, val) => setPayments(prev => prev.map((p, i) => i===idx ? { ...p, [key]: key==='amount'? parseNumber(val): val } : p));
  const sumPayments = () => payments.reduce((s,p)=> s + (parseFloat(p.amount||0) || 0), 0);

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
      
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-list?${params}`);
      const data = await res.json();
      setDebts(data.items || []);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/supplier-debt-list?${params}`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setSupplierDebts(data.suppliers || data.items || []);
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
      // Nếu có nhập multi-payment thì gọi pay API tương ứng
      const payList = payments.map(p=>({ source:p.source, amount: parseFloat(p.amount||0) || 0 })).filter(p=>p.amount>0);
      let ok = true;
      if (payList.length>0) {
        if (type === 'customer') {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-pay-customer`, {
            method: 'PUT',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ customer_name: data.customer_name, customer_phone: data.customer_phone, payments: payList })
          });
          ok = res.ok;
        } else {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/supplier-debt-pay`, {
            method: 'PUT',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ supplier_name: data.supplier_name || data.supplier, payments: payList })
          });
          ok = res.ok;
        }
      }
      // Cập nhật thông tin tên/điện thoại nếu có
      const apiEndpoint = type === 'customer' ? 'update-customer' : 'update-supplier';
      const payload = type === 'customer' ? {
        old_customer_name: data.customer_name,
        old_customer_phone: data.customer_phone || '',
        new_customer_name: editForm.name.trim(),
        new_customer_phone: editForm.phone.trim(),
        da_thanh_toan: parseNumber(editForm.da_thanh_toan) || 0
      } : {
        old_supplier_name: data.supplier_name || data.supplier,
        old_supplier_phone: data.supplier_phone || '',
        new_supplier_name: editForm.name.trim(),
        new_supplier_phone: editForm.phone.trim(),
        da_thanh_toan: parseNumber(editForm.da_thanh_toan) || 0
      };
      const res2 = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/${apiEndpoint}`, {
        method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
      });
      ok = ok && res2.ok;
       
      const result = await res2.json().catch(()=>({}));
      if (ok) {
        alert(`✅ Đã cập nhật thông tin ${type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}!`);
        type === 'customer' ? await fetchDebts() : await fetchSupplierDebts();
      } else {
        alert("❌ " + (result.message || "Cập nhật thất bại!"));
      }
      
      setEditModal({ open: false, type: '', data: null });
      setEditForm({ name: "", phone: "", da_thanh_toan: "" });
      setPayments([{ source: 'tien_mat', amount: '' }]);
    } catch (err) {
      console.error('❌ Error saving edit:', err);
      alert("❌ Lỗi kết nối khi cập nhật!");
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setShowAll(false);
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
        <button
          onClick={() => handleEdit(customer, 'customer')} 
            className="btn-action-edit text-xs"
        >
          ✏️ Cập nhật
        </button>
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
          <button
          onClick={() => handleEdit(supplier, 'supplier')} 
            className="btn-action-edit text-xs"
          >
          ✏️ Cập nhật
          </button>
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
              ✏️ Cập nhật {editModal.type === 'customer' ? 'khách hàng' : 'nhà cung cấp'}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cập nhật số tiền đã thanh toán
                </label>
                <input
                  type="text"
                  value={formatNumber(editForm.da_thanh_toan)}
                  onChange={(e) => setEditForm({...editForm, da_thanh_toan: parseNumber(e.target.value)})}
                  className="form-input"
                  placeholder="Nhập số tiền đã thanh toán..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Để trống nếu không muốn thay đổi số tiền đã thanh toán
                </p>
              </div>
              {/* Multi-payment rows */}
              <div className="pt-2 border-t">
                <div className="text-sm font-semibold mb-2">Thanh toán đa nguồn (tùy chọn)</div>
                {payments.map((p, idx)=> (
                  <div key={idx} className="grid grid-cols-5 gap-2 items-center mb-2">
                    <select className="form-input col-span-2" value={p.source} onChange={e=>upPayRow(idx,'source',e.target.value)}>
                      <option value="tien_mat">💵 Tiền mặt</option>
                      <option value="the">💳 Thẻ</option>
                      <option value="vi_dien_tu">📱 Ví điện tử</option>
                    </select>
                    <input className="form-input col-span-2" placeholder="Số tiền" value={formatNumber(p.amount)} onChange={e=>upPayRow(idx,'amount',e.target.value)} />
                    <button type="button" className="text-red-600" onClick={()=>rmPayRow(idx)}>Xóa</button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={addPayRow} className="bg-gray-100 px-3 py-2 rounded">+ Thêm nguồn</button>
                  <div className="text-xs text-gray-600">Tổng: {formatCurrency(sumPayments())}</div>
                </div>
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
                  setPayments([{ source: 'tien_mat', amount: '' }]);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                ❌ Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default CongNo;