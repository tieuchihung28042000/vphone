import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";

function TonKhoSoLuong() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [selectedSKU, setSelectedSKU] = useState(null);
  const [imeiList, setImeiList] = useState([]);
  const [imeiDetails, setImeiDetails] = useState([]); // ✅ Thêm state cho chi tiết IMEI
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
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
              branch: item.branch || "Mặc định",
              importMonth,
              totalImport: 0,
              totalSold: 0,
              totalRemain: 0,
              imeis: [],
            };
          }

          grouped[key].totalImport += 1;
          if (item.status === "sold") {
            grouped[key].totalSold += 1;
          } else {
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
    return matchSearch && matchBranch && matchMonth && matchLowStock;
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TonKho");
    XLSX.writeFile(workbook, "TonKho.xlsx");
  };

  // ✅ Cập nhật handleShowIMEI để fetch chi tiết
  const handleShowIMEI = async (row) => {
    setSelectedSKU(row.sku);
    setImeiList(row.imeis);
    
    // Fetch detailed info for each IMEI
    try {
      const imeiDetailsPromises = row.imeis.map(async (imei) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/imei-detail/${imei}`);
        if (res.ok) {
          const data = await res.json();
          return data.item;
        }
        return null;
      });
      
      const details = await Promise.all(imeiDetailsPromises);
      setImeiDetails(details.filter(item => item !== null));
    } catch (err) {
      console.error('Error fetching IMEI details:', err);
      setImeiDetails([]);
    }
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
          <option value="Gò Vấp">Gò Vấp</option>
          <option value="Dĩ An">Dĩ An</option>
          <option value="Thủ Đức">Thủ Đức</option>
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
        <button
          onClick={() => navigate("/canh-bao-ton-kho")}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          ⚠️ Danh sách cần nhập
        </button>
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

      {/* ✅ IMEI Detail Modal - COPY từ iphone-inventory */}
      {selectedSKU && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-6xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">📱 Chi tiết IMEI - SKU: {selectedSKU}</h3>
            
            {imeiDetails.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Đang tải thông tin chi tiết...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">IMEI</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Tên sản phẩm</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Giá nhập</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Ngày nhập</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Nhà cung cấp</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Nhập bởi</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imeiDetails.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm font-semibold text-blue-600">{item.imei}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">{item.product_name}</div>
                          <div className="text-xs text-gray-500">{item.category}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-green-600">
                            {item.price_import ? item.price_import.toLocaleString() : 0}đ
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600">
                            {item.import_date ? new Date(item.import_date).toLocaleDateString('vi-VN') : 'Không rõ'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700">{item.supplier || 'Không rõ'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700">{item.imported_by}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'sold' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {item.status === 'sold' ? '✅ Đã bán' : '📦 Tồn kho'}
                          </span>
                          {item.status === 'sold' && (
                            <div className="text-xs text-gray-500 mt-1">
                              Bán: {item.sold_date ? new Date(item.sold_date).toLocaleDateString('vi-VN') : ''}
                              {item.customer_name && <br />}
                              {item.customer_name && `KH: ${item.customer_name}`}
                              {item.profit && (
                                <div className="text-blue-600 font-semibold">
                                  LN: +{item.profit.toLocaleString()}đ
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setSelectedSKU(null);
                  setImeiList([]);
                  setImeiDetails([]);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition-all"
              >
                ❌ Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TonKhoSoLuong;
