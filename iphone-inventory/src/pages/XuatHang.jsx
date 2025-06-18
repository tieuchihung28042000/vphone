import { useState, useEffect } from "react";
import LogoutButton from "../components/LogoutButton";

// Hàm format số có dấu cách
function formatNumberInput(val) {
  // Xóa ký tự không phải số
  let num = val.replace(/\D/g, "");
  // Format dấu cách mỗi 3 số
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
// Hàm xóa format
function unformatNumberInput(val) {
  return val.replace(/\D/g, "");
}

function XuatHang() {
  const [formData, setFormData] = useState({
    imei: "",
    sold_date: "",
    sku: "",
    product_name: "",
    quantity: "",
    price_sell: "",
    customer_name: "",
    customer_phone: "",
    warranty: "",
    note: "",
    debt: "",
  });

  const [message, setMessage] = useState("");
  const [profit, setProfit] = useState(null);
  const [sales, setSales] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // GỢI Ý SẢN PHẨM THEO TÊN (auto suggest)
  const [suggestList, setSuggestList] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectImeis, setSelectImeis] = useState([]);

  // --- Thêm cho filter/tìm kiếm ---
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Lấy danh sách đơn xuất
  const fetchSales = async () => {
    try {
      const today = new Date();
      const from = "2020-01-01";
      const to = today.toISOString().slice(0, 10);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/bao-cao-don-hang-chi-tiet?from=${from}&to=${to}`
      );
      const data = await res.json();
      setSales(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setSales([]);
    }
  };

  // Lấy tồn kho để gợi ý
  const fetchSuggestList = async (query) => {
    if (!query || query.length < 2) return setSuggestList([]);
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ton-kho`);
    const data = await res.json();
    const lowerQuery = query.trim().toLowerCase();
    const filtered = (data.items || []).filter(
      item =>
        (item.product_name || item.tenSanPham || "")
          .toLowerCase()
          .includes(lowerQuery) ||
        (item.sku || "").toLowerCase().includes(lowerQuery)
    );
    // Gom nhóm: Nếu có IMEI thì nhóm như cũ, nếu không có IMEI thì cộng dồn số lượng (phụ kiện)
    const group = {};
    filtered.forEach(item => {
      const key = (item.product_name || item.tenSanPham || "Không rõ") + "_" + (item.sku || "Không rõ");
      if (!group[key]) {
        group[key] = {
          name: item.product_name || item.tenSanPham || "Không rõ",
          sku: item.sku || "",
          imeis: [],
          soLuong: 0,
          isAccessory: !item.imei
        };
      }
      if (item.imei) {
        group[key].imeis.push(item.imei);
      } else {
        group[key].soLuong += Number(item.so_luong || item.quantity || 1);
      }
    });
    setSuggestList(Object.values(group));
    setShowSuggest(true);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // Khi nhập IMEI sẽ tự động fill tên máy & SKU nếu tìm thấy
  const handleImeiChange = async (e) => {
    const imei = e.target.value;
    setFormData((prev) => ({
      ...prev,
      imei,
      quantity: 1, // iPhone luôn chỉ 1 máy/lần
    }));
    if (imei.length >= 8) {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ton-kho`);
      const data = await res.json();
      const found = (data.items || []).find(item => item.imei === imei);
      if (found) {
        setFormData((prev) => ({
          ...prev,
          product_name: found.product_name || found.tenSanPham || "",
          sku: found.sku || "",
          quantity: 1,
        }));
      }
    }
  };

  // Khi nhập tên sản phẩm -> gợi ý (suggest)
  const handleProductNameChange = async (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, product_name: value }));
    fetchSuggestList(value);
  };

  // Khi chọn 1 gợi ý tên sản phẩm
  const handleSelectSuggest = (item) => {
    setFormData(prev => ({
      ...prev,
      product_name: item.name,
      sku: item.sku,
      imei: item.isAccessory ? "" : (item.imeis.length === 1 ? item.imeis[0] : ""),
      quantity: "" // ĐỂ TRỐNG khi là phụ kiện
    }));
    setShowSuggest(false);
    setSelectImeis(item.isAccessory ? [] : (item.imeis.length > 1 ? item.imeis : []));
  };

  // Nếu nhiều IMEI thì chọn tiếp
  const handleSelectImei = (imei) => {
    setFormData(prev => ({
      ...prev,
      imei,
      quantity: 1
    }));
    setSelectImeis([]);
  };

  // Sửa lại handleChange để format cho price_sell và debt
  const handleChange = (e) => {
    const { name, value, type } = e.target;

    if (name === "price_sell" || name === "debt") {
      setFormData((prev) => ({
        ...prev,
        [name]: formatNumberInput(value),
      }));
    } else if (name === "quantity") {
      setFormData((prev) => ({
        ...prev,
        [name]: value.replace(/\D/g, ""),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "number" ? Number(value) : value,
      }));
    }
  };

  // Nộp hoặc cập nhật đơn xuất
  const handleSubmit = async (e) => {
    e.preventDefault();
    setProfit(null);

    // Chuyển giá và công nợ về số trước khi gửi
    const cleanForm = {
      ...formData,
      price_sell: formData.price_sell ? Number(unformatNumberInput(formData.price_sell)) : "",
      debt: formData.debt ? Number(unformatNumberInput(formData.debt)) : "",
      quantity: formData.quantity ? Number(formData.quantity) : "",
    };

    try {
      let url = `${import.meta.env.VITE_API_URL}/api/xuat-hang`;
      let method = "POST";
      if (editingId) {
        url = `${import.meta.env.VITE_API_URL}/api/xuat-hang/${editingId}`;
        method = "PUT";
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanForm),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ " + (data.message || "Thành công!"));
        setProfit(data.profit || null);
        setFormData({
          imei: "",
          sold_date: "",
          sku: "",
          product_name: "",
          quantity: "",
          price_sell: "",
          customer_name: "",
          customer_phone: "",
          warranty: "",
          note: "",
          debt: "",
        });
        setEditingId(null);
        setSelectImeis([]);
        fetchSales();
      } else {
        setMessage("❌ " + (data.message || "Cập nhật thất bại"));
      }
    } catch (err) {
      setMessage("❌ Lỗi kết nối tới server");
    }
  };

  // ... Sửa đơn xuất và các hàm khác giữ nguyên ...

  const inputClass = "w-full border p-2 rounded h-10";

  // --- Phần lọc/tìm kiếm/sắp xếp ---
  const filteredSales = sales
    .filter(item => {
      const text = (item.imei || "") + " " + (item.product_name || "") + " " + (item.sku || "") + " " + (item.customer_phone || "");
      const searchOK = searchText === "" || text.toLowerCase().includes(searchText.toLowerCase());
      const dateOK = filterDate === "" || (item.sold_date && item.sold_date.slice(0, 10) === filterDate);
      return searchOK && dateOK;
    })
    .sort((a, b) => {
      // Sắp xếp mới nhất lên trên
      const dateA = new Date(a.sold_date || "");
      const dateB = new Date(b.sold_date || "");
      return dateB - dateA;
    });
// Sửa đơn xuất (fill form để edit)
const handleEdit = (item) => {
  setFormData({
    imei: item.imei || "",
    sold_date: item.sold_date ? item.sold_date.slice(0, 10) : "",
    sku: item.sku || "",
    product_name: item.product_name || "",
    quantity: item.quantity || "",
    price_sell: item.price_sell || "",
    customer_name: item.customer_name || "",
    customer_phone: item.customer_phone || "",
    warranty: item.warranty || "",
    note: item.note || "",
    debt: item.debt || "",
  });
  setEditingId(item._id);
  setMessage("");
  setProfit(item.profit || null);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Xoá đơn xuất
const handleDelete = async (id) => {
  if (!window.confirm("Bạn chắc chắn xoá đơn xuất này?")) return;
  await fetch(`${import.meta.env.VITE_API_URL}/api/xuat-hang/${id}`, { method: "DELETE" });
  fetchSales();
};

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow mt-10 relative">
      {/* Đăng xuất */}
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      {/* 🚀 Menu điều hướng nhanh */}
      <div className="flex justify-center space-x-2 mb-6">
        <button onClick={() => (window.location.href = "/nhap-hang")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">📥 Nhập hàng</button>
        <button onClick={() => (window.location.href = "/xuat-hang")} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">📤 Xuất hàng</button>
        <button onClick={() => (window.location.href = "/ton-kho-so-luong")} className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700">📦 Tồn kho</button>
        <button onClick={() => (window.location.href = "/bao-cao")} className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">📋 Báo cáo</button>
        <button onClick={() => (window.location.href = "/cong-no")} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700">💸 Công nợ</button>
      </div>

      <h2 className="text-2xl font-bold mb-6 text-center text-red-600">
        Xuất hàng iPhone
      </h2>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 relative">
        <input
          type="text"
          name="imei"
          placeholder="IMEI cần bán"
          value={formData.imei}
          onChange={handleImeiChange}
          className={inputClass}
        />
        <input
          type="date"
          name="sold_date"
          value={formData.sold_date}
          onChange={handleChange}
          className={inputClass}
        />
        <input
          type="text"
          name="sku"
          placeholder="SKU sản phẩm"
          value={formData.sku}
          onChange={handleChange}
          className={inputClass}
        />

        {/* TÊN SẢN PHẨM */}
        <div className="relative">
          <input
            type="text"
            name="product_name"
            placeholder="Tên sản phẩm"
            value={formData.product_name}
            onChange={handleProductNameChange}
            className={inputClass}
            autoComplete="off"
          />
          {/* GỢI Ý SẢN PHẨM */}
          {showSuggest && suggestList.length > 0 && (
            <div className="absolute z-20 left-0 right-0 bg-white border rounded shadow max-h-60 overflow-y-auto">
              {suggestList.map((item, idx) => (
                <div
                  key={item.sku + idx}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex flex-col"
                  onClick={() => handleSelectSuggest(item)}
                >
                  <span className="font-medium text-blue-600">{item.name}</span>
                  <span className="text-xs text-gray-500">
                    SKU: {item.sku} | SL còn: {item.isAccessory ? item.soLuong : item.imeis.length}
                    {item.isAccessory ? "" : (
                      <> | IMEI: {item.imeis.slice(0, 5).join(", ")}{item.imeis.length > 5 ? "..." : ""}</>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SỐ LƯỢNG - Chỉ hiện nếu KHÔNG có IMEI */}
        {!formData.imei && (
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-1">Số lượng</label>
            <input
              type="number"
              name="quantity"
              placeholder="Nhập số lượng phụ kiện cần bán"
              value={formData.quantity}
              onChange={handleChange}
              className={inputClass}
              min={1}
            />
            <span className="text-xs text-gray-500 ml-1">
              Chỉ nhập số lượng khi bán phụ kiện (không điền IMEI)
            </span>
          </div>
        )}

        {/* Nếu nhiều IMEI cho 1 sản phẩm, chọn IMEI */}
        {selectImeis.length > 1 && (
          <div className="bg-blue-50 border rounded px-3 py-2">
            <div className="mb-1 font-medium">Chọn IMEI:</div>
            <div className="flex flex-wrap gap-2">
              {selectImeis.map((im, idx) => (
                <button
                  type="button"
                  className={`px-2 py-1 border rounded ${formData.imei === im ? "bg-blue-600 text-white" : "bg-white"}`}
                  key={im + idx}
                  onClick={() => handleSelectImei(im)}
                >
                  {im}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GIÁ BÁN (tự có dấu cách) */}
        <input
          type="text"
          name="price_sell"
          placeholder="Giá bán"
          value={formData.price_sell}
          onChange={handleChange}
          className={inputClass}
          required
        />
        <input
          type="text"
          name="customer_name"
          placeholder="Tên khách hàng"
          value={formData.customer_name}
          onChange={handleChange}
          className={inputClass}
        />
        <input
          type="text"
          name="customer_phone"
          placeholder="SĐT khách hàng"
          value={formData.customer_phone}
          onChange={handleChange}
          className={inputClass}
        />
        <input
          type="text"
          name="warranty"
          placeholder="Bảo hành (VD: 6 tháng)"
          value={formData.warranty}
          onChange={handleChange}
          className={inputClass}
        />
        <input
          type="text"
          name="note"
          placeholder="Ghi chú"
          value={formData.note}
          onChange={handleChange}
          className={inputClass}
        />
        {/* Công nợ (tự có dấu cách) */}
        <input
          type="text"
          name="debt"
          placeholder="Công nợ (nếu có)"
          value={formData.debt}
          onChange={handleChange}
          className={inputClass}
        />

        <button
          type="submit"
          className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 font-semibold"
        >
          {editingId ? "Cập nhật" : "Xuất hàng"}
        </button>
      </form>

      {message && (
        <p className="mt-4 text-center font-semibold text-blue-600">{message}</p>
      )}

      {profit !== null && (
        <p className="mt-2 text-center text-green-600 font-semibold">
          💰 Lợi nhuận: {Number(profit).toLocaleString()}đ
        </p>
      )}

      {/* THANH TÌM KIẾM & LỌC NGÀY */}
      <div className="flex gap-3 mb-4 mt-10">
        <input
          type="text"
          placeholder="🔎 Tìm kiếm IMEI, tên, SKU, SĐT KH..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
        {filterDate && (
          <button
            type="button"
            onClick={() => setFilterDate("")}
            className="ml-1 text-xs text-red-500 underline"
          >Xoá lọc ngày</button>
        )}
      </div>

      {/* DANH SÁCH ĐƠN XUẤT */}
      <div>
        <h3 className="text-lg font-bold mb-2">Danh sách đơn xuất hàng</h3>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">IMEI</th>
              <th className="border p-2">SKU</th>
              <th className="border p-2">Tên sản phẩm</th>
              <th className="border p-2">Số lượng</th>
              <th className="border p-2 text-center">Giá bán</th>
              <th className="border p-2">Ngày bán</th>
              <th className="border p-2">Khách hàng</th>
              <th className="border p-2">SĐT KH</th>
              <th className="border p-2">Bảo hành</th>
              <th className="border p-2">Ghi chú</th>
              <th className="border p-2">Công nợ</th>
              <th className="border p-2 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((item) => (
              <tr key={item._id}>
                <td className="border p-2">{item.imei || ""}</td>
                <td className="border p-2">{item.sku || ""}</td>
                <td className="border p-2">{item.product_name || ""}</td>
                <td className="border p-2 text-center">{item.quantity || 1}</td>
                <td className="border p-2 text-center">{item.price_sell ? Number(item.price_sell).toLocaleString() : ""}đ</td>
                <td className="border p-2">{item.sold_date ? item.sold_date.slice(0, 10) : ""}</td>
                <td className="border p-2">{item.customer_name || ""}</td>
                <td className="border p-2">{item.customer_phone || ""}</td>
                <td className="border p-2">{item.warranty || ""}</td>
                <td className="border p-2">{item.note || ""}</td>
                <td className="border p-2 text-center">{item.debt ? Number(item.debt).toLocaleString() : ""}</td>
                <td className="border p-2 text-center space-x-1">
                  <button onClick={() => handleEdit(item)} className="bg-yellow-400 text-white px-2 py-1 rounded">✏️</button>
                  <button onClick={() => handleDelete(item._id)} className="bg-red-600 text-white px-2 py-1 rounded">🗑️</button>
                </td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
              <tr>
                <td colSpan="12" className="text-center py-4 text-gray-500">
                  Không có đơn xuất nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default XuatHang;
