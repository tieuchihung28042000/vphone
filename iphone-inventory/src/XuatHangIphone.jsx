import React, { useState } from "react";
import axios from "axios";

export default function XuatHangIphone() {
  const [imei, setImei] = useState("");
  const [priceSell, setPriceSell] = useState("");
  const [customer, setCustomer] = useState("");
  const [warranty, setWarranty] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async () => {
    if (!imei || !priceSell) {
      alert("Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || window.location.origin}/api/xuat-hang`, {
        imei,
        price_sell: priceSell,
        customer,
        warranty,
        note,
      });

      alert(response.data.message);
      setImei("");
      setPriceSell("");
      setCustomer("");
      setWarranty("");
      setNote("");
    } catch (err) {
      alert("❌ Lỗi khi xuất hàng");
      console.error(err);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        📦 Xuất hàng iPhone
      </h1>

      <div className="flex gap-2 mb-2">
        <input
          value={imei}
          onChange={(e) => setImei(e.target.value)}
          placeholder="IMEI"
          className="border px-2 py-1 rounded w-60 h-10"
        />
        <button className="bg-gray-200 px-4 rounded h-10">Tìm IMEI</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-2">
        <input
          value={priceSell}
          onChange={(e) => setPriceSell(e.target.value)}
          placeholder="Giá bán"
          className="border px-2 py-1 rounded w-60 h-10"
        />
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Tên khách hàng"
          className="border px-2 py-1 rounded w-60 h-10"
        />
        <input
          value={warranty}
          onChange={(e) => setWarranty(e.target.value)}
          placeholder="Bảo hành (VD: 6 tháng)"
          className="border px-2 py-1 rounded w-60 h-10"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú"
          className="border px-2 py-1 rounded w-60 h-10 resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        ✅ Xuất hàng
      </button>
    </div>
  );
}
