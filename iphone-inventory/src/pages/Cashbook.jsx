import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import LogoutButton from "../components/LogoutButton";

// ======= Format số tiền =======
function formatMoney(amount) {
  return Number(amount).toLocaleString('vi-VN') + 'đ';
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

  // Load chi nhánh khi component mount
  useEffect(() => {
    loadBranches();
  }, []);

  // Load transactions khi có selectedBranch và các filter thay đổi
  useEffect(() => {
    if (selectedBranch) {
      loadTransactions();
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

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow mt-10">
      {/* Nút logout */}
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      {/* Menu điều hướng */}
      <div className="flex justify-center space-x-2 mb-6">
        <button
          onClick={() => (window.location.href = "/nhap-hang")}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          📥 Nhập hàng
        </button>
        <button
          onClick={() => (window.location.href = "/xuat-hang")}
          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
        >
          📤 Xuất hàng
        </button>
        <button
          onClick={() => (window.location.href = "/ton-kho-so-luong")}
          className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
        >
          📦 Tồn kho
        </button>
        <button
          onClick={() => (window.location.href = "/cong-no")}
          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
        >
          💳 Công nợ
        </button>
        <button
          onClick={() => (window.location.href = "/bao-cao")}
          className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
        >
          📋 Báo cáo
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700">💰 Sổ Quỹ</h1>
        <div className="flex gap-2">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={() => handleOpenModal('add')}
          >
            ➕ Thêm giao dịch
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={handleExportExcel}
          >
            📊 Xuất Excel
          </button>
        </div>
      </div>

      {/* ========= CHỌN CHI NHÁNH ========= */}
      <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg mb-6 border-l-4 border-blue-500">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-blue-800">🏢 Chi nhánh hiện tại:</span>
          {loadingBranches ? (
            <div className="px-4 py-2 border-2 border-blue-300 rounded-lg text-lg font-semibold bg-gray-100 min-w-48">
              ⏳ Đang tải chi nhánh...
                </div>
          ) : (
            <select
              className="px-4 py-2 border-2 border-blue-300 rounded-lg text-lg font-semibold bg-white shadow-sm min-w-48 focus:outline-none focus:border-blue-500"
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 })); // Reset về trang 1
              }}
            >
              {branches.map(branch => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          )}
          <span className="text-sm text-gray-600 italic">
            * Tất cả giao dịch chỉ hiển thị cho chi nhánh này
          </span>
          </div>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-green-800">💰 Tổng Thu ({selectedBranch})</h3>
          <p className="text-2xl font-bold text-green-600">{formatMoney(summary.totalThu)}</p>
          </div>
        <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
          <h3 className="text-lg font-semibold text-red-800">💸 Tổng Chi ({selectedBranch})</h3>
          <p className="text-2xl font-bold text-red-600">{formatMoney(summary.totalChi)}</p>
          </div>
        <div className={`p-4 rounded-lg border-l-4 ${summary.balance >= 0 ? 'bg-blue-100 border-blue-500' : 'bg-orange-100 border-orange-500'}`}>
          <h3 className={`text-lg font-semibold ${summary.balance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
            📊 Số Dư ({selectedBranch})
          </h3>
          <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {formatMoney(summary.balance)}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-3">🔍 Bộ lọc</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="font-medium text-gray-700">Từ ngày</label>
            <input
              type="date"
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.fromDate}
              onChange={e => handleFilterChange('fromDate', e.target.value)}
            />
          </div>
          
          <div>
            <label className="font-medium text-gray-700">Đến ngày</label>
            <input
              type="date"
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.toDate}
              onChange={e => handleFilterChange('toDate', e.target.value)}
            />
          </div>
          
          <div>
            <label className="font-medium text-gray-700">Loại giao dịch</label>
            <select
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.type}
              onChange={e => handleFilterChange('type', e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="thu">Thu</option>
              <option value="chi">Chi</option>
            </select>
          </div>

        <div>
            <label className="font-medium text-gray-700">Nguồn tiền</label>
          <select
              className="mt-1 w-full border rounded px-2 py-1"
              value={filters.source}
              onChange={e => handleFilterChange('source', e.target.value)}
            >
              <option value="all">Tất cả</option>
            <option value="tien_mat">Tiền mặt</option>
            <option value="the">Thẻ</option>
              <option value="cong_no">Công nợ</option>
          </select>
        </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
            <label className="font-medium text-gray-700">Tìm kiếm</label>
          <input
              type="text"
              className="mt-1 w-full border rounded px-2 py-1"
              placeholder="Tìm theo nội dung, khách hàng, ghi chú..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
          </div>

          <div className="flex items-end">
          <button
              className="w-full bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600"
              onClick={() => {
                setFilters({
                  fromDate: '',
                  toDate: '',
                  type: 'all',
                  source: 'all',
                  search: ''
                });
              }}
            >
              🔄 Xóa lọc
          </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Mã phiếu</th>
              <th className="border p-2 text-left">Ngày</th>
              <th className="border p-2 text-left">Loại</th>
              <th className="border p-2 text-left">Nội dung</th>
              <th className="border p-2 text-right">Số tiền</th>
              <th className="border p-2 text-left">Nguồn</th>
              <th className="border p-2 text-left">Khách hàng/NCC</th>
              <th className="border p-2 text-left">Chi nhánh</th>
              <th className="border p-2 text-left">Ghi chú</th>
              <th className="border p-2 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-4">
                  ⏳ Đang tải dữ liệu...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-4 text-gray-500">
                  Không có giao dịch nào
                </td>
              </tr>
            ) : (
              transactions.map((transaction, index) => (
                <tr key={transaction._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border p-2 text-sm">{transaction.receipt_code || transaction._id?.slice(-6)}</td>
                  <td className="border p-2 text-sm">
                    {transaction.date ? format(new Date(transaction.date), 'dd/MM/yyyy') : ''}
                  </td>
                  <td className="border p-2">
                    <span className={`px-2 py-1 rounded text-white text-xs ${
                      transaction.type === 'thu' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {transaction.type === 'thu' ? 'Thu' : 'Chi'}
                    </span>
                  </td>
                  <td className="border p-2">{transaction.content}</td>
                  <td className="border p-2 text-right font-semibold">
                    {formatMoney(transaction.amount)}
                  </td>
                  <td className="border p-2 text-sm">
                    {transaction.source === 'tien_mat' ? 'Tiền mặt' : 
                     transaction.source === 'the' ? 'Thẻ' : 'Công nợ'}
                  </td>
                  <td className="border p-2 text-sm">
                    {transaction.customer || transaction.supplier || '—'}
                  </td>
                  <td className="border p-2 text-sm">{transaction.branch || '—'}</td>
                  <td className="border p-2 text-sm">{transaction.note || '—'}</td>
                  <td className="border p-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {transaction.editable !== false && (
                        <>
                  <button
                            className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                            onClick={() => handleOpenModal('edit', transaction)}
                            title="Sửa"
                  >
                            ✏️
                  </button>
                  <button
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                            onClick={() => handleDeleteTransaction(transaction._id)}
                            title="Xóa"
                          >
                            🗑️
                  </button>
                        </>
                      )}
                      {transaction.is_auto && (
                        <span className="text-xs text-gray-500" title="Giao dịch tự động">
                          🤖
                        </span>
                      )}
                    </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[600px] max-w-90vw max-h-90vh overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {modal.type === 'edit' ? '✏️ Sửa giao dịch' : '➕ Thêm giao dịch mới'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Loại giao dịch *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="thu">Thu</option>
                  <option value="chi">Chi</option>
                </select>
      </div>

          <div>
                <label className="block font-medium mb-1">Ngày giao dịch *</label>
              <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

              <div>
                <label className="block font-medium mb-1">Nội dung *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                >
                  <option value="">-- Chọn nội dung --</option>
                  {categories[formData.type]?.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
            </div>

              <div>
                <label className="block font-medium mb-1">Số tiền *</label>
              <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="0"
                  value={formatNumberInput(formData.amount)}
                  onChange={e => setFormData(prev => ({ ...prev, amount: unformatNumberInput(e.target.value) }))}
              />
            </div>

              <div>
                <label className="block font-medium mb-1">Nguồn tiền *</label>
              <select
                  className="w-full border rounded px-3 py-2"
                  value={formData.source}
                  onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
              >
                <option value="tien_mat">Tiền mặt</option>
                <option value="the">Thẻ</option>
                  <option value="cong_no">Công nợ</option>
              </select>
            </div>

              <div>
                <label className="block font-medium mb-1">Chi nhánh *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={formData.branch}
                  onChange={e => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  <option value="default">Mặc định</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
            </div>

          <div>
                <label className="block font-medium mb-1">
                  {formData.type === 'thu' ? 'Khách hàng' : 'Nhà cung cấp'}
              </label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder={formData.type === 'thu' ? 'Tên khách hàng' : 'Tên nhà cung cấp'}
                  value={formData.type === 'thu' ? formData.customer : formData.supplier}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    [formData.type === 'thu' ? 'customer' : 'supplier']: e.target.value 
                  }))}
              />
            </div>
            </div>

            <div className="mt-4">
              <label className="block font-medium mb-1">Ghi chú</label>
              <textarea
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Thêm ghi chú (không bắt buộc)"
                value={formData.note}
                onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                onClick={handleSaveTransaction}
              >
                💾 {modal.type === 'edit' ? 'Cập nhật' : 'Lưu'}
              </button>
              <button
                className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
                onClick={handleCloseModal}
              >
                ❌ Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
