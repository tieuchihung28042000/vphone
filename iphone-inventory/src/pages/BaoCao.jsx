import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BaoCao = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    loadFinancialReport();
  }, []);

  const loadFinancialReport = async () => {
    try {
      setLoading(true);
      const url = `${import.meta.env.VITE_API_URL || ''}/api/report/financial-report/summary?from=2024-01-01&to=2024-12-31`;
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
              const url = `${import.meta.env.VITE_API_URL || ''}/api/report/export-excel?from=2024-01-01&to=2024-12-31`;
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
