import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BaoCao = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalReturnRevenue: 0,
    netRevenue: 0,
    totalExpense: 0,
    operatingProfit: 0,
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
      setReportData(data);
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
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#28a745', margin: '0 0 10px 0' }}>Tổng doanh thu</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
            {formatCurrency(reportData.totalRevenue)}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#dc3545', margin: '0 0 10px 0' }}>Tổng doanh thu trả hàng</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
            {formatCurrency(reportData.totalReturnRevenue)}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#007bff', margin: '0 0 10px 0' }}>Doanh thu thuần</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
            {formatCurrency(reportData.netRevenue)}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#fd7e14', margin: '0 0 10px 0' }}>Tổng chi phí</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>
            {formatCurrency(reportData.totalExpense)}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#6f42c1', margin: '0 0 10px 0' }}>Lợi nhuận hoạt động</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
            {formatCurrency(reportData.operatingProfit)}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ color: '#20c997', margin: '0 0 10px 0' }}>Thu nhập khác</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#20c997' }}>
            {formatCurrency(reportData.otherIncome)}
          </div>
        </div>

        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', border: '2px solid #2196f3' }}>
          <h3 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>Lợi nhuận ròng</h3>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1976d2' }}>
            {formatCurrency(reportData.netProfit)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button 
          onClick={() => navigate('/')}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Quay lại trang chủ
        </button>
      </div>
    </div>
  );
};

export default BaoCao;
