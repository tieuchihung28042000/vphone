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

  // Gọi API lấy dữ liệu báo cáo
  const fetchData = async (fromDate, toDate, branch) => {
    try {
      let api = `${import.meta.env.VITE_API_URL}/api/bao-cao-loi-nhuan`;
      if (fromDate && toDate) {
        api += `?from=${fromDate}&to=${toDate}&branch=${branch}`;
      }
      const res = await fetch(api);
      const json = await res.json();
      console.log("Dữ liệu báo cáo trả về:", json); // DEBUG XEM API TRẢ VỀ
      setData(json);
    } catch (err) {
      console.error("❌ Lỗi khi fetch báo cáo:", err);
      setData(null);
    }
  };

  // Khi đổi filter hoặc chi nhánh thì cập nhật ngày và gọi API luôn
  useEffect(() => {
    if (filter !== "Tùy chọn") {
      const [f, t] = predefined[filter];
      const fromDate = f.toISOString().slice(0, 10);
      const toDate = t.toISOString().slice(0, 10);
      setFrom(fromDate);
      setTo(toDate);
      fetchData(fromDate, toDate, branch);
    }
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
          <option value="Dĩ An">Chi nhánh Dĩ An</option>
          <option value="Gò Vấp">Chi nhánh Gò Vấp</option>
          <option value="Thủ Đức">Chi nhánh Thủ Đức</option>
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
              <button
                className="text-blue-600 font-semibold underline hover:text-blue-800 transition duration-200"
                onClick={() => setShowDetails(!showDetails)}
              >
                {data.totalRevenue?.toLocaleString() || 0} đ{" "}
                <span className="text-sm font-normal">(nhấn vào xem chi tiết)</span>
              </button>
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

      {/* Danh sách đơn hàng bán chi tiết */}
      {showDetails && (
        <div className="mt-8">
          <h3 className="font-bold mb-2 text-lg">🗂️ Danh sách đơn hàng</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
  <tr className="bg-gray-100">
    <th className="border p-2">Mã hàng (SKU)</th>
    <th className="border p-2">Tên SP</th>
    <th className="border p-2">Thời gian bán</th>
    <th className="border p-2">Khách hàng</th>
    <th className="border p-2">Số lượng</th> {/* Thêm dòng này */}
    <th className="border p-2">Giá vốn</th>
    <th className="border p-2">Giá bán</th>
    <th className="border p-2">Lợi nhuận</th>
  </tr>
</thead>
              <tbody>
  {orders.length > 0 ? (
    orders.map((item, idx) => (
      <tr key={item._id || idx}>
        <td className="border p-2">{item.sku}</td>
        <td className="border p-2">{item.product_name}</td>
        <td className="border p-2">{item.sold_date?.slice(0, 10)}</td>
        <td className="border p-2">{item.customer_name}</td>
        <td className="border p-2 text-center">{item.quantity || 1}</td> {/* Thêm dòng này */}
        <td className="border p-2 text-right">{item.price_import?.toLocaleString() || 0} đ</td>
        <td className="border p-2 text-right">{item.price_sell?.toLocaleString() || 0} đ</td>
        <td className="border p-2 text-right">
          {((item.price_sell - (item.price_import || 0)) * (item.quantity || 1))?.toLocaleString() || 0} đ
        </td>
      </tr>
    ))
  ) : (
    <tr>
      <td className="border p-2 text-center" colSpan={8}>Không có dữ liệu đơn hàng nào.</td>
    </tr>
  )}
</tbody>

            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BaoCao;
