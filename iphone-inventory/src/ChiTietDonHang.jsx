import React, { useEffect, useState } from "react";

function ChiTietDonHang({ from, to, branch }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // Lấy URL động theo biến môi trường (không hardcode localhost)
        const url = new URL(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/bao-cao-don-hang-chi-tiet`);
        if (from && to) {
          url.searchParams.append("from", from);
          url.searchParams.append("to", to);
        }
        if (branch && branch !== "all") {
          url.searchParams.append("branch", branch);
        }

        const res = await fetch(url);
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err) {
        console.error("Lỗi khi tải đơn hàng:", err);
        setOrders([]); // clear list nếu lỗi
      }
    };

    fetchOrders();
  }, [from, to, branch]);

  return (
    <div className="mt-6 bg-white rounded shadow p-4">
      <h3 className="text-xl font-bold mb-4 text-blue-700">📋 Danh sách đơn hàng</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left border">
          <thead className="bg-gray-100 text-gray-700 font-semibold">
            <tr>
              <th className="border px-4 py-2">Mã hàng (SKU)</th>
              <th className="border px-4 py-2">Thời gian bán</th>
              <th className="border px-4 py-2">Khách hàng</th>
              <th className="border px-4 py-2">Giá vốn</th>
              <th className="border px-4 py-2">Giá bán</th>
              <th className="border px-4 py-2">Lợi nhuận</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((item, index) => (
              <tr key={item._id || index} className="border-t hover:bg-gray-50">
                <td className="border px-4 py-2">{item.sku}</td>
                <td className="border px-4 py-2">
                  {item.sold_date ? new Date(item.sold_date).toLocaleString("vi-VN") : ""}
                </td>
                <td className="border px-4 py-2">{item.customer_name || item.customer || "Khách lẻ"}</td>
                <td className="border px-4 py-2">
                  {(item.giaNhap || item.price_import || 0).toLocaleString()} đ
                </td>
                <td className="border px-4 py-2">
                  {(item.giaBan || item.price_sell || 0).toLocaleString()} đ
                </td>
                <td className="border px-4 py-2 text-green-600 font-semibold">
                  {((item.giaBan || item.price_sell || 0) - (item.giaNhap || item.price_import || 0)).toLocaleString()} đ
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-4 text-gray-500">
                  Không có dữ liệu đơn hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ChiTietDonHang;
