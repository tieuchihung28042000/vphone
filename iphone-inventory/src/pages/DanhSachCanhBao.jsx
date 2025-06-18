import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function DanhSachCanhBao() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/canh-bao-ton-kho`)
      .then((res) => res.json())
      .then((res) => {
  // GOM NHÓM THEO SKU + CHI NHÁNH
  const map = {};
  res.items.forEach(item => {
    const key = (item.sku || '') + '|' + (item.branch || '');
    if (!map[key]) {
      map[key] = {
        sku: item.sku,
        tenSanPham: item.tenSanPham || item.product_name,
        branch: item.branch,
        totalRemain: 0,
      };
    }
    map[key].totalRemain += Number(item.totalRemain || item.quantity || 0);
  });

  setData(Object.values(map));
  setLoading(false);
})

      .catch((err) => {
        console.error("Lỗi:", err);
        setLoading(false);
      });
  }, []);

  const handleGuiEmail = () => {
    // Gửi email cảnh báo ở đây (mô phỏng)
    setMessage("✅ Đã gửi email cảnh báo thành công (mô phỏng)");
  };

  const handleTaoDeNghi = () => {
    const content = data
      .map((row) => `- ${row.tenSanPham} (${row.sku}) tại ${row.branch}: còn ${row.totalRemain}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "de-nghi-nhap-hang.txt";
    a.click();
    URL.revokeObjectURL(url);
    setMessage("✅ Đã tạo đơn đề nghị nhập hàng (file .txt)");
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold text-center text-red-600 mb-4">
        ⚠️ Danh sách cần nhập lại
      </h2>

      <div className="flex flex-wrap justify-between mb-4 gap-2">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleGuiEmail}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            📧 Gửi email cảnh báo
          </button>
          <button
            onClick={handleTaoDeNghi}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            📄 Tạo đơn đề nghị nhập hàng
          </button>
        </div>
        <button
  onClick={() => navigate("/ton-kho-so-luong")}
  className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
>
  🡄 QUAY LẠI TỒN KHO
</button>

      </div>

      {message && (
        <p className="text-center text-green-600 font-semibold mb-4">{message}</p>
      )}

      {loading ? (
        <p className="text-center">Đang tải dữ liệu...</p>
      ) : data.length === 0 ? (
        <p className="text-center text-gray-500">
          🎉 Tất cả sản phẩm đều đủ tồn kho
        </p>
      ) : (
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-red-100">
              <th className="border p-2">SKU</th>
              <th className="border p-2">Tên sản phẩm</th>
              <th className="border p-2 text-center">Chi nhánh</th>
              <th className="border p-2 text-center">Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-yellow-50">
                <td className="border p-2">{row.sku}</td>
                <td className="border p-2">{row.tenSanPham}</td>
                <td className="border p-2 text-center">{row.branch}</td>
                <td className="border p-2 text-center text-red-600 font-semibold">
                  {row.totalRemain}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default DanhSachCanhBao;
