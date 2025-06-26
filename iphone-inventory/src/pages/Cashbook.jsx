import { useState, useEffect } from "react";
import { format } from "date-fns";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import FormCard from "../components/FormCard";
import FilterCard from "../components/FilterCard";
import DataTable from "../components/DataTable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ======= Format số tiền =======
function formatMoney(amount) {
  if (!amount || amount === 0) return "0đ";
  
  // Xử lý số âm
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  let result;
  if (absAmount >= 1000000000) {
    result = `${(absAmount / 1000000000).toFixed(1)}Tỷ`;
  } else if (absAmount >= 1000000) {
    result = `${(absAmount / 1000000).toFixed(1)}Tr`;
  } else if (absAmount >= 1000) {
    result = `${(absAmount / 1000).toFixed(0)}K`;
  } else {
    result = absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "đ";
  }
  
  return isNegative ? `-${result}` : result;
}

function formatNumberInput(val) {
  if (!val) return "";
  let num = val.toString().replace(/\D/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function unformatNumberInput(val) {
  return val.replace(/\D/g, "");
}

// ======= MAIN COMPONENT =======
export default function Cashbook() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ totalThu: 0, totalChi: 0, balance: 0 });
  const [modal, setModal] = useState({ open: false, type: 'add', data: null });
  
  // State cho hiển thị số dư theo nguồn tiền và chỉnh sửa tổng quỹ
  const [balanceBySource, setBalanceBySource] = useState({
    tien_mat: 0,
    the: 0,
    vi_dien_tu: 0
  });
  const [editBalanceModal, setEditBalanceModal] = useState(false);
  const [balanceForm, setBalanceForm] = useState({
    tien_mat: '',
    the: '',
    vi_dien_tu: '',
    note: ''
  });
  
  // State cho chi nhánh được chọn
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    type: 'all',
    source: 'all',
    search: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0
  });
  
  const categories = {
    thu: ['Doanh thu bán hàng', 'Thu tiền trả nợ', 'Thu khác'],
    chi: ['Chi phí nhập hàng', 'Chi phí vận hành', 'Chi khác']
  };

  const [formData, setFormData] = useState({
    type: 'thu',
    content: '',
    amount: '',
    source: 'tien_mat',
    branch: '', // Sẽ được set sau khi load chi nhánh
    customer: '',
    supplier: '',
    note: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Load danh sách chi nhánh từ database
  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/branches`);
      const data = await response.json();
      
      if (response.ok && data.length > 0) {
        // Lấy tên chi nhánh từ API
        const branchNames = data.map(branch => branch.name);
        setBranches(branchNames);
        
        // Set chi nhánh đầu tiên làm mặc định
        if (!selectedBranch) {
          setSelectedBranch(branchNames[0]);
        }
      } else {
        // Fallback nếu không load được
        const fallbackBranches = ['Chi nhánh 1', 'Chi nhánh 2', 'Chi nhánh 3'];
        setBranches(fallbackBranches);
        if (!selectedBranch) {
          setSelectedBranch(fallbackBranches[0]);
        }
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      // Fallback nếu có lỗi
      const fallbackBranches = ['Chi nhánh 1', 'Chi nhánh 2', 'Chi nhánh 3'];
      setBranches(fallbackBranches);
      if (!selectedBranch) {
        setSelectedBranch(fallbackBranches[0]);
      }
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadTransactions = async () => {
    if (!selectedBranch) return; // Không load nếu chưa có chi nhánh
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        branch: selectedBranch // Luôn lọc theo chi nhánh được chọn
      });
      
      Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key] !== 'all' && filters[key] !== '') {
          if (key === 'fromDate') params.append('from', filters[key]);
          else if (key === 'toDate') params.append('to', filters[key]);
          else params.append(key, filters[key]);
        }
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/cashbook?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setTransactions(data.items || []);
        setSummary(data.summary || { totalThu: 0, totalChi: 0, balance: 0 });
        setPagination(prev => ({
          ...prev,
          total: data.total || 0
        }));
      } else {
        console.error('Error response:', data);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
    setLoading(false);
  };

  // Load số dư theo nguồn tiền
  const loadBalanceBySource = async () => {
    if (!selectedBranch) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/cashbook/balance?branch=${selectedBranch}`);
      const data = await response.json();
      
      if (response.ok) {
        const balanceMap = {
          tien_mat: 0,
          the: 0,
          vi_dien_tu: 0
        };
        
        data.forEach(item => {
          if (item._id && item._id.source) {
            balanceMap[item._id.source] = item.balance || 0;
          }
        });
        
        setBalanceBySource(balanceMap);
      }
    } catch (error) {
      console.error('Error loading balance by source:', error);
    }
  };

  // Chỉnh sửa tổng quỹ
  const handleAdjustBalance = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/cashbook/adjust-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: selectedBranch,
          tien_mat: balanceForm.tien_mat ? Number(unformatNumberInput(balanceForm.tien_mat)) : undefined,
          the: balanceForm.the ? Number(unformatNumberInput(balanceForm.the)) : undefined,
          vi_dien_tu: balanceForm.vi_dien_tu ? Number(unformatNumberInput(balanceForm.vi_dien_tu)) : undefined,
          note: balanceForm.note,
          user: 'Admin' // Có thể lấy từ user context nếu có
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('✅ ' + result.message);
        setEditBalanceModal(false);
        setBalanceForm({ tien_mat: '', the: '', vi_dien_tu: '', note: '' });
        loadBalanceBySource();
        loadTransactions();
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      console.error('Error adjusting balance:', error);
      alert('❌ Lỗi kết nối server');
    }
  };

  // Mở modal chỉnh sửa tổng quỹ
  const handleOpenEditBalance = () => {
    setBalanceForm({
      tien_mat: balanceBySource.tien_mat.toString(),
      the: balanceBySource.the.toString(),
      vi_dien_tu: balanceBySource.vi_dien_tu.toString(),
      note: ''
    });
    setEditBalanceModal(true);
  };

  // Load chi nhánh khi component mount
  useEffect(() => {
    loadBranches();
  }, []);

  // Load transactions khi có selectedBranch và các filter thay đổi
  useEffect(() => {
    if (selectedBranch) {
      loadTransactions();
      loadBalanceBySource();
    }
  }, [filters, pagination.page, selectedBranch]);

  // Cập nhật formData.branch khi selectedBranch thay đổi
  useEffect(() => {
    if (selectedBranch) {
      setFormData(prev => ({
        ...prev,
        branch: selectedBranch
      }));
    }
  }, [selectedBranch]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleOpenModal = (type, data = null) => {
    setModal({ open: true, type, data });
    if (data) {
      setFormData({
        ...data,
        date: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        amount: data.amount?.toString() || ''
      });
    } else {
      setFormData({
        type: 'thu',
        content: '',
        amount: '',
        source: 'tien_mat',
        branch: selectedBranch, // Mặc định là chi nhánh đang được chọn
        customer: '',
        supplier: '',
        note: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    }
  };

  const handleCloseModal = () => {
    setModal({ open: false, type: 'add', data: null });
  };

  const handleSaveTransaction = async () => {
    try {
      if (!formData.content || !formData.amount || !formData.branch) {
        alert('❌ Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
      }

      const url = modal.type === 'edit' 
        ? `${import.meta.env.VITE_API_URL}/api/cashbook/${modal.data._id}`
        : `${import.meta.env.VITE_API_URL}/api/cashbook`;
      
      const method = modal.type === 'edit' ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: Number(unformatNumberInput(formData.amount))
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('✅ ' + result.message);
        handleCloseModal();
        loadTransactions();
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('❌ Lỗi kết nối server');
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa giao dịch này?')) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/cashbook/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('✅ ' + result.message);
        loadTransactions();
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('❌ Lỗi kết nối server');
    }
  };

  const handleExportExcel = async () => {
    if (!selectedBranch) {
      alert('❌ Vui lòng chọn chi nhánh trước khi xuất Excel');
      return;
    }
    
    try {
      const params = new URLSearchParams();
      params.append('branch', selectedBranch); // Luôn xuất cho chi nhánh đã chọn
      
      Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key] !== 'all' && filters[key] !== '') {
          if (key === 'fromDate') params.append('from', filters[key]);
          else if (key === 'toDate') params.append('to', filters[key]);
          else params.append(key, filters[key]);
        }
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/cashbook/export-excel?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `soquy_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        alert('✅ Xuất Excel thành công!');
      } else {
        const error = await response.json();
        alert('❌ ' + error.message);
      }
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('❌ Lỗi xuất Excel');
    }
  };

  // Stats calculation
  const totalBalance = balanceBySource.tien_mat + balanceBySource.the + balanceBySource.vi_dien_tu;
  const todayTransactions = transactions.filter(t => t.date?.slice(0, 10) === format(new Date(), 'yyyy-MM-dd'));
  const todayIncome = todayTransactions.filter(t => t.type === 'thu').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const todayExpense = todayTransactions.filter(t => t.type === 'chi').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const stats = {
    totalBalance,
    todayIncome,
    todayExpense,
    todayNet: todayIncome - todayExpense
  };

  // Table columns definition
  const tableColumns = [
    {
      header: "Ngày giao dịch",
      key: "date",
      render: (item) => (
        <div className="text-sm text-gray-900 font-medium">
          {item.date ? format(new Date(item.date), 'dd/MM/yyyy') : ''}
        </div>
      )
    },
    {
      header: "Loại",
      key: "type",
      render: (item) => (
        item.type === 'thu' ? (
          <span className="badge-success">📈 Thu</span>
        ) : (
          <span className="badge-danger">📉 Chi</span>
        )
      )
    },
    {
      header: "Mô tả",
      key: "content",
      render: (item) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">{item.content}</div>
          {item.note && <div className="text-xs text-gray-500">{item.note}</div>}
        </div>
      )
    },
    {
      header: "Số tiền",
      key: "amount",
      render: (item) => (
        <div className={`text-sm font-bold ${item.type === 'thu' ? 'text-green-600' : 'text-red-600'}`}>
          {item.type === 'thu' ? '+' : '-'}{formatMoney(item.amount)}
        </div>
      )
    },
    {
      header: "Nguồn tiền",
      key: "source",
      render: (item) => {
        const sourceMap = {
          'tien_mat': { label: 'Tiền mặt', color: 'green', icon: '💵' },
          'the': { label: 'Thẻ', color: 'blue', icon: '💳' },
          'vi_dien_tu': { label: 'Ví điện tử', color: 'purple', icon: '📱' }
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
      header: "Chi nhánh",
      key: "branch",
      render: (item) => (
        <div className="text-sm text-gray-900">
          {item.branch || <span className="text-gray-400 italic">Không có</span>}
      </div>
      )
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (item) => (
        <div className="flex gap-2">
          <button onClick={() => handleOpenModal('edit', item)} className="btn-action-edit">
            ✏️ Sửa
          </button>
          <button onClick={() => handleDeleteTransaction(item._id)} className="btn-action-delete">
            🗑️ Xóa
          </button>
        </div>
      )
    }
  ];

  return (
    <Layout 
      activeTab="so-quy"
      title="💰 Sổ Quỹ"
      subtitle="Quản lý thu chi và theo dõi tài chính"
    >
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Tổng số dư"
          value={`${formatMoney(totalBalance)}`}
          icon="💰"
          color="blue"
          subtitle="Tất cả nguồn tiền"
          onClick={handleOpenEditBalance}
        />
        <StatsCard
          title="Thu hôm nay"
          value={`${formatMoney(todayIncome)}`}
          icon="📈"
          color="green"
          subtitle={`${todayTransactions.filter(t => t.type === 'thu').length} giao dịch`}
        />
        <StatsCard
          title="Chi hôm nay"
          value={`${formatMoney(todayExpense)}`}
          icon="��"
          color="red"
          subtitle={`${todayTransactions.filter(t => t.type === 'chi').length} giao dịch`}
        />
        <StatsCard
          title="Chênh lệch hôm nay"
          value={`${formatMoney(todayIncome - todayExpense)}`}
          icon={todayIncome - todayExpense >= 0 ? "📊" : "⚠️"}
          color={todayIncome - todayExpense >= 0 ? "purple" : "orange"}
          subtitle={todayIncome - todayExpense >= 0 ? "Tích cực" : "Tiêu cực"}
        />
      </div>

      {/* Balance by Source */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="💵 Tiền mặt"
          value={`${formatMoney(balanceBySource.tien_mat)}`}
          icon="💵"
          color="green"
          subtitle="Số dư tiền mặt"
        />
        <StatsCard
          title="💳 Thẻ"
          value={`${formatMoney(balanceBySource.the)}`}
          icon="💳"
          color="blue"
          subtitle="Số dư thẻ"
        />
        <StatsCard
          title="📱 Ví điện tử"
          value={`${formatMoney(balanceBySource.vi_dien_tu)}`}
          icon="📱"
          color="purple"
          subtitle="Số dư ví điện tử"
        />
      </div>

      {/* Form Card */}
      <FormCard
        title={modal.type === 'edit' ? '✏️ Chỉnh sửa giao dịch' : '➕ Thêm giao dịch mới'}
        subtitle="Ghi chép thu chi và quản lý tài chính"
        onReset={() => {
          handleCloseModal();
          setFormData({
            type: 'thu',
            content: '',
            amount: '',
            source: 'tien_mat',
            branch: selectedBranch,
            customer: '',
            supplier: '',
            note: '',
            date: format(new Date(), 'yyyy-MM-dd')
          });
        }}
        showReset={modal.type === 'edit'}
        resetLabel="Hủy chỉnh sửa"
        message={modal.message}
      >
        <form onSubmit={handleSaveTransaction} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Ngày giao dịch *</label>
            <input
              name="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Loại giao dịch *</label>
            <select
              name="type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="form-input"
              required
            >
              <option value="thu">📈 Thu tiền</option>
              <option value="chi">📉 Chi tiền</option>
            </select>
                </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Nguồn tiền *</label>
            <select
              name="source"
              value={formData.source}
              onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
              className="form-input"
              required
            >
              <option value="tien_mat">💵 Tiền mặt</option>
              <option value="the">💳 Thẻ</option>
              <option value="vi_dien_tu">📱 Ví điện tử</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Mô tả giao dịch *</label>
            <input
              name="content"
              placeholder="Mô tả chi tiết giao dịch"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Số tiền *</label>
            <input
              name="amount"
              type="text"
              placeholder="0"
              value={formatNumberInput(formData.amount)}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: unformatNumberInput(e.target.value) }))}
              className="form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Chi nhánh</label>
            <select 
              name="branch" 
              value={formData.branch} 
              onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
              className="form-input"
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Ghi chú</label>
            <input
              name="note"
              placeholder="Ghi chú thêm"
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              className="form-input"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <button 
              type="submit" 
              className="w-full btn-gradient text-white py-4 px-8 rounded-2xl font-bold text-lg transition-all duration-300"
            >
              {modal.type === 'edit' ? "🔄 Cập nhật giao dịch" : "💰 Thêm giao dịch"}
            </button>
          </div>
        </form>
      </FormCard>

      {/* Filters */}
      <FilterCard onClearFilters={() => {
        handleFilterChange('fromDate', '');
        handleFilterChange('toDate', '');
        handleFilterChange('type', 'all');
        handleFilterChange('source', 'all');
        handleFilterChange('search', '');
      }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <input
              type="text"
              placeholder="🔍 Tìm mô tả, ghi chú..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => handleFilterChange('fromDate', e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => handleFilterChange('toDate', e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="form-input"
            >
              <option value="all">Tất cả loại</option>
              <option value="thu">📈 Thu</option>
              <option value="chi">📉 Chi</option>
            </select>
          </div>
        <div>
          <select
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
              className="form-input"
            >
              <option value="all">Tất cả nguồn</option>
              <option value="tien_mat">💵 Tiền mặt</option>
              <option value="the">💳 Thẻ</option>
              <option value="vi_dien_tu">📱 Ví điện tử</option>
          </select>
          </div>
          <div>
          <button
              onClick={handleExportExcel}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl transition-all duration-200 font-medium"
            >
              📊 Xuất Excel
          </button>
          </div>
        </div>
      </FilterCard>

      {/* Data Table */}
      <DataTable
        title="📋 Lịch sử giao dịch"
        data={transactions.map(item => ({ ...item, id: item._id }))}
        columns={tableColumns}
        currentPage={pagination.page}
        totalPages={Math.ceil(pagination.total / pagination.limit)}
        itemsPerPage={pagination.limit}
        totalItems={pagination.total}
        onPageChange={(newPage) => {
          setPagination(prev => ({ ...prev, page: newPage }));
        }}
      />

      {/* Edit Balance Modal */}
      {editBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-6">🔧 Chỉnh sửa số dư</h3>
            <form onSubmit={handleAdjustBalance} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">💵 Tiền mặt</label>
              <input
                  type="text"
                  value={formatNumberInput(balanceForm.tien_mat)}
                  onChange={(e) => setBalanceForm(prev => ({ ...prev, tien_mat: unformatNumberInput(e.target.value) }))}
                  className="form-input"
                  placeholder="0"
              />
            </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">💳 Thẻ</label>
              <input
                  type="text"
                  value={formatNumberInput(balanceForm.the)}
                  onChange={(e) => setBalanceForm(prev => ({ ...prev, the: unformatNumberInput(e.target.value) }))}
                  className="form-input"
                  placeholder="0"
              />
            </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">📱 Ví điện tử</label>
                <input
                  type="text"
                  value={formatNumberInput(balanceForm.vi_dien_tu)}
                  onChange={(e) => setBalanceForm(prev => ({ ...prev, vi_dien_tu: unformatNumberInput(e.target.value) }))}
                  className="form-input"
                  placeholder="0"
              />
            </div>
              <div className="flex gap-3 pt-4">
              <button
                  type="button"
                  onClick={() => setEditBalanceModal(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-xl transition-all"
              >
                ❌ Hủy
              </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition-all"
                >
                  ✅ Cập nhật
                </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
