import React, { useEffect, useState } from "react";
import LogoutButton from "./components/LogoutButton";
import { useNavigate } from "react-router-dom";

function BaoCao() {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState("Hôm nay");
  const [branch, setBranch] = useState("all");
  const [showDetails, setShowDetails] = useState(false);
  const [branches, setBranches] = useState([]); // ✅ Thêm state cho branches
  const navigate = useNavigate();

  // Gán sẵn khoảng thời gian các filter nhanh
  const predefined = {
    "Hôm nay": [new Date(), new Date()],
    "Hôm qua": [
      new Date(new Date().setDate(new Date().getDate() - 1)),
      new Date(new Date().setDate(new Date().getDate() - 1)),
    ],
    "Tuần này": [
      new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 1)),
      new Date(),
    ],
    "Tháng này": [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()],
    "Năm nay": [new Date(new Date().getFullYear(), 0, 1), new Date()],
  };

  // ✅ Load branches từ API
  const loadBranches = async () => {
    try {
      console.log('📊 Loading branches for backend report...'); // Debug
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/branches`);
      const data = await response.json();
      
      if (response.ok && data.length > 0) {
        const branchNames = data.map(branch => branch.name);
        setBranches(branchNames);
        
        // ✅ Thiết lập chi nhánh mặc định là chi nhánh đầu tiên
        if (branch === 'all') {
          const defaultBranch = branchNames[0];
          setBranch(defaultBranch);
          console.log('📊 Backend set default branch to:', defaultBranch); // Debug
        }
      } else {
        // Fallback nếu không load được
        const fallbackBranches = ['Dĩ An', 'Quận 9'];
        setBranches(fallbackBranches);
        
        // ✅ Thiết lập chi nhánh mặc định
        if (branch === 'all') {
          setBranch(fallbackBranches[0]);
          console.log('📊 Backend set fallback branch to:', fallbackBranches[0]); // Debug
        }
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      // Fallback nếu có lỗi
      const fallbackBranches = ['Dĩ An', 'Quận 9'];
      setBranches(fallbackBranches);
      
      // ✅ Thiết lập chi nhánh mặc định
      if (branch === 'all') {
        setBranch(fallbackBranches[0]);
        console.log('📊 Backend set error fallback branch to:', fallbackBranches[0]); // Debug
      }
    }
  };

  // Gọi API lấy dữ liệu báo cáo
  const fetchData = async (fromDate, toDate, branchParam) => {
    // ✅ Tránh load nhiều lần khi branch chưa được set
    if (!branchParam || branchParam === 'all') {
      console.log('⚠️ Backend skipping fetchData - branch not set or is "all":', branchParam);
      return;
    }
    
    console.log('📊 Backend fetching report data:', { fromDate, toDate, branch: branchParam }); // Debug
    try {
      let api = `${import.meta.env.VITE_API_URL}/api/bao-cao-loi-nhuan`;
      if (fromDate && toDate) {
        api += `?from=${fromDate}&to=${toDate}&branch=${branchParam}`;
      }
      
      console.log('📊 Backend API URL:', api); // Debug
      const res = await fetch(api);
      const json = await res.json();
      console.log("📊 Backend dữ liệu báo cáo trả về:", json); // DEBUG XEM API TRẢ VỀ
      setData(json);
    } catch (err) {
      console.error("❌ Lỗi khi fetch báo cáo:", err);
      setData(null);
    }
  };

  // ✅ Load branches khi component mount
  useEffect(() => {
    loadBranches();
  }, []);

  // ✅ Khi đổi filter hoặc chi nhánh thì cập nhật ngày và gọi API (với debounce nhẹ)
  useEffect(() => {
    // ✅ Thêm timeout nhỏ để tránh load nhiều lần khi chuyển chi nhánh
    const timeoutId = setTimeout(() => {
      if (filter !== "Tùy chọn" && branch && branch !== 'all') {
        console.log('📊 Backend useEffect triggered:', { filter, branch }); // Debug
        const [f, t] = predefined[filter];
        const fromDate = f.toISOString().slice(0, 10);
        const toDate = t.toISOString().slice(0, 10);
        setFrom(fromDate);
        setTo(toDate);
        fetchData(fromDate, toDate, branch);
      }
    }, 50); // Giảm xuống 50ms để responsive hơn

    return () => clearTimeout(timeoutId);
  }, [filter, branch]);

  // Khi chọn filter "Tùy chọn", nhấn áp dụng sẽ chạy hàm này
  const handleSubmit = (e) => {
    e.preventDefault();
    if (from && to) {
      fetchData(from, to, branch);
    }
  };

  // Lấy danh sách đơn chi tiết từ data
  const orders = data?.orders || data?.items || [];
  
  // Debug: Log dữ liệu để check field mapping
  console.log('Orders sample:', orders[0]);

  return (
    <div className="max-w-5xl mx-auto p-4 relative">
      {/* Đăng xuất */}
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      {/* Menu điều hướng */}
      <div className="flex justify-center space-x-2 mb-6">
        <button
          onClick={() => navigate("/nhap-hang")}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          📥 Nhập hàng
        </button>
        <button
          onClick={() => navigate("/xuat-hang")}
          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
        >
          📤 Xuất hàng
        </button>
        <button
          onClick={() => navigate("/ton-kho-so-luong")}
          className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
        >
          📦 Tồn kho
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-4">📊 Báo cáo lợi nhuận</h2>

      {/* Bộ lọc */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          {["Hôm nay", "Hôm qua", "Tuần này", "Tháng này", "Năm nay", "Tùy chọn"].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>

        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="all">Tất cả chi nhánh</option>
          {branches.map((branchName) => (
            <option key={branchName} value={branchName}>
              Chi nhánh {branchName}
            </option>
          ))}
        </select>

        {filter === "Tùy chọn" && (
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border px-2 py-2 rounded"
              required
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border px-2 py-2 rounded"
              required
            />
            <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded">
              Áp dụng
            </button>
          </form>
        )}
      </div>

      {/* Tổng quan báo cáo */}
      {data ? (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-semibold">
            <div>
              <p className="text-gray-500">Số đơn</p>
              <p>{data.totalDevicesSold || 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Doanh thu</p>
              <p className="text-blue-600 font-semibold">
                {data.totalRevenue?.toLocaleString() || 0} đ
              </p>
            </div>
            <div>
              <p className="text-gray-500">Chi phí</p>
              <p>{data.totalCost?.toLocaleString() || 0} đ</p>
            </div>
            <div>
              <p className="text-gray-500">Lợi nhuận</p>
              <p className="text-green-700">{data.totalProfit?.toLocaleString() || 0} đ</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 mt-4">Đang tải dữ liệu...</p>
      )}

      {/* Danh sách đơn hàng bán chi tiết - LUÔN HIỂN THỊ */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">🗂️ Danh sách đơn hàng chi tiết</h3>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {showDetails ? '🔼 Thu gọn' : '🔽 Xem chi tiết'}
          </button>
        </div>
        
        {showDetails && (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm bg-white rounded-lg shadow">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-3 text-left">Mã hàng (SKU)</th>
                  <th className="border p-3 text-left">Tên sản phẩm</th>
                  <th className="border p-3 text-left">IMEI</th>
                  <th className="border p-3 text-left">Ngày bán</th>
                  <th className="border p-3 text-left">Khách hàng</th>
                  <th className="border p-3 text-right">Giá nhập</th>
                  <th className="border p-3 text-right">Giá bán</th>
                  <th className="border p-3 text-right">Lợi nhuận</th>
                  <th className="border p-3 text-center">Chi nhánh</th>
                </tr>
              </thead>
              <tbody>
                {orders.length > 0 ? (
                  orders.map((item, idx) => {
                    // Flexible field mapping để support cả 2 API format
                    const importPrice = item.price_import || item.import_price || item.cost || 0;
                    const sellPrice = item.price_sell || item.sale_price || item.revenue || 0;
                    const profit = sellPrice - importPrice;
                    const saleDate = item.sold_date || item.sale_date;
                    const formattedDate = saleDate ? new Date(saleDate).toLocaleDateString('vi-VN') : 'N/A';
                    
                    return (
                      <tr key={item._id || idx} className="hover:bg-gray-50">
                        <td className="border p-3 font-mono text-sm">{item.sku || 'N/A'}</td>
                        <td className="border p-3">{item.product_name || item.tenSanPham || 'N/A'}</td>
                        <td className="border p-3 font-mono text-xs">{item.imei || 'N/A'}</td>
                        <td className="border p-3">{formattedDate}</td>
                        <td className="border p-3">
                          <div>{item.customer_name || item.buyer_name || 'Khách lẻ'}</div>
                          <div className="text-xs text-gray-500">{item.customer_phone || item.buyer_phone || ''}</div>
                        </td>
                        <td className="border p-3 text-right font-semibold text-orange-600">
                          {importPrice.toLocaleString()} đ
                        </td>
                        <td className="border p-3 text-right font-semibold text-green-600">
                          {sellPrice.toLocaleString()} đ
                        </td>
                        <td className={`border p-3 text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {profit >= 0 ? '+' : ''}{profit.toLocaleString()} đ
                        </td>
                        <td className="border p-3 text-center">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                            {item.branch || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="border p-4 text-center text-gray-500" colSpan={9}>
                      📭 Không có dữ liệu đơn hàng nào trong khoảng thời gian này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Summary row */}
        {orders.length > 0 && showDetails && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-gray-600 text-sm">Tổng đơn hàng</p>
                <p className="font-bold text-lg">{orders.length}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Tổng doanh thu</p>
                <p className="font-bold text-lg text-green-600">
                  {data.totalRevenue?.toLocaleString() || 0} đ
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Tổng chi phí</p>
                <p className="font-bold text-lg text-orange-600">
                  {data.totalCost?.toLocaleString() || 0} đ
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Tổng lợi nhuận</p>
                <p className="font-bold text-lg text-purple-600">
                  {data.totalProfit?.toLocaleString() || 0} đ
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BaoCao;
