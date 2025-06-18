import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";

// Nếu bạn cần hàm formatNumber, bật dòng này
// function formatNumber(num) { return num ? num.toLocaleString('vi-VN') : '0'; }

function TonKhoSoLuong() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all"); // Thêm state lọc category
  const [categories, setCategories] = useState([]);            // Thêm state list category
  const [selectedSKU, setSelectedSKU] = useState(null);
  const [imeiList, setImeiList] = useState([]);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [branches, setBranches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/ton-kho`)
      .then((res) => res.json())
      .then((res) => {
        // Debug xem có dữ liệu không
        console.log("API trả về:", res.items);

        const grouped = {};

        res.items.forEach((item) => {
          // SỬA: dùng import_date thay vì ngayNhap
          const importDate = item.import_date ? new Date(item.import_date) : null;
          const importMonth =
            importDate && !isNaN(importDate)
              ? `${importDate.getFullYear()}-${String(importDate.getMonth() + 1).padStart(2, "0")}`
              : "Không rõ";

          const key = (item.sku || "unk") + (item.branch || "") + importMonth;
          if (!grouped[key]) {
            grouped[key] = {
              sku: item.sku || "Không rõ",
              tenSanPham: item.tenSanPham || item.product_name || "Không rõ",
              branch: (item.branch || "Mặc định").trim(),
              importMonth,
              category: item.category || "Không rõ", // Có category ở đây
              totalImport: 0,
              totalSold: 0,
              totalRemain: 0,
              imeis: [],
            };
          }

          const isAccessory = !item.imei;
          const importQty = isAccessory ? Number(item.quantity) || 0 : 1;
          const soldQty = isAccessory ? Number(item.sold_quantity) || 0 : (item.status === "sold" ? 1 : 0);

          grouped[key].totalImport += importQty;
          grouped[key].totalSold += soldQty;

          if (!isAccessory && item.status !== "sold") {
            grouped[key].imeis.push(item.imei);
          }
        });

        const result = Object.values(grouped)
          .map((g) => ({
            ...g,
            totalRemain: g.totalImport - g.totalSold,
          }))
          .filter((g) => g.totalRemain >= 0);

        setData(result);

        // --- Lấy danh sách chi nhánh tự động từ dữ liệu ---
        const allBranches = Array.from(
          new Set(result.map(row => (row.branch || "Mặc định").trim()))
        );
        setBranches(allBranches);

        // --- Lấy danh sách category tự động từ dữ liệu ---
        const allCategories = Array.from(
          new Set(result.map(row => (row.category || "Không rõ").trim()))
        );
        setCategories(allCategories);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi:", err);
        setLoading(false);
      });
  }, []);

  const filteredData = data.filter((row) => {
    const combined = `${row.tenSanPham} ${row.sku}`.toLowerCase();
    const matchSearch = combined.includes(search.toLowerCase());
    const matchBranch = branchFilter === "all" || row.branch === branchFilter;
    const matchMonth = monthFilter === "" || row.importMonth === monthFilter;
    const matchLowStock = !showLowStockOnly || row.totalRemain < 2;
    const matchCategory = categoryFilter === "all" || row.category === categoryFilter; // Bổ sung lọc category
    return matchSearch && matchBranch && matchMonth && matchLowStock && matchCategory;
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TonKho");
    XLSX.writeFile(workbook, "TonKho.xlsx");
  };

  const handleShowIMEI = (row) => {
    setSelectedSKU(row.sku);
    setImeiList(row.imeis);
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 bg-white shadow rounded-xl p-6 relative">
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      {/* ✅ Menu điều hướng */}
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
          onClick={() => navigate("/bao-cao")}
          className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
        >
          📋 Báo cáo
        </button>
      </div>

      <h2 className="text-2xl font-bold text-center text-green-600 mb-6">
        📦 Tồn kho theo số lượng
      </h2>

      <div className="mb-4 flex flex-col md:flex-row gap-2 justify-between items-center">
        <input
          type="text"
          placeholder="Tìm theo tên hoặc SKU..."
          className="border rounded px-4 py-2 w-full md:w-1/3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-4 py-2"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="all">Tất cả chi nhánh</option>
          {branches.map(branch => (
            <option key={branch} value={branch}>{branch}</option>
          ))}
        </select>
        {/* Thêm dropdown lọc thư mục/category */}
        <select
          className="border rounded px-4 py-2"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">Tất cả thư mục</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <input
          type="month"
          className="border rounded px-4 py-2"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />
        <button
          onClick={exportToExcel}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📅 Xuất Excel
        </button>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={() => setShowLowStockOnly(!showLowStockOnly)}
          />
          <span className="text-sm">⚠️ Chỉ hiện hàng còn dưới 2</span>
        </label>
      </div>

      {loading ? (
        <p className="text-center">Đang tải dữ liệu...</p>
      ) : filteredData.length === 0 ? (
        <p className="text-center text-gray-500">Không có dữ liệu tồn kho phù hợp.</p>
      ) : (
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border p-2">Mã hàng (SKU)</th>
              <th className="border p-2">Tên sản phẩm</th>
              <th className="border p-2 text-center">Thư mục</th>
              <th className="border p-2 text-center">Tổng nhập</th>
              <th className="border p-2 text-center">Tổng xuất</th>
              <th className="border p-2 text-center">Còn lại</th>
              <th className="border p-2 text-center">Chi nhánh</th>
              <th className="border p-2 text-center">Tháng nhập</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr
                key={idx}
                className={`hover:bg-gray-50 cursor-pointer ${
                  row.totalRemain < 3 ? "bg-yellow-100" : ""
                }`}
                onClick={() => handleShowIMEI(row)}
              >
                <td className="border p-2 text-blue-700 underline">{row.sku}</td>
                <td className="border p-2">{row.tenSanPham}</td>
                <td className="border p-2 text-center">{row.category}</td>
                <td className="border p-2 text-center">{row.totalImport}</td>
                <td className="border p-2 text-center">{row.totalSold}</td>
                <td
                  className={`border p-2 text-center font-semibold ${
                    row.totalRemain < 1 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {row.totalRemain}
                </td>
                <td className="border p-2 text-center">{row.branch}</td>
                <td className="border p-2 text-center">{row.importMonth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedSKU && imeiList.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-2 text-blue-600">
            IMEI còn trong kho của SKU: {selectedSKU}
          </h3>
          <ul className="list-disc pl-6">
            {imeiList.map((imei, idx) => (
              <li key={idx}>{imei}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TonKhoSoLuong;
