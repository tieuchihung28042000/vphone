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

  // Helper function để lấy headers với token
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // ✅ Helper function để đảm bảo API URL luôn đi qua nginx proxy
  // Khi VITE_API_URL rỗng, dùng relative path để nginx proxy đến backend
  const getApiUrl = (endpoint) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    // Nếu có VITE_API_URL thì dùng, nếu không thì dùng relative path (đi qua nginx)
    if (apiBase) {
      return `${apiBase.replace(/\/+$/, '')}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    }
    // Relative path sẽ được browser resolve thành current origin + endpoint
    return endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  };

  // Helper function để xử lý lỗi API một cách thống nhất
  const handleApiError = (error, context = '') => {
    console.error(`❌ Error ${context}:`, error);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      context: context
    });

    let errorMsg = '❌ Lỗi không xác định';

    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.name === 'TypeError') {
      errorMsg = '❌ Không thể kết nối đến server. Vui lòng kiểm tra:\n- Kết nối mạng\n- Server có đang chạy không\n- URL API có đúng không';
    } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorMsg = '❌ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      errorMsg = '❌ Bạn không có quyền thực hiện thao tác này.';
    } else if (error.message?.includes('404') || error.message?.includes('Not Found')) {
      errorMsg = '❌ Không tìm thấy tài nguyên.';
    } else if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
      errorMsg = '❌ Lỗi server. Vui lòng thử lại sau hoặc liên hệ quản trị viên.';
    } else if (error.message) {
      errorMsg = `❌ ${error.message}`;
    }

    return errorMsg;
  };

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

  // State cho user role và branch
  const [userRole, setUserRole] = useState(null);
  const [userBranch, setUserBranch] = useState(null);

  // State cho view tổng hợp tất cả chi nhánh
  const [viewMode, setViewMode] = useState('branch'); // 'branch' | 'total'
  const [totalSummary, setTotalSummary] = useState({
    totalThu: 0,
    totalChi: 0,
    balance: 0,
    branchDetails: []
  });

  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    type: 'all',
    source: 'all',
    search: '',
    content: '' // Filter riêng cho nội dung (mô tả)
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
    date: format(new Date(), 'yyyy-MM-dd'),
    include_in_profit: true // Tính vào hoạt động kinh doanh (mặc định: có)
  });

  // ======= GỢI Ý NỘI DUNG (STORY 03) =======
  const [suggestList, setSuggestList] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedSuggestFilter, setSelectedSuggestFilter] = useState('');

  // ======= QUẢN LÝ MÔ TẢ GIAO DỊCH =======
  const [contentModal, setContentModal] = useState({ open: false, type: 'add', data: null });
  const [contentForm, setContentForm] = useState({ content: '', type: 'all' });
  const [contentSuggestions, setContentSuggestions] = useState([]);

  const fetchSuggestList = async (query) => {
    try {
      if (!query || query.trim().length < 2) {
        setSuggestList([]);
        setShowSuggest(false);
        return;
      }
      setSuggestLoading(true);
      const url = getApiUrl('/api/cashbook/contents?limit=50');
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (Array.isArray(json)) {
        // Ưu tiên những content khớp với query
        const q = query.toLowerCase();
        const filtered = json
          .filter(i => (i.content || '').toLowerCase().includes(q))
          .slice(0, 10);
        setSuggestList(filtered);
        setShowSuggest(filtered.length > 0);
      } else {
        setSuggestList([]);
        setShowSuggest(false);
      }
    } catch (err) {
      console.error('Error fetching cashbook suggestions:', err);
      setSuggestList([]);
      setShowSuggest(false);
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSelectSuggest = (item) => {
    if (!item) return;
    setFormData(prev => ({ ...prev, content: item.content || '' }));
    setShowSuggest(false);
  };

  // ======= QUẢN LÝ MÔ TẢ GIAO DỊCH =======
  const loadContentSuggestions = async () => {
    try {
      const response = await fetch(getApiUrl('/api/cashbook/content-suggestions'), {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setContentSuggestions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error loading content suggestions:', err);
    }
  };

  const handleSaveContent = async (e) => {
    e.preventDefault();
    try {
      const url = contentModal.type === 'edit'
        ? getApiUrl(`/api/cashbook/content-suggestions/${contentModal.data._id}`)
        : getApiUrl('/api/cashbook/content-suggestions');

      const method = contentModal.type === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...contentForm,
          branch: selectedBranch || undefined
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ ' + result.message);
        setContentModal({ open: false, type: 'add', data: null });
        setContentForm({ content: '', type: 'all' });
        await loadContentSuggestions();
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      alert(handleApiError(error, 'saving content'));
    }
  };

  const handleDeleteContent = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa mô tả này?')) return;

    try {
      const response = await fetch(getApiUrl(`/api/cashbook/content-suggestions/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ ' + result.message);
        await loadContentSuggestions();
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      alert(handleApiError(error, 'deleting content'));
    }
  };

  const handleOpenContentModal = (type, data = null) => {
    setContentModal({ open: true, type, data });
    if (data) {
      setContentForm({
        content: data.content || '',
        type: data.type || 'all'
      });
    } else {
      setContentForm({ content: '', type: 'all' });
    }
  };

  // Load danh sách chi nhánh từ database
  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      console.log('🏢 Loading branches...'); // Debug

      const response = await fetch(getApiUrl('/api/branches'));
      const data = await response.json();

      console.log('🏢 Branches API response:', data); // Debug

      if (response.ok) {
        const branchNames = Array.isArray(data) ? data.map(branch => branch.name) : [];
        setBranches(branchNames);

        if (branchNames.length > 0) {
          const saved = localStorage.getItem('selectedBranch');
          const defaultBranch = selectedBranch || saved || branchNames[0];
          setSelectedBranch(defaultBranch);
          localStorage.setItem('selectedBranch', defaultBranch);
          console.log('🏢 Set default branch:', defaultBranch); // Debug
        } else {
          // Không có chi nhánh -> để trống
          setSelectedBranch('');
          localStorage.removeItem('selectedBranch');
          console.log('🏢 No branches available, leaving selection empty');
        }
      } else {
        // Lỗi từ API -> không đặt fallback, để trống
        setBranches([]);
        setSelectedBranch('');
        localStorage.removeItem('selectedBranch');
        console.log('🏢 Branch API error, leaving selection empty');
      }
    } catch (error) {
      console.error('❌ Error loading branches:', error);
      // Lỗi kết nối -> để trống danh sách và bỏ chọn chi nhánh
      setBranches([]);
      setSelectedBranch('');
      localStorage.removeItem('selectedBranch');
      console.log('🏢 Error loading branches, leaving selection empty');
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadTransactions = async () => {
    if (viewMode === 'branch' && !selectedBranch) {
      console.log('⚠️ No selectedBranch, skipping loadTransactions'); // Debug
      return; // Không load nếu chưa có chi nhánh
    }

    console.log('🔄 loadTransactions called with:', { viewMode, selectedBranch }); // Debug
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });

      // Chỉ filter theo chi nhánh nếu đang ở view chi nhánh
      if (viewMode === 'branch' && selectedBranch) {
        params.append('branch', selectedBranch);
        console.log('📋 Adding branch filter:', selectedBranch); // Debug
      }

      Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key] !== 'all' && filters[key] !== '') {
          if (key === 'fromDate') params.append('from', filters[key]);
          else if (key === 'toDate') params.append('to', filters[key]);
          else if (key === 'content') params.append('content', filters[key]); // Gửi filter content riêng
          else params.append(key, filters[key]);
        }
      });

      // ✅ Đảm bảo luôn dùng relative path để đi qua nginx proxy
      const apiUrl = getApiUrl(`/api/cashbook?${params}`);
      console.log('🔍 Fetching transactions from:', apiUrl);
      console.log('🔍 Using API URL helper - will go through nginx proxy');

      const response = await fetch(apiUrl, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
          url: apiUrl
        });

        if (response.status === 401 || response.status === 403) {
          alert('❌ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          // Có thể redirect đến trang login ở đây
          return;
        }

        throw new Error(`API Error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const data = await response.json();

      if (response.ok) {
        setTransactions(data.items || []);
        setSummary(data.summary || { totalThu: 0, totalChi: 0, balance: 0 });
        setPagination(prev => ({
          ...prev,
          total: data.total || 0
        }));
      }
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
      console.error('❌ Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        params: params.toString()
      });
      // Không hiển thị alert cho lỗi load để tránh spam, chỉ log
    }
    setLoading(false);
  };

  // Load tổng hợp tất cả chi nhánh
  const loadTotalSummary = async () => {
    try {
      const params = new URLSearchParams();

      Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key] !== 'all' && filters[key] !== '') {
          if (key === 'fromDate') params.append('from', filters[key]);
          else if (key === 'toDate') params.append('to', filters[key]);
          else params.append(key, filters[key]);
        }
      });

      const response = await fetch(getApiUrl(`/api/cashbook/total-summary?${params}`), {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (response.ok) {
        setTotalSummary(data);
      }
    } catch (error) {
      console.error('Error loading total summary:', error);
    }
  };

  // Load số dư theo nguồn tiền
  const loadBalanceBySource = async () => {
    if (!selectedBranch) return;

    try {
      const response = await fetch(getApiUrl(`/api/cashbook/balance?branch=${selectedBranch}`), {
        headers: getAuthHeaders()
      });
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
  const handleAdjustBalance = async (e) => {
    e.preventDefault();

    if (!balanceForm.branch) {
      alert('❌ Vui lòng chọn chi nhánh');
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/cashbook/adjust-balance'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          branch: balanceForm.branch, // Sử dụng chi nhánh từ form
          tien_mat: balanceForm.tien_mat ? Number(unformatNumberInput(balanceForm.tien_mat)) : undefined,
          the: balanceForm.the ? Number(unformatNumberInput(balanceForm.the)) : undefined,
          vi_dien_tu: balanceForm.vi_dien_tu ? Number(unformatNumberInput(balanceForm.vi_dien_tu)) : undefined,
          note: balanceForm.note,
          user: 'Admin' // Có thể lấy từ user context nếu có
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Đã cập nhật số dư cho chi nhánh ${balanceForm.branch}: ${result.message}`);
        setEditBalanceModal(false);
        setBalanceForm({ branch: '', tien_mat: '', the: '', vi_dien_tu: '', note: '' });

        // Reload dữ liệu nếu đang xem chi nhánh vừa cập nhật
        if (selectedBranch === balanceForm.branch) {
          loadBalanceBySource();
          loadTransactions();
        }
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      alert(handleApiError(error, 'adjusting balance'));
    }
  };

  // Mở modal chỉnh sửa tổng quỹ
  const handleOpenEditBalance = () => {
    setBalanceForm({
      branch: selectedBranch || '', // Sử dụng chi nhánh đang chọn làm mặc định
      tien_mat: balanceBySource.tien_mat.toString(),
      the: balanceBySource.the.toString(),
      vi_dien_tu: balanceBySource.vi_dien_tu.toString(),
      note: ''
    });
    setEditBalanceModal(true);
  };

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
          setSelectedBranch(payload.branch_name);
          localStorage.setItem('selectedBranch', payload.branch_name);
        }
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
  }, []);

  // Load chi nhánh khi component mount
  useEffect(() => {
    loadBranches();
    loadContentSuggestions();
  }, []);

  // Load transactions khi có selectedBranch và các filter thay đổi
  useEffect(() => {
    // ✅ Thêm timeout để đảm bảo selectedBranch đã được set đúng
    const timeoutId = setTimeout(() => {
      if (viewMode === 'branch' && selectedBranch) {
        console.log('🔄 Loading data for branch:', selectedBranch); // Debug
        loadTransactions();
        loadBalanceBySource();
      } else if (viewMode === 'total') {
        loadTotalSummary();
      }
    }, 100); // Delay nhỏ để đảm bảo state đã update

    return () => clearTimeout(timeoutId);
  }, [filters, pagination.page, selectedBranch, viewMode]);

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
        amount: data.amount?.toString() || '',
        include_in_profit: data.include_in_profit !== false // Default true nếu không có
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
        date: format(new Date(), 'yyyy-MM-dd'),
        include_in_profit: true
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
        ? getApiUrl(`/api/cashbook/${modal.data._id}`)
        : getApiUrl('/api/cashbook');

      const method = modal.type === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
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
      alert(handleApiError(error, `saving transaction (${method} ${url})`));
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa giao dịch này?')) return;

    try {
      const response = await fetch(getApiUrl(`/api/cashbook/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ ' + result.message);
        loadTransactions();
      } else {
        alert('❌ ' + result.message);
      }
    } catch (error) {
      alert(handleApiError(error, `deleting transaction (id: ${id})`));
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

      const response = await fetch(getApiUrl(`/api/cashbook/export-excel?${params}`), {
        headers: getAuthHeaders()
      });

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
      {/* View Mode Toggle */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1 mb-6">
        <div className="flex">
          <button
            onClick={() => {
              setViewMode('branch');
              loadTransactions();
            }}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${viewMode === 'branch'
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-600 hover:text-blue-600"
              }`}
          >
            🏢 Theo chi nhánh
          </button>
          <button
            onClick={() => {
              setViewMode('total');
              loadTotalSummary();
            }}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${viewMode === 'total'
                ? "bg-green-600 text-white shadow-md"
                : "text-gray-600 hover:text-green-600"
              }`}
          >
            📊 Sổ quỹ tổng
          </button>
        </div>
      </div>

      {/* Branch Selector - chỉ hiển thị khi view chi nhánh */}
      {viewMode === 'branch' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">📍 Chọn chi nhánh</h3>
              <p className="text-sm text-gray-600">Xem sổ quỹ theo từng chi nhánh cụ thể</p>
            </div>
            <div className="flex-1 max-w-xs ml-6">
              {loadingBranches ? (
                <div className="flex items-center justify-center py-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Đang tải...</span>
                </div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={async (e) => {
                    const newBranch = e.target.value;
                    console.log('🏢 Branch changed to:', newBranch); // Debug

                    setSelectedBranch(newBranch);

                    // ✅ Lưu vào localStorage để nhớ lựa chọn
                    if (newBranch) {
                      localStorage.setItem('selectedBranch', newBranch);
                    } else {
                      localStorage.removeItem('selectedBranch');
                    }

                    // ✅ Reset data ngay lập tức để tránh hiển thị data cũ
                    setTransactions([]);
                    setBalanceBySource({ tien_mat: 0, the: 0, vi_dien_tu: 0 });
                    setSummary({ totalThu: 0, totalChi: 0, balance: 0 });

                    // ✅ Reload data ngay lập tức cho chi nhánh mới
                    if (newBranch) {
                      setLoading(true);
                      try {
                        await Promise.all([
                          loadTransactions(),
                          loadBalanceBySource()
                        ]);
                      } catch (error) {
                        console.error('❌ Error reloading data for branch:', newBranch, error);
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  disabled={
                    // Disable nếu là admin chi nhánh, nhân viên hoặc thu ngân
                    (userRole === 'admin' && userBranch) ||
                    userRole === 'quan_ly_chi_nhanh' ||
                    userRole === 'nhan_vien_ban_hang' ||
                    userRole === 'thu_ngan'
                  }
                  className="form-input text-lg font-semibold"
                  style={{
                    cursor: ((userRole === 'admin' && userBranch) || userRole === 'quan_ly_chi_nhanh' || userRole === 'nhan_vien_ban_hang' || userRole === 'thu_ngan') ? 'not-allowed' : 'pointer',
                    opacity: ((userRole === 'admin' && userBranch) || userRole === 'quan_ly_chi_nhanh' || userRole === 'nhan_vien_ban_hang' || userRole === 'thu_ngan') ? 0.6 : 1
                  }}
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {/* Admin tổng thấy tất cả, admin chi nhánh chỉ thấy chi nhánh của mình */}
                  {((userRole === 'admin' && !userBranch) ? branches : (userBranch ? [userBranch] : branches)).map((branch) => (
                    <option key={branch} value={branch}>
                      🏢 Chi nhánh {branch}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Hiển thị thông tin chi nhánh đang chọn */}
          {selectedBranch && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">🏢</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-blue-900">Chi nhánh {selectedBranch}</h4>
                  <p className="text-sm text-blue-700">Đang xem sổ quỹ của chi nhánh này</p>
                  {/* Hiển thị thông báo phân quyền */}
                  {(userRole === 'admin' && userBranch) && (
                    <p className="text-xs text-orange-600 mt-1">(Admin chi nhánh: Chỉ xem được chi nhánh này)</p>
                  )}
                  {userRole === 'nhan_vien_ban_hang' && (
                    <p className="text-xs text-orange-600 mt-1">(Nhân viên: Chỉ xem được xuất hàng của chi nhánh này)</p>
                  )}
                  {userRole === 'thu_ngan' && (
                    <p className="text-xs text-orange-600 mt-1">(Thu ngân: Chỉ xem được báo cáo của chi nhánh này)</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cảnh báo nếu chưa chọn chi nhánh */}
          {!selectedBranch && (
            <div className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">⚠️</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-orange-900">Chưa chọn chi nhánh</h4>
                  <p className="text-sm text-orange-700">Vui lòng chọn chi nhánh để xem sổ quỹ</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Stats Dashboard */}
      {viewMode === 'branch' ? (
        selectedBranch && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatsCard
              title="Tổng số dư"
              value={`${formatMoney(totalBalance)}`}
              icon="💰"
              color="blue"
              subtitle="👆 Nhấn để chỉnh sửa số dư"
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
              icon="📉"
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
        )
      ) : null}

      {/* Tổng số tiền thu/chi theo filter - Hiển thị luôn, kể cả khi không có filter */}
      {(viewMode === 'branch' ? selectedBranch : true) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatsCard
            title="📊 Tổng thu (theo filter)"
            value={`${formatMoney(summary?.totalThu || 0)}`}
            icon="📈"
            color="green"
            subtitle={summary ? "Tổng số tiền thu trong kết quả lọc" : "Đang tải..."}
          />
          <StatsCard
            title="📉 Tổng chi (theo filter)"
            value={`${formatMoney(summary?.totalChi || 0)}`}
            icon="📉"
            color="red"
            subtitle={summary ? "Tổng số tiền chi trong kết quả lọc" : "Đang tải..."}
          />
          <StatsCard
            title="💰 Số dư (theo filter)"
            value={`${formatMoney((summary?.totalThu || 0) - (summary?.totalChi || 0))}`}
            icon="💰"
            color="blue"
            subtitle={summary ? "Chênh lệch thu - chi" : "Đang tải..."}
          />
        </div>
      )}

      {viewMode === 'total' && (
        // Sổ quỹ tổng - Hiển thị tổng hợp tất cả chi nhánh
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard
              title="Tổng thu"
              value={`${formatMoney(totalSummary.totalThu)}`}
              icon="📈"
              color="green"
              subtitle="Tất cả chi nhánh"
            />
            <StatsCard
              title="Tổng chi"
              value={`${formatMoney(totalSummary.totalChi)}`}
              icon="📉"
              color="red"
              subtitle="Tất cả chi nhánh"
            />
            <StatsCard
              title="Số dư tổng"
              value={`${formatMoney(totalSummary.balance)}`}
              icon="💰"
              color="blue"
              subtitle="Thu - Chi"
            />
            <StatsCard
              title="Tổng giao dịch"
              value={totalSummary.totalTransactions?.toString() || '0'}
              icon="📊"
              color="purple"
              subtitle="Tất cả chi nhánh"
            />
          </div>

          {/* Chi tiết theo từng chi nhánh */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Chi tiết theo chi nhánh</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {totalSummary.branchDetails?.map((branch, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">🏢 {branch.branch || 'Không có tên'}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Thu:</span>
                      <span className="text-green-600 font-semibold">+{formatMoney(branch.totalThu)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Chi:</span>
                      <span className="text-red-600 font-semibold">-{formatMoney(branch.totalChi)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-700 font-medium">Số dư:</span>
                      <span className={`font-bold ${branch.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {formatMoney(branch.balance)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Giao dịch:</span>
                      <span className="text-gray-800 font-medium">{branch.transactions}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Balance by Source - chỉ hiển thị khi view chi nhánh và đã chọn chi nhánh */}
      {viewMode === 'branch' && selectedBranch && (
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
      )}

      {/* Form Card - chỉ hiển thị khi view chi nhánh và đã chọn chi nhánh */}
      {viewMode === 'branch' && selectedBranch && (
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
              date: format(new Date(), 'yyyy-MM-dd'),
              include_in_profit: true
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
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700">Mô tả giao dịch *</label>
                <button
                  type="button"
                  onClick={() => handleOpenContentModal('add')}
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-lg font-medium transition-colors"
                  title="Quản lý danh sách mô tả"
                >
                  📝 Quản lý mô tả
                </button>
              </div>
              <input
                name="content"
                placeholder="Mô tả chi tiết giao dịch"
                value={formData.content}
                onChange={async (e) => {
                  const val = e.target.value;
                  setFormData(prev => ({ ...prev, content: val }));
                  fetchSuggestList(val);
                }}
                className="form-input"
                required
              />
              {/* Gợi ý nội dung */}
              {showSuggest && (
                <div className="mt-2 bg-white border rounded-xl shadow-sm max-h-56 overflow-auto">
                  {suggestLoading && (
                    <div className="px-3 py-2 text-sm text-gray-500">Đang tải gợi ý...</div>
                  )}
                  {!suggestLoading && suggestList.map((it, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSuggest(it)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-800">{it.content}</span>
                      <span className="text-xs text-gray-500">{it.count}</span>
                    </button>
                  ))}
                  {!suggestLoading && suggestList.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">Không có gợi ý</div>
                  )}
                </div>
              )}
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
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.include_in_profit !== false}
                  onChange={(e) => setFormData(prev => ({ ...prev, include_in_profit: e.target.checked }))}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-700">
                  Tính vào hoạt động kinh doanh (lợi nhuận)
                </span>
                <span className="text-xs text-gray-500">
                  (Nếu không tích, chỉ tăng số quỹ, không tính vào lợi nhuận)
                </span>
              </label>
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
      )}

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
          {/* Lọc nhanh theo nội dung đã dùng */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <select
                value={filters.content || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSuggestFilter(val);
                  handleFilterChange('content', val || '');
                }}
                className="form-input"
              >
                <option value="">Lọc theo nội dung (mô tả)</option>
                {suggestList.map((s, i) => (
                  <option key={i} value={s.content}>{s.content} ({s.count})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetchSuggestList(filters.search || formData.content || '')}
                className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                🔄 Nạp gợi ý
              </button>
            </div>
          </div>
        </div>
      </FilterCard>

      {/* Data Table - chỉ hiển thị khi view tổng hoặc đã chọn chi nhánh */}
      {(viewMode === 'total' || (viewMode === 'branch' && selectedBranch)) && (
        <DataTable
          title={viewMode === 'branch' ? `📋 Lịch sử giao dịch - Chi nhánh ${selectedBranch}` : "📋 Lịch sử giao dịch - Tất cả chi nhánh"}
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
      )}

      {/* Edit Balance Modal */}
      {editBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-6">🔧 Chỉnh sửa số dư theo chi nhánh</h3>
            <form onSubmit={handleAdjustBalance} className="space-y-6">
              {/* Dropdown chọn chi nhánh */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">🏢 Chi nhánh *</label>
                <select
                  value={balanceForm.branch || ''}
                  onChange={(e) => setBalanceForm(prev => ({ ...prev, branch: e.target.value }))}
                  className="form-input"
                  required
                >
                  <option value="">-- Chọn chi nhánh để chỉnh sửa số dư --</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Mỗi chi nhánh sẽ có số dư riêng biệt
                </p>
              </div>

              {/* Các trường số dư chỉ hiển thị khi đã chọn chi nhánh */}
              {balanceForm.branch && (
                <>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-3">
                      💰 Chỉnh sửa số dư cho chi nhánh: {balanceForm.branch}
                    </h4>

                    <div className="space-y-4">
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
                    </div>
                  </div>
                </>
              )}

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
                  disabled={!balanceForm.branch}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-xl transition-all"
                >
                  ✅ Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Management Modal */}
      {contentModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {contentModal.type === 'edit' ? '✏️ Chỉnh sửa mô tả' : '➕ Thêm mô tả mới'}
            </h3>

            <form onSubmit={handleSaveContent} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả giao dịch *</label>
                <input
                  type="text"
                  name="content"
                  value={contentForm.content}
                  onChange={(e) => setContentForm(prev => ({ ...prev, content: e.target.value }))}
                  className="form-input"
                  placeholder="Nhập mô tả giao dịch"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Loại</label>
                <select
                  name="type"
                  value={contentForm.type}
                  onChange={(e) => setContentForm(prev => ({ ...prev, type: e.target.value }))}
                  className="form-input"
                >
                  <option value="all">Tất cả</option>
                  <option value="thu">Thu tiền</option>
                  <option value="chi">Chi tiền</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setContentModal({ open: false, type: 'add', data: null });
                    setContentForm({ content: '', type: 'all' });
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  {contentModal.type === 'edit' ? '💾 Cập nhật' : '➕ Thêm mới'}
                </button>
              </div>
            </form>

            {/* Content List for Management */}
            {contentModal.type === 'add' && contentSuggestions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">📝 Danh sách mô tả hiện tại</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {contentSuggestions.map((content) => (
                    <div key={content._id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{content.content}</div>
                        <div className="text-xs text-gray-500">
                          {content.type === 'all' ? 'Tất cả' : content.type === 'thu' ? 'Thu tiền' : 'Chi tiền'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenContentModal('edit', content)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteContent(content._id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
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
