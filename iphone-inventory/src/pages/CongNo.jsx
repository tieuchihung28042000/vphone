import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import FormCard from "../components/FormCard";
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

function CongNo() {
  // Tab state - có 2 tab: khach_no (khách nợ mình) và minh_no_ncc (mình nợ nhà cung cấp)
  const [activeTab, setActiveTab] = useState("khach_no");
  
  const [debts, setDebts] = useState([]);
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  
  // ✅ Thêm loading states
  const [loading, setLoading] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [customerDebt, setCustomerDebt] = useState({ total_debt: 0, total_paid: 0, debt_history: [] });
  const [supplierDebt, setSupplierDebt] = useState({ total_debt: 0, total_paid: 0, debt_history: [] });
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
  const [historyModal, setHistoryModal] = useState({ open: false, history: [] });
  const [detailModal, setDetailModal] = useState({ open: false, orders: [] });
  
  // Filter states
  const [searchText, setSearchText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, customer: null });
  const [editForm, setEditForm] = useState({ name: "", phone: "" });

  // Stats calculation - tách riêng cho 2 tab
  const customerStats = {
    totalDebt: debts.reduce((sum, debt) => sum + debt.total_debt, 0),
    totalCustomers: debts.length,
    largestDebt: Math.max(...debts.map(debt => debt.total_debt), 0),
    averageDebt: debts.length > 0 ? debts.reduce((sum, debt) => sum + debt.total_debt, 0) / debts.length : 0
  };

  const supplierStats = {
    totalDebt: supplierDebts.reduce((sum, debt) => sum + debt.total_debt, 0),
    totalCustomers: supplierDebts.length, // ✅ Changed from totalSuppliers to totalCustomers for consistency
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
      console.log('🔍 Fetching supplier debts...'); // Debug
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/supplier-debt-list?${params}`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('📦 Supplier debts response:', data); // Debug
      
      // ✅ API trả về data.suppliers chứ không phải data.items
      setSupplierDebts(data.suppliers || data.items || []);
    } catch (err) {
      console.error('❌ Error fetching supplier debts:', err);
      setSupplierDebts([]);
      // Hiển thị error message thay vì white screen
      alert(`❌ Lỗi tải dữ liệu nhà cung cấp: ${err.message}`);
    } finally {
      setSupplierLoading(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerDebt({
      total_debt: customer.total_debt || 0,
      total_paid: customer.total_paid || 0,
      debt_history: customer.debt_history || []
    });
    setPayAmount(""); 
    setPayNote("");
    setAddAmount(""); 
    setAddNote("");
  };

  // Supplier handler functions
  const handleSelectSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierDebt({
      total_debt: supplier.total_debt || 0,
      total_paid: supplier.total_paid || 0,
      debt_history: supplier.debt_history || []
    });
    setPayAmount(""); 
    setPayNote("");
    setAddAmount(""); 
    setAddNote("");
  };

  const handleShowSupplierDetail = async (supplier) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/cong-no/supplier-orders?supplier_name=${encodeURIComponent(supplier.supplier_name)}`
    );
    const data = await res.json();
    setDetailModal({ open: true, orders: data.orders || [] });
  };

  const handlePaySupplierDebt = async () => {
    if (!payAmount || isNaN(payAmount)) return alert("Nhập số tiền muốn trả");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/supplier-debt-pay`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_name: selectedSupplier.supplier_name,
        amount: payAmount,
        note: payNote
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Đã trả nợ nhà cung cấp!");
      setPayAmount(""); 
      setPayNote("");
      await fetchSupplierDebts();
      // Update selected supplier debt info
      setTimeout(() => {
        const updated = supplierDebts.find(d => d.supplier_name === selectedSupplier.supplier_name);
        if (updated) {
          setSupplierDebt({
            total_debt: updated.total_debt,
            total_paid: updated.total_paid,
            debt_history: updated.debt_history || []
          });
        }
      }, 200);
    } else {
      alert("❌ " + (data.message || "Trả nợ NCC thất bại!"));
    }
  };

  const handleAddSupplierDebt = async () => {
    if (!addAmount || isNaN(addAmount)) return alert("Nhập số tiền muốn cộng nợ");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/supplier-debt-add`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier_name: selectedSupplier.supplier_name,
        amount: addAmount,
        note: addNote
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Đã cộng thêm nợ NCC!");
      setAddAmount(""); 
      setAddNote("");
      await fetchSupplierDebts();
      // Update selected supplier debt info
      setTimeout(() => {
        const updated = supplierDebts.find(d => d.supplier_name === selectedSupplier.supplier_name);
        if (updated) {
          setSupplierDebt({
            total_debt: updated.total_debt,
            total_paid: updated.total_paid,
            debt_history: updated.debt_history || []
          });
        }
      }, 200);
    } else {
      alert("❌ " + (data.message || "Cộng nợ NCC thất bại!"));
    }
  };

  const handlePayDebt = async () => {
    if (!payAmount || isNaN(payAmount)) return alert("Nhập số tiền muốn trả");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-pay-customer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: selectedCustomer.customer_name,
        customer_phone: selectedCustomer.customer_phone,
        amount: payAmount,
        note: payNote
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Đã cập nhật công nợ!");
      setPayAmount(""); 
      setPayNote("");
      await fetchDebts();
      setTimeout(() => {
        const updated = debts.find(d =>
          d.customer_name === selectedCustomer.customer_name &&
          d.customer_phone === selectedCustomer.customer_phone
        );
        if (updated) {
          setCustomerDebt({
            total_debt: updated.total_debt,
            total_paid: updated.total_paid,
            debt_history: updated.debt_history || []
          });
        }
      }, 200);
    } else {
      alert("❌ " + (data.message || "Cập nhật công nợ thất bại!"));
    }
  };

  const handleAddDebt = async () => {
    if (!addAmount || isNaN(addAmount)) return alert("Nhập số tiền muốn cộng nợ");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-add-customer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: selectedCustomer.customer_name,
        customer_phone: selectedCustomer.customer_phone,
        amount: addAmount,
        note: addNote
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Đã cộng thêm nợ!");
      setAddAmount(""); 
      setAddNote("");
      await fetchDebts();
      setTimeout(() => {
        const updated = debts.find(d =>
          d.customer_name === selectedCustomer.customer_name &&
          d.customer_phone === selectedCustomer.customer_phone
        );
        if (updated) {
          setCustomerDebt({
            total_debt: updated.total_debt,
            total_paid: updated.total_paid,
            debt_history: updated.debt_history || []
          });
        }
      }, 200);
    } else {
      alert("❌ " + (data.message || "Cộng nợ thất bại!"));
    }
  };

  const handleShowHistory = () => {
    setHistoryModal({ open: true, history: customerDebt.debt_history || [] });
  };

  const handleShowDetail = async (customer) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-orders?customer_name=${encodeURIComponent(customer.customer_name)}&customer_phone=${encodeURIComponent(customer.customer_phone || "")}`
    );
    const data = await res.json();
    setDetailModal({ open: true, orders: data.orders || [] });
  };

  const handleEditCustomer = (customer) => {
    setEditForm({ name: customer.customer_name, phone: customer.customer_phone || "" });
    setEditModal({ open: true, customer });
  };

  const handleSaveCustomer = async () => {
    if (!editForm.name.trim()) return alert("Tên khách hàng không được để trống");
    
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/update-customer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        old_customer_name: editModal.customer.customer_name,
        old_customer_phone: editModal.customer.customer_phone,
        new_customer_name: editForm.name.trim(),
        new_customer_phone: editForm.phone.trim()
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert("✅ " + data.message);
      setEditModal({ open: false, customer: null });
      fetchDebts();
    } else {
      alert("❌ " + (data.message || "Lỗi cập nhật"));
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Bạn có chắc muốn xóa công nợ của khách hàng "${customer.customer_name}"?`)) return;
    
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/delete-customer`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: customer.customer_name,
        customer_phone: customer.customer_phone
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert("✅ " + data.message);
      fetchDebts();
    } else {
      alert("❌ " + (data.message || "Lỗi xóa"));
    }
  };

  useEffect(() => {
    fetchDebts();
  }, [searchText, showAll]);

  // Clear filters function
  const clearFilters = () => {
    setSearchText("");
    setShowAll(false);
  };

  // Table columns definition - Tự động switch theo tab
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
      header: "Tổng nợ",
      key: "total_debt",
      render: (customer) => (
        <div className="text-sm font-bold text-red-600">
          {formatCurrency(customer.total_debt)}
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
        // Logic: total_debt là số còn nợ, không cần trừ total_paid
        const remaining = customer.total_debt; // debt đã là số còn nợ
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
        const remaining = customer.total_debt; // debt đã là số còn nợ
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
        <div className="flex gap-2 flex-wrap">
        <button
            onClick={() => handleSelectCustomer(customer)} 
            className="btn-action-edit text-xs"
        >
            💰 Quản lý
        </button>
        <button
            onClick={() => handleShowDetail(customer)} 
            className="btn-action-edit text-xs"
        >
            📋 Chi tiết
        </button>
        <button
            onClick={() => handleEditCustomer(customer)} 
            className="btn-action-edit text-xs"
        >
            ✏️ Sửa
        </button>
        <button
            onClick={() => handleDeleteCustomer(customer)} 
            className="btn-action-delete text-xs"
        >
            🗑️ Xóa
        </button>
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
      header: "Tổng nợ",
      key: "total_debt",
      render: (supplier) => (
        <div className="text-sm font-bold text-red-600">
          {formatCurrency(supplier.total_debt)}
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
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleSelectSupplier(supplier)} 
            className="btn-action-edit text-xs"
          >
            💰 Quản lý
          </button>
          <button
            onClick={() => handleShowSupplierDetail(supplier)} 
            className="btn-action-edit text-xs"
          >
            📋 Chi tiết
          </button>
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

  // ✅ Show loading spinner khi đang fetch
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
      subtitle={activeTab === "khach_no" ? "Quản lý công nợ khách hàng" : "Quản lý công nợ nhà cung cấp"}
    >
      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1 mb-6">
        <div className="flex">
          <button
            onClick={() => {
              setActiveTab("khach_no");
              setSelectedCustomer(null);
              setSelectedSupplier(null);
            }}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === "khach_no"
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-600 hover:text-blue-600"
            }`}
          >
            👥 Khách nợ mình
          </button>
          <button
            onClick={() => {
              setActiveTab("minh_no_ncc");
              setSelectedCustomer(null);
              setSelectedSupplier(null);
            }}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
              activeTab === "minh_no_ncc"
                ? "bg-orange-600 text-white shadow-md"
                : "text-gray-600 hover:text-orange-600"
            }`}
          >
            🏪 Mình nợ nhà cung cấp
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Tổng công nợ"
          value={formatCurrency(stats.totalDebt || 0)}
          icon="💳"
          color="red"
          subtitle="Tổng tiền chưa thu"
            />
        <StatsCard
          title={activeTab === "khach_no" ? "Số khách hàng" : "Số nhà cung cấp"}
          value={(stats.totalCustomers || 0).toString()}
          icon="👥"
          color="blue"
          subtitle={activeTab === "khach_no" ? "Khách hàng có nợ" : "Nhà cung cấp có nợ"}
        />
        <StatsCard
          title="Nợ lớn nhất"
          value={formatCurrency(stats.largestDebt || 0)}
          icon="⚠️"
          color="orange"
          subtitle={activeTab === "khach_no" ? "Khách nợ nhiều nhất" : "NCC nhiều nhất"}
            />
        <StatsCard
          title="Nợ trung bình"
          value={formatCurrency(stats.averageDebt || 0)}
          icon="📊"
          color="purple"
          subtitle={activeTab === "khach_no" ? "Trung bình mỗi khách" : "Trung bình mỗi NCC"}
        />
      </div>

      {/* Customer Management Form */}
      {selectedCustomer && (
        <FormCard
          title={`💰 Quản lý công nợ: ${selectedCustomer.customer_name}`}
          subtitle={`SĐT: ${selectedCustomer.customer_phone || 'Chưa có'} • Còn nợ: ${formatCurrency(customerDebt.total_debt)}`}
          onReset={() => setSelectedCustomer(null)}
          showReset={true}
          resetLabel="Đóng"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pay Debt Form */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-green-600">💸 Trả nợ</h4>
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền trả</label>
              <input
                type="number"
                  placeholder="Nhập số tiền"
                value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="form-input"
              />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
              <input
                type="text"
                placeholder="Ghi chú trả nợ"
                value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="form-input"
              />
              </div>
              <button
                onClick={handlePayDebt}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl transition-all font-medium"
              >
                ✅ Xác nhận trả nợ
              </button>
            </div>

            {/* Add Debt Form */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-orange-600">📈 Cộng nợ</h4>
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền cộng</label>
              <input
                type="number"
                  placeholder="Nhập số tiền"
                value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="form-input"
              />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
              <input
                type="text"
                placeholder="Ghi chú cộng nợ"
                value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="form-input"
              />
              </div>
              <button
                onClick={handleAddDebt}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl transition-all font-medium"
              >
                ➕ Cộng thêm nợ
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleShowHistory}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-all font-medium"
              >
              📈 Xem lịch sử giao dịch
              </button>
            </div>
        </FormCard>
      )}

      {/* Supplier Management Form */}
      {selectedSupplier && (
        <FormCard
          title={`🏪 Quản lý nợ nhà cung cấp: ${selectedSupplier.supplier_name}`}
          subtitle={`Còn nợ: ${formatCurrency(supplierDebt.total_debt)}`}
          onReset={() => setSelectedSupplier(null)}
          showReset={true}
          resetLabel="Đóng"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pay Debt Form */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-green-600">💸 Trả nợ NCC</h4>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền trả</label>
                <input
                  type="number"
                  placeholder="Nhập số tiền trả"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Ghi chú trả nợ"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="form-input"
                />
              </div>
              <button
                onClick={handlePaySupplierDebt}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl transition-all font-medium"
              >
                ✅ Xác nhận trả nợ
              </button>
            </div>

            {/* Add Debt Form */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-orange-600">📈 Cộng nợ NCC</h4>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền cộng</label>
                <input
                  type="number"
                  placeholder="Nhập số tiền cộng nợ"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Ghi chú cộng nợ"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="form-input"
                />
              </div>
              <button
                onClick={handleAddSupplierDebt}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl transition-all font-medium"
              >
                ➕ Cộng thêm nợ
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setHistoryModal({ open: true, history: supplierDebt.debt_history || [] })}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-all font-medium"
            >
              📈 Xem lịch sử giao dịch
            </button>
          </div>
        </FormCard>
      )}

      {/* Filters */}
      <FilterCard onClearFilters={clearFilters}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder="🔍 Tìm tên, SĐT khách hàng..."
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
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Hiển thị cả khách đã trả hết nợ</span>
            </label>
          </div>
        </div>
      </FilterCard>

      {/* Data Table */}
      <DataTable
        title={activeTab === "khach_no" ? "📋 Danh sách công nợ khách hàng" : "📋 Danh sách công nợ nhà cung cấp"}
        data={
          activeTab === "khach_no" 
            ? debts.map(item => ({ ...item, id: item._id || `${item.customer_name}-${item.customer_phone}` }))
            : supplierDebts.map(item => ({ ...item, id: item._id || `${item.supplier_name}-${item.supplier_phone}` }))
        }
        columns={tableColumns}
        currentPage={1}
        totalPages={1}
        itemsPerPage={activeTab === "khach_no" ? debts.length : supplierDebts.length}
        totalItems={activeTab === "khach_no" ? debts.length : supplierDebts.length}
        emptyMessage={
          activeTab === "khach_no" 
            ? "Chưa có khách hàng nào còn nợ" 
            : "Chưa có nhà cung cấp nào mình đang nợ. Hãy nhập hàng với công nợ để tạo dữ liệu."
        }
      />

      {/* History Modal */}
      {historyModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">📈 Lịch sử giao dịch</h3>
            <div className="space-y-3">
              {historyModal.history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Chưa có giao dịch nào</p>
              ) : (
                historyModal.history.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`font-semibold ${item.type === 'pay' ? 'text-green-600' : 'text-orange-600'}`}>
                          {item.type === 'pay' ? '💸 Trả nợ' : '📈 Cộng nợ'}: {formatNumber(item.amount)}đ
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{item.note || 'Không có ghi chú'}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(item.date).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setHistoryModal({ open: false, history: [] })}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition-all"
              >
                ❌ Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-6xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">📋 Chi tiết sản phẩm đã mua</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Sản phẩm</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Số lượng</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Giá bán</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Công nợ</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Ngày bán</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.orders.map((order, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="px-4 py-3">{order.product_name}</td>
                      <td className="px-4 py-3">{order.quantity || 1}</td>
                                          <td className="px-4 py-3">{formatCurrency(order.price_sell)}</td>
                    <td className="px-4 py-3">{formatCurrency(order.debt)}</td>
                      <td className="px-4 py-3">{order.sold_date ? new Date(order.sold_date).toLocaleDateString('vi-VN') : ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailModal({ open: false, orders: [] })}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition-all"
              >
                ❌ Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-6">✏️ Sửa thông tin khách hàng</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tên khách hàng</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="Nhập tên khách hàng"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số điện thoại</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="form-input"
                  placeholder="Nhập số điện thoại"
                />
              </div>
              <div className="flex gap-3 pt-4">
              <button
                onClick={() => setEditModal({ open: false, customer: null })}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-xl transition-all"
              >
                ❌ Hủy
              </button>
                <button
                  onClick={handleSaveCustomer}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition-all"
                >
                  ✅ Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default CongNo;
