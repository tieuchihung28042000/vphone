import { useEffect, useState } from "react";
import LogoutButton from "../components/LogoutButton";

function CongNo() {
  const [debts, setDebts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDebt, setCustomerDebt] = useState({ total_debt: 0, total_paid: 0, debt_history: [] });
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");           // Ghi chú trả nợ
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");           // Ghi chú cộng nợ
  const [historyModal, setHistoryModal] = useState({ open: false, history: [] });
  const [detailModal, setDetailModal] = useState({ open: false, orders: [] });
  
  // Thêm state cho tìm kiếm và sửa/xóa khách hàng
  const [searchText, setSearchText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, customer: null });
  const [editForm, setEditForm] = useState({ name: "", phone: "" });

  // Lấy danh sách khách hàng còn nợ
  const fetchDebts = async () => {
    const params = new URLSearchParams();
    if (searchText.trim()) params.append('search', searchText.trim());
    if (showAll) params.append('show_all', 'true');
    
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-list?${params}`);
    const data = await res.json();
    setDebts(data.items || []);
  };

  // Chọn khách hàng để thao tác tổng (truyền cả object khách)
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerDebt({
      total_debt: customer.total_debt || 0,
      total_paid: customer.total_paid || 0,
      debt_history: customer.debt_history || []
    });
    setPayAmount(""); setPayNote("");
    setAddAmount(""); setAddNote("");
  };

  // Trừ nợ tổng cho khách (có ghi chú)
  const handlePayDebt = async () => {
    if (!payAmount || isNaN(payAmount)) return alert("Nhập số tiền muốn trả");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-pay-customer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: selectedCustomer.customer_name,
        customer_phone: selectedCustomer.customer_phone,
        amount: payAmount,
        note: payNote
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Đã cập nhật công nợ!");
      setPayAmount(""); setPayNote("");
      await fetchDebts(); // Cập nhật lại debts từ backend
      // Sau khi fetch xong, tìm đúng khách vừa update để set lại customerDebt mới nhất
      setTimeout(() => {
        // Đảm bảo lấy đúng bản mới nhất vừa fetch
        const updated = debts.find(d =>
          d.customer_name === selectedCustomer.customer_name &&
          d.customer_phone === selectedCustomer.customer_phone
        );
        if (updated) {
          setCustomerDebt({
            total_debt: updated.total_debt,
            total_paid: updated.total_paid,
            debt_history: updated.debt_history || []
          });
        }
      }, 200); // nhỏ delay nhẹ để state debts cập nhật
    } else {
      alert("❌ " + (data.message || "Cập nhật công nợ thất bại!"));
    }
  };

  // Cộng thêm nợ tổng cho khách (có ghi chú)
  const handleAddDebt = async () => {
    if (!addAmount || isNaN(addAmount)) return alert("Nhập số tiền muốn cộng nợ");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-add-customer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: selectedCustomer.customer_name,
        customer_phone: selectedCustomer.customer_phone,
        amount: addAmount,
        note: addNote
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Đã cộng thêm nợ!");
      setAddAmount(""); setAddNote("");
      await fetchDebts();
      setTimeout(() => {
        const updated = debts.find(d =>
          d.customer_name === selectedCustomer.customer_name &&
          d.customer_phone === selectedCustomer.customer_phone
        );
        if (updated) {
          setCustomerDebt({
            total_debt: updated.total_debt,
            total_paid: updated.total_paid,
            debt_history: updated.debt_history || []
          });
        }
      }, 200);
    } else {
      alert("❌ " + (data.message || "Cộng nợ thất bại!"));
    }
  };

  // Lịch sử trả/cộng nợ: lấy từ state customerDebt (đã được cập nhật mới nhất ở trên)
  const handleShowHistory = () => {
    setHistoryModal({ open: true, history: customerDebt.debt_history || [] });
  };

  // Xem chi tiết sản phẩm khách đã mua
  const handleShowDetail = async (customer) => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/cong-no/cong-no-orders?customer_name=${encodeURIComponent(customer.customer_name)}&customer_phone=${encodeURIComponent(customer.customer_phone || "")}`
    );
    const data = await res.json();
    setDetailModal({ open: true, orders: data.orders || [] });
  };

  // Sửa thông tin khách hàng
  const handleEditCustomer = (customer) => {
    setEditForm({ name: customer.customer_name, phone: customer.customer_phone || "" });
    setEditModal({ open: true, customer });
  };

  const handleSaveCustomer = async () => {
    if (!editForm.name.trim()) return alert("Tên khách hàng không được để trống");
    
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/update-customer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        old_customer_name: editModal.customer.customer_name,
        old_customer_phone: editModal.customer.customer_phone,
        new_customer_name: editForm.name.trim(),
        new_customer_phone: editForm.phone.trim()
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert("✅ " + data.message);
      setEditModal({ open: false, customer: null });
      fetchDebts();
    } else {
      alert("❌ " + (data.message || "Lỗi cập nhật"));
    }
  };

  // Xóa khách hàng khỏi công nợ
  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Bạn có chắc muốn xóa công nợ của khách hàng "${customer.customer_name}"?`)) return;
    
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cong-no/delete-customer`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: customer.customer_name,
        customer_phone: customer.customer_phone
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert("✅ " + data.message);
      fetchDebts();
    } else {
      alert("❌ " + (data.message || "Lỗi xóa"));
    }
  };

  useEffect(() => {
    fetchDebts();
  }, [searchText, showAll]);

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-xl shadow mt-10 relative">
      {/* Nút logout */}
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      {/* Menu điều hướng */}
      <div className="flex justify-center space-x-2 mb-6">
        <button
          onClick={() => (window.location.href = "/nhap-hang")}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          📥 Nhập hàng
        </button>
        <button
          onClick={() => (window.location.href = "/xuat-hang")}
          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
        >
          📤 Xuất hàng
        </button>
        <button
          onClick={() => (window.location.href = "/ton-kho-so-luong")}
          className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
        >
          📦 Tồn kho
        </button>
        <button
          onClick={() => (window.location.href = "/so-quy")}
          className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
        >
          💰 Sổ quỹ
        </button>
        <button
          onClick={() => (window.location.href = "/bao-cao")}
          className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
        >
          📋 Báo cáo
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-4 text-center text-purple-700">
        Công nợ khách hàng
      </h2>

      {/* Bộ lọc và tìm kiếm */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-60">
            <input
              type="text"
              placeholder="🔍 Tìm kiếm theo tên hoặc số điện thoại..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showAll"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="showAll" className="text-sm font-medium">
              Hiển thị tất cả khách hàng (kể cả đã trả hết nợ)
            </label>
          </div>
        </div>
      </div>

      {/* Danh sách khách còn công nợ */}
      {!selectedCustomer && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Danh sách khách còn công nợ:</h3>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Khách hàng</th>
                <th className="border p-2">SĐT</th>
                <th className="border p-2">Đã trả</th>
                <th className="border p-2">Còn nợ</th>
                <th className="border p-2">Thao tác</th>
                <th className="border p-2">Lịch sử</th>
                <th className="border p-2">Xem chi tiết</th>
                <th className="border p-2">Sửa/Xóa</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((debt, i) => (
                <tr key={i}>
                  <td className="border p-2">{debt.customer_name}</td>
                  <td className="border p-2">{debt.customer_phone || "—"}</td>
                  <td className="border p-2 text-right text-green-700">{Number(debt.total_paid).toLocaleString()}đ</td>
                  <td className="border p-2 text-right text-red-600 font-bold">{Number(debt.total_debt).toLocaleString()}đ</td>
                  <td className="border p-2 text-center">
                    <button
                      className="bg-blue-600 text-white px-2 py-1 rounded"
                      onClick={() => handleSelectCustomer(debt)}
                    >
                      Cộng/Trừ nợ
                    </button>
                  </td>
                  <td className="border p-2 text-center">
                    <button
                      className="bg-gray-300 text-black px-2 py-1 rounded"
                      onClick={() => {
                        setCustomerDebt(debt);
                        handleShowHistory();
                      }}
                    >
                      Xem
                    </button>
                  </td>
                  <td className="border p-2 text-center">
                    <button
                      className="bg-yellow-400 text-black px-2 py-1 rounded"
                      onClick={() => handleShowDetail(debt)}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                  <td className="border p-2 text-center">
                    <button
                      className="bg-green-500 text-white px-2 py-1 rounded mr-1"
                      onClick={() => handleEditCustomer(debt)}
                      title="Sửa thông tin"
                    >
                      ✏️
                    </button>
                    <button
                      className="bg-red-500 text-white px-2 py-1 rounded"
                      onClick={() => handleDeleteCustomer(debt)}
                      title="Xóa công nợ"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {debts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-3 text-gray-500">
                    {searchText ? `Không tìm thấy khách hàng nào với từ khóa "${searchText}"` : "Không có công nợ nào!"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Thao tác tổng cho từng khách hàng */}
      {selectedCustomer && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="font-semibold">
                Công nợ của: <span className="text-blue-700">{selectedCustomer.customer_name}</span>
                {selectedCustomer.customer_phone && (
                  <span className="ml-4 text-gray-700">
                    | SĐT: <b className="text-green-700">{selectedCustomer.customer_phone}</b>
                  </span>
                )}
              </h3>
              <div className="mt-2">
                <span className="mr-6">Đã trả: <b className="text-green-700">{Number(customerDebt.total_paid).toLocaleString()}đ</b></span>
                <span>Còn nợ: <b className="text-red-600">{Number(customerDebt.total_debt).toLocaleString()}đ</b></span>
              </div>
            </div>
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded ml-3"
              onClick={() => {
                setSelectedCustomer(null);
                setCustomerDebt({ total_debt: 0, total_paid: 0, debt_history: [] });
              }}
            >
              ← Quay lại danh sách nợ
            </button>
          </div>
          {/* Giao diện cộng/trừ nợ tổng */}
          <div className="flex gap-8 mt-3">
            <div>
              <input
                type="number"
                min="0"
                placeholder="Trả nợ"
                className="border rounded px-2 py-1 w-24 mr-2"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="Ghi chú trả nợ"
                className="border rounded px-2 py-1 w-40 mr-2"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
              />
              <button
                className="bg-green-600 text-white px-3 py-1 rounded"
                onClick={handlePayDebt}
              >
                Trừ nợ
              </button>
            </div>
            <div>
              <input
                type="number"
                min="0"
                placeholder="Cộng nợ"
                className="border rounded px-2 py-1 w-24 mr-2"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="Ghi chú cộng nợ"
                className="border rounded px-2 py-1 w-40 mr-2"
                value={addNote}
                onChange={e => setAddNote(e.target.value)}
              />
              <button
                className="bg-red-500 text-white px-3 py-1 rounded"
                onClick={handleAddDebt}
              >
                + Nợ
              </button>
            </div>
            <div>
              <button
                className="bg-gray-300 text-black px-3 py-1 rounded"
                onClick={handleShowHistory}
              >
                Xem lịch sử
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lịch sử trả/cộng nợ */}
      {historyModal.open && (
        <div className="fixed z-50 inset-0 bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[400px] max-h-[80vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-lg"
              onClick={() => setHistoryModal({ open: false, history: [] })}
            >✖</button>
            <h3 className="text-lg font-bold mb-3">Lịch sử trả/cộng nợ</h3>
            <ul className="space-y-2">
              {historyModal.history && historyModal.history.length > 0 ? (
                historyModal.history.map((item, idx) => (
                  <li key={idx} className={`p-2 rounded ${item.type === "add" ? "bg-red-100" : "bg-green-100"}`}>
                    <b>{item.type === "add" ? "Cộng nợ" : "Trả nợ"}:</b> {Number(item.amount).toLocaleString()}đ
                    <span className="ml-2 text-xs text-gray-500">{item.date ? (item.date.slice(0, 10) + " " + item.date.slice(11, 19)) : ""}</span>
                    {item.note && <div className="text-xs text-gray-700 italic mt-1">📝 {item.note}</div>}
                  </li>
                ))
              ) : (
                <li className="text-gray-500 text-sm">Chưa có lịch sử trả/cộng nợ.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Modal chi tiết sản phẩm khách đã mua */}
      {detailModal.open && (
        <div className="fixed z-50 inset-0 bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-lg"
              onClick={() => setDetailModal({ open: false, orders: [] })}
            >✖</button>
            <h3 className="text-lg font-bold mb-3">Danh sách sản phẩm khách đã mua</h3>
            <table className="w-full border text-sm mb-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">IMEI</th>
                  <th className="border p-2">Sản phẩm</th>
                  <th className="border p-2">Giá bán</th>
                  <th className="border p-2">Ngày bán</th>
                </tr>
              </thead>
              <tbody>
                {detailModal.orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-3 text-gray-500">
                      Không có sản phẩm nào!
                    </td>
                  </tr>
                ) : (
                  detailModal.orders.map((order, idx) => (
                    <tr key={idx}>
                      <td className="border p-2">{order.imei}</td>
                      <td className="border p-2">{order.product_name}</td>
                      <td className="border p-2 text-right">{Number(order.price_sell).toLocaleString()}đ</td>
                      <td className="border p-2">{order.sold_date?.slice(0,10)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal sửa thông tin khách hàng */}
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-w-90vw">
            <h3 className="text-lg font-bold mb-4">✏️ Sửa thông tin khách hàng</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên khách hàng *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên khách hàng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập số điện thoại"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveCustomer}
                className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
              >
                💾 Lưu
              </button>
              <button
                onClick={() => setEditModal({ open: false, customer: null })}
                className="flex-1 bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600"
              >
                ❌ Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CongNo;
