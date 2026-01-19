import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BaoCao = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userBranch, setUserBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalReturnRevenue: 0,
    netRevenue: 0,
    totalCost: 0, // Tổng giá vốn
    grossProfit: 0, // Lợi nhuận gộp
    totalExpense: 0,
    otherIncome: 0,
    netProfit: 0
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
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
        }
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
  }, []);

  // Load danh sách chi nhánh
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await fetch(getApiUrl('/api/branches'), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          // API trả về [{_id, name}] hoặc [string], cần extract name
          const branchList = Array.isArray(data) 
            ? data.map(b => typeof b === 'string' ? b : (b.name || b))
            : [];
          setBranches(branchList);
        }
      } catch (err) {
        console.error('Error loading branches:', err);
      }
    };
    loadBranches();
  }, []);

  // Load danh sách danh mục
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch(getApiUrl('/api/categories'), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          // API trả về [{_id, name}] hoặc [string], cần extract name
          const categoryList = Array.isArray(data) 
            ? data.map(c => typeof c === 'string' ? c : (c.name || c))
            : [];
          setCategories(categoryList);
        }
      } catch (err) {
        console.error('Error loading categories:', err);
        // Fallback: lấy từ inventory nếu API categories không có
        try {
          const invRes = await fetch(getApiUrl('/api/ton-kho'), {
            headers: getAuthHeaders()
          });
          if (invRes.ok) {
            const invData = await invRes.json();
            const uniqueCategories = [...new Set((invData.items || []).map(item => item.category).filter(Boolean))];
            setCategories(uniqueCategories.sort());
          }
        } catch (e) {
          console.error('Error loading categories from inventory:', e);
        }
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    loadFinancialReport();
  }, [selectedBranch, selectedCategory]);

  const loadFinancialReport = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch && selectedBranch !== 'all' ? `&branch=${selectedBranch}` : '';
      const categoryParam = selectedCategory && selectedCategory !== 'all' ? `&category=${selectedCategory}` : '';
      const url = `${getApiUrl('/api/report/financial-report/summary')}?from=2024-01-01&to=2024-12-31${branchParam}${categoryParam}`;
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      // Tính lợi nhuận gộp nếu chưa có
      const grossProfit = (data.totalCost !== undefined)
        ? (data.totalRevenue || 0) - (data.totalCost || 0)
        : (data.grossProfit || 0);
      setReportData({
        ...data,
        grossProfit
      });
    } catch (err) {
      console.error('❌ Error loading financial report:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Đang tải báo cáo...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Báo cáo tài chính tổng hợp</h2>

      {/* Filter branch và category */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 'bold' }}>Chi nhánh:</label>
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          disabled={
            // Disable nếu là admin chi nhánh, nhân viên hoặc thu ngân
            (userRole === 'admin' && userBranch) ||
            userRole === 'quan_ly_chi_nhanh' ||
            userRole === 'nhan_vien_ban_hang' ||
            userRole === 'thu_ngan'
          }
          style={{
            padding: '8px 12px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            fontSize: '14px',
            minWidth: '200px',
            cursor: ((userRole === 'admin' && userBranch) || userRole === 'quan_ly_chi_nhanh' || userRole === 'nhan_vien_ban_hang' || userRole === 'thu_ngan') ? 'not-allowed' : 'pointer',
            opacity: ((userRole === 'admin' && userBranch) || userRole === 'quan_ly_chi_nhanh' || userRole === 'nhan_vien_ban_hang' || userRole === 'thu_ngan') ? 0.6 : 1
          }}
        >
          <option value="all">Tất cả chi nhánh</option>
          {/* Admin tổng thấy tất cả, admin chi nhánh chỉ thấy chi nhánh của mình */}
          {Array.isArray(branches) && ((userRole === 'admin' && !userBranch) ? branches : (userBranch ? [userBranch] : branches)).map((branch) => {
            const branchName = typeof branch === 'string' ? branch : (branch?.name || branch);
            return <option key={branchName} value={branchName}>{branchName}</option>;
          })}
        </select>
        <label style={{ fontWeight: 'bold', marginLeft: '20px' }}>Danh mục:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            fontSize: '14px',
            minWidth: '200px',
            cursor: 'pointer'
          }}
        >
          <option value="all">Tất cả danh mục</option>
          {Array.isArray(categories) && categories.map((category) => {
            const categoryName = typeof category === 'string' ? category : (category?.name || category);
            return <option key={categoryName} value={categoryName}>{categoryName}</option>;
          })}
        </select>
        {(userRole === 'admin' && userBranch) && (
          <span style={{ fontSize: '12px', color: '#666' }}>
            (Admin chi nhánh: Chỉ xem được chi nhánh {typeof userBranch === 'string' ? userBranch : (userBranch?.name || userBranch)})
          </span>
        )}
        {userRole === 'thu_ngan' && (
          <span style={{ fontSize: '12px', color: '#666' }}>
            (Thu ngân: Chỉ xem báo cáo chi nhánh {typeof userBranch === 'string' ? userBranch : (userBranch?.name || userBranch) || selectedBranch})
          </span>
        )}
        {userRole === 'nhan_vien_ban_hang' && (
          <span style={{ fontSize: '12px', color: '#666' }}>
            (Nhân viên: Chỉ xem được xuất hàng chi nhánh {typeof userBranch === 'string' ? userBranch : (userBranch?.name || userBranch) || selectedBranch})
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#28a745', margin: '0 0 10px 0' }}>Tổng doanh thu bán hàng</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{formatCurrency(reportData.totalRevenue)}</div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#dc3545', margin: '0 0 10px 0' }}>Tổng doanh thu trả hàng</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>{formatCurrency(reportData.totalReturnRevenue)}</div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#007bff', margin: '0 0 10px 0' }}>Doanh thu thuần</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{formatCurrency(reportData.netRevenue)}</div>
        </div>
        <div style={{ background: '#fff3cd', padding: '20px', borderRadius: '8px', border: '1px solid #ffc107' }}>
          <h3 style={{ color: '#856404', margin: '0 0 10px 0' }}>Giá vốn</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#856404' }}>{formatCurrency(reportData.totalCost)}</div>
        </div>
        <div style={{ background: '#d1ecf1', padding: '20px', borderRadius: '8px', border: '1px solid #17a2b8' }}>
          <h3 style={{ color: '#0c5460', margin: '0 0 10px 0' }}>Lợi nhuận gộp</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c5460' }}>{formatCurrency(reportData.grossProfit)}</div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#fd7e14', margin: '0 0 10px 0' }}>Tổng chi phí</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>{formatCurrency(reportData.totalExpense)}</div>
        </div>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#20c997', margin: '0 0 10px 0' }}>Thu nhập khác</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#20c997' }}>{formatCurrency(reportData.otherIncome)}</div>
        </div>
        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', border: '2px solid #2196f3' }}>
          <h3 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>Lợi nhuận thuần</h3>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1976d2' }}>{formatCurrency(reportData.netProfit)}</div>
        </div>
      </div>
      <div style={{ marginTop: '30px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={async () => {
            try {
              const branchParam = selectedBranch && selectedBranch !== 'all' ? `&branch=${selectedBranch}` : '';
              const categoryParam = selectedCategory && selectedCategory !== 'all' ? `&category=${selectedCategory}` : '';
              const url = `${getApiUrl('/api/report/export-excel')}?from=2024-01-01&to=2024-12-31${branchParam}${categoryParam}`;
              const res = await fetch(url, {
                headers: getAuthHeaders()
              });

              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
              }

              const blob = await res.blob();
              const downloadUrl = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = `baocao_taichinh_2024-01-01_2024-12-31.xlsx`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(downloadUrl);
              document.body.removeChild(a);
            } catch (err) {
              console.error('❌ Error exporting Excel:', err);
              alert('❌ Lỗi xuất Excel: ' + err.message);
            }
          }}
          style={{ background: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}
        >
          📊 Xuất Excel
        </button>
        <button
          onClick={() => navigate('/')}
          style={{ background: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}
        >
          Quay lại trang chủ
        </button>
      </div>
    </div>
  );
};

export default BaoCao;
