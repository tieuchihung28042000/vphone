import React, { useState, useEffect } from "react";
import {
  startOfToday,
  endOfToday,
  startOfYesterday,
  endOfYesterday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ======= Format số tiền: tách 3 số =======
function formatNumberInput(val) {
  if (!val) return "";
  let num = val.toString().replace(/\D/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function unformatNumberInput(val) {
  return val.replace(/\D/g, "");
}

// 1. COMPONENT: Editable Select with Add (+)
function EditableSelect({ label, value, setValue, storageKey, placeholder = "", ...rest }) {
  const [options, setOptions] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    setOptions(saved.length ? saved : [placeholder]);
  }, [storageKey, placeholder]);

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) {
      setShowInput(false);
      return;
    }
    const updated = [...options, trimmed];
    setOptions(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setValue(trimmed);
    setNewValue("");
    setShowInput(false);
  };

  return (
    <div className="relative flex items-center w-full">
      <select
        className="border rounded px-2 py-1 w-full pr-8"
        value={value}
        onChange={e => setValue(e.target.value)}
        {...rest}
      >
        <option>{placeholder}</option>
        {options
          .filter(opt => opt && opt !== placeholder)
          .map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
      </select>
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 text-xl px-1 text-gray-600"
        style={{ lineHeight: 1 }}
        tabIndex={-1}
        onClick={() => setShowInput(!showInput)}
      >
        +
      </button>
      {showInput && (
        <div className="absolute top-full left-0 bg-white border p-2 z-50 w-60 mt-1 rounded shadow">
          <input
            className="border px-2 py-1 w-full mb-2"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder={`Nhập ${label.toLowerCase()} mới`}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="bg-blue-500 text-white px-3 py-1 rounded"
              onClick={handleAdd}
            >Lưu</button>
            <button
              type="button"
              className="bg-gray-200 px-3 py-1 rounded"
              onClick={() => { setShowInput(false); setNewValue(""); }}
            >Huỷ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 2. COMPONENT: FilterTime giữ nguyên
function FilterTime({ filter, setFilter }) {
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const handleSelect = (e) => {
    const val = e.target.value;
    let newFilter = { ...filter, time: val };

    if (val === "Hôm nay") {
      newFilter.fromDate = format(startOfToday(), "yyyy-MM-dd");
      newFilter.toDate = format(endOfToday(), "yyyy-MM-dd");
      setShowCustom(false);
    } else if (val === "Hôm qua") {
      newFilter.fromDate = format(startOfYesterday(), "yyyy-MM-dd");
      newFilter.toDate = format(endOfYesterday(), "yyyy-MM-dd");
      setShowCustom(false);
    } else if (val === "Tuần này") {
      newFilter.fromDate = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      newFilter.toDate = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      setShowCustom(false);
    } else if (val === "Tháng này") {
      newFilter.fromDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
      newFilter.toDate = format(endOfMonth(new Date()), "yyyy-MM-dd");
      setShowCustom(false);
    } else if (val === "Tuỳ chọn...") {
      setShowCustom(true);
      return;
    }
    setFilter(newFilter);
  };

  const handleCustomDate = () => {
    setFilter({
      ...filter,
      time: "Tuỳ chọn...",
      fromDate: from,
      toDate: to,
    });
  };

  return (
    <div>
      <div className="font-medium">Thời gian</div>
      <select
        className="mt-1 w-full border rounded px-2 py-1"
        value={filter.time || ""}
        onChange={handleSelect}
      >
        <option value="">Chọn...</option>
        <option>Hôm nay</option>
        <option>Hôm qua</option>
        <option>Tuần này</option>
        <option>Tháng này</option>
        <option>Tuỳ chọn...</option>
      </select>
      {showCustom && (
        <div className="flex gap-2 mt-2">
          <input
            type="date"
            className="border rounded px-2 py-1 flex-1"
            value={from}
            onChange={e => setFrom(e.target.value)}
            placeholder="Từ ngày"
          />
          <input
            type="date"
            className="border rounded px-2 py-1 flex-1"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="Đến ngày"
          />
          <button
            className="bg-blue-500 text-white px-2 rounded"
            onClick={handleCustomDate}
          >
            Lọc
          </button>
        </div>
      )}
    </div>
  );
}

// 3. MAIN COMPONENT (Bộ lọc phía trên bảng + Xuất Excel)
export default function Cashbook() {
  // Danh sách nguồn tiền
  const sourcesArr = [
    { key: "tien_mat", label: "Tiền mặt" },
    { key: "the", label: "Thẻ" },
    { key: "vi_dien_tu", label: "Ví điện tử" },
  ];

  // Quỹ đầu kỳ từng nguồn
  const getOpening = src => Number(localStorage.getItem(`opening-balance-${src}`) || 0);
  const [opening, setOpening] = useState({
    tien_mat: getOpening("tien_mat"),
    the: getOpening("the"),
    vi_dien_tu: getOpening("vi_dien_tu"),
  });
  const [editingBalance, setEditingBalance] = useState(false);
  const [editInput, setEditInput] = useState({ ...opening });

  // Các state khác giữ nguyên
  const [filter, setFilter] = useState({
    source: "Tất cả",
    time: "Tháng này",
    fromDate: "",
    toDate: "",
    type: "Tất cả",
    status: "Tất cả",
    search: "",
  });
  const [data, setData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("thu"); // "thu" | "chi"
  const [editItem, setEditItem] = useState(null);

  // Lấy lại danh sách backend
  const reloadData = async () => {
    let url = `/api/cashbook?`;
    if (filter.fromDate) url += `from=${filter.fromDate}&`;
    if (filter.toDate) url += `to=${filter.toDate}&`;
    if (filter.type && filter.type !== "Tất cả") url += `type=${filter.type}&`;
    if (filter.source && filter.source !== "Tất cả") url += `source=${filter.source}&`;
    if (filter.search) url += `search=${encodeURIComponent(filter.search)}&`;
    const res = await fetch(url);
    const items = await res.json();
    setData(items);
  };

  useEffect(() => {
    reloadData();
    // eslint-disable-next-line
  }, [filter.fromDate, filter.toDate, filter.type, filter.source, filter.search]);

  // Tổng hợp từng nguồn tiền
  const summaryBySource = sourcesArr.map(src => {
    const filtered = data.filter(i => i.source === src.key);
    const thu = filtered.filter(i => i.amount > 0).reduce((a, b) => a + b.amount, 0);
    const chi = filtered.filter(i => i.amount < 0).reduce((a, b) => a + b.amount, 0);
    const ton = opening[src.key] + thu + chi;
    return { ...src, thu, chi, ton, opening: opening[src.key] };
  });

  // Tổng hợp tổng (tất cả)
  const totalOpening = opening.tien_mat + opening.the + opening.vi_dien_tu;
  const totalThu = data.filter(i => i.amount > 0).reduce((a, b) => a + b.amount, 0);
  const totalChi = data.filter(i => i.amount < 0).reduce((a, b) => a + b.amount, 0);
  const tonQuy = totalOpening + totalThu + totalChi;

  const fmoney = (num) =>
    (num > 0 ? "+" : "") +
    num.toLocaleString("vi-VN") +
    " đ";

  const handleOpenModal = (type, item = null) => {
    setEditItem(item);
    setModalType(type); // "thu" | "chi"
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setEditItem(null);
    setShowModal(false);
  };

  // Sửa quỹ đầu kỳ
  const handleBalanceSave = () => {
    Object.keys(editInput).forEach(k => {
      localStorage.setItem(`opening-balance-${k}`, Number(editInput[k]) || 0);
    });
    setOpening({ ...editInput });
    setEditingBalance(false);
  };

  // ===== XUẤT EXCEL =====
  function handleExportExcel() {
    const exportData = data.map((item, idx) => ({
      "STT": idx + 1,
      "Mã phiếu": item.code || item._id,
      "Thời gian": item.date ? format(new Date(item.date), "dd/MM/yyyy HH:mm") : "",
      "Loại thu chi": item.content || item.type,
      "Người nộp/nhận": item.person || item.customer || item.supplier,
      "Nguồn": item.source === "tien_mat"
        ? "Tiền mặt"
        : item.source === "the"
        ? "Thẻ"
        : item.source === "vi_dien_tu"
        ? "Ví điện tử"
        : "",
      "Giá trị": item.amount,
      "Ghi chú": item.note || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThuChi");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), "so_quy_thu_chi.xlsx");
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Tổng hợp từng nguồn */}
      <div className="flex gap-6 mb-8 justify-center">
        {summaryBySource.map(src => (
          <div
            key={src.key}
            className="rounded-2xl shadow bg-white border border-purple-200 min-w-[210px] px-6 py-5 flex flex-col items-center"
          >
            <div className="font-extrabold text-3xl mb-2" style={{ color: '#7c3aed', letterSpacing: '1px' }}>
              {src.label}
            </div>
            <div className="flex flex-col items-center mb-2 mt-1">
              <span className="text-xs text-gray-600 font-semibold mb-0.5">Đầu kỳ</span>
              <span className="font-extrabold text-fuchsia-800 text-3xl">
                {src.opening.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="flex flex-col w-full gap-1">
              <div className="flex justify-between w-full">
                <span className="text-xs text-gray-700">Thu</span>
                <span className="font-bold text-blue-600">{src.thu.toLocaleString("vi-VN")}</span>
              </div>
              <div className="flex justify-between w-full">
                <span className="text-xs text-gray-700">Chi</span>
                <span className="font-bold text-red-500">{src.chi.toLocaleString("vi-VN")}</span>
              </div>
              <div className="flex justify-between w-full border-t border-gray-200 pt-1 mt-1">
                <span className="text-xs text-gray-700">Tồn</span>
                <span className="font-bold text-green-600">{src.ton.toLocaleString("vi-VN")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Thanh action + tổng hợp tổng */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
        <div>
          <button
            onClick={() => handleOpenModal("thu")}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mr-2"
          >
            + Lập phiếu thu
          </button>
          <button
            onClick={() => handleOpenModal("chi")}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            + Lập phiếu chi
          </button>
        </div>
        <div className="flex gap-3">
          <div className="text-sm flex items-center">
            <div className="font-medium text-gray-500 mr-1">Quỹ đầu kỳ</div>
            {!editingBalance ? (
              <>
                <div className="font-semibold text-gray-700">
                  {totalOpening.toLocaleString("vi-VN")}
                </div>
                <button
                  onClick={() => { setEditingBalance(true); setEditInput({ ...opening }); }}
                  className="ml-1 text-blue-500 underline text-xs"
                  title="Sửa quỹ đầu kỳ"
                >Sửa</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={editInput.tien_mat}
                  onChange={e => setEditInput(v => ({ ...v, tien_mat: Number(e.target.value) }))}
                  className="border px-2 py-1 rounded w-24"
                  placeholder="Tiền mặt"
                />
                <input
                  type="number"
                  value={editInput.the}
                  onChange={e => setEditInput(v => ({ ...v, the: Number(e.target.value) }))}
                  className="border px-2 py-1 rounded w-20"
                  placeholder="Thẻ"
                />
                <input
                  type="number"
                  value={editInput.vi_dien_tu}
                  onChange={e => setEditInput(v => ({ ...v, vi_dien_tu: Number(e.target.value) }))}
                  className="border px-2 py-1 rounded w-24"
                  placeholder="Ví điện tử"
                />
                <button
                  onClick={handleBalanceSave}
                  className="bg-green-500 text-white px-2 rounded mr-1"
                >Lưu</button>
                <button
                  onClick={() => setEditingBalance(false)}
                  className="bg-gray-300 px-2 rounded"
                >Huỷ</button>
              </div>
            )}
          </div>
          <div className="text-sm">
            <div className="font-medium text-gray-500">Tổng thu</div>
            <div className="font-semibold text-blue-600">{totalThu.toLocaleString("vi-VN")}</div>
          </div>
          <div className="text-sm">
            <div className="font-medium text-gray-500">Tổng chi</div>
            <div className="font-semibold text-red-500">{totalChi.toLocaleString("vi-VN")}</div>
          </div>
          <div className="text-sm">
            <div className="font-medium text-gray-500">Tồn quỹ</div>
            <div className="font-semibold text-green-600">{tonQuy.toLocaleString("vi-VN")}</div>
          </div>
        </div>
      </div>

      {/* --- BỘ LỌC NẰM NGANG PHÍA TRÊN DANH SÁCH --- */}
      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <div>
          <div className="font-medium">Quỹ tiền</div>
          <select
            className="mt-1 w-full border rounded px-2 py-1 min-w-[140px]"
            value={filter.source}
            onChange={e => setFilter({ ...filter, source: e.target.value })}
          >
            <option value="Tất cả">Tất cả</option>
            <option value="tien_mat">Tiền mặt</option>
            <option value="the">Thẻ</option>
            <option value="vi_dien_tu">Ví điện tử</option>
          </select>
        </div>
        <div>
          <FilterTime filter={filter} setFilter={setFilter} />
        </div>
        <div>
          <div className="font-medium">Loại chứng từ</div>
          <select className="mt-1 w-full border rounded px-2 py-1 min-w-[140px]"
            value={filter.type}
            onChange={e => setFilter({ ...filter, type: e.target.value })}
          >
            <option>Tất cả</option>
            <option>Phiếu thu</option>
            <option>Phiếu chi</option>
          </select>
        </div>
        <div className="flex-1 flex items-end gap-2">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="🔍 Tìm mã phiếu, nội dung..."
            value={filter.search}
            onChange={e =>
              setFilter({ ...filter, search: e.target.value })
            }
          />
          <button
            onClick={handleExportExcel}
            className="bg-purple-700 hover:bg-purple-900 text-white font-semibold px-4 py-2 rounded shadow"
          >
            Xuất Excel
          </button>
        </div>
      </div>

      {/* --- DANH SÁCH --- */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full table-auto text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">Mã phiếu</th>
              <th className="px-3 py-2 text-left">Thời gian</th>
              <th className="px-3 py-2 text-left">Loại thu chi</th>
              <th className="px-3 py-2 text-left">Người nộp/nhận</th>
              <th className="px-3 py-2 text-left">Nguồn</th>
              <th className="px-3 py-2 text-right">Giá trị</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((i, idx) => (
              <tr key={i._id || i.code || idx} className={idx % 2 ? "bg-gray-50" : ""}>
                <td className="px-3 py-2">{i.code || i._id}</td>
                <td className="px-3 py-2">{i.date ? format(new Date(i.date), "dd/MM/yyyy HH:mm") : ""}</td>
                <td className="px-3 py-2">{i.content || i.type}</td>
                <td className="px-3 py-2">{i.person || i.customer || i.supplier}</td>
                <td className="px-3 py-2">
                  {i.source === "tien_mat" ? "Tiền mặt" :
                    i.source === "the" ? "Thẻ" :
                      i.source === "vi_dien_tu" ? "Ví điện tử" : ""}
                </td>
                <td className="px-3 py-2 text-right font-semibold" style={{ color: i.amount < 0 ? "#ef4444" : "#22c55e" }}>
                  {fmoney(i.amount)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleOpenModal(i.amount < 0 ? "chi" : "thu", i)}
                    className="text-blue-500 hover:underline mr-1"
                  >
                    Sửa
                  </button>
                  <button
                    className="text-red-500 hover:underline"
                    onClick={async () => {
                      if (window.confirm("Xoá giao dịch này?")) {
                        await fetch(`/api/cashbook/${i._id}`, { method: "DELETE" });
                        reloadData();
                      }
                    }}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phân trang (dùng nếu cần) */}
      <div className="flex justify-center mt-3">
        <button className="mx-1 px-2 py-1 bg-gray-200 rounded">&lt;</button>
        <button className="mx-1 px-2 py-1 bg-blue-500 text-white rounded">1</button>
        <button className="mx-1 px-2 py-1 bg-gray-200 rounded">&gt;</button>
      </div>

      {/* Modal popup tạo/sửa phiếu */}
      {showModal && (
        <ModalCashbook
          item={editItem}
          onClose={handleCloseModal}
          onSaved={reloadData}
          modalType={modalType}
        />
      )}
    </div>
  );
}

// ModalCashbook giữ nguyên
function ModalCashbook({ item, onClose, onSaved, modalType }) {
  const isThu = modalType === "thu";
  const [content, setContent] = useState(item?.content || "");
  const [staff, setStaff] = useState(item?.staff || "VPhone24h");
  const [personType, setPersonType] = useState(item?.personType || "Khác");
  const [person, setPerson] = useState(item?.person || "");
  const [source, setSource] = useState(item?.source || "tien_mat");

  const [form, setForm] = useState({
    code: item?.code || "",
    date: item?.date
      ? format(new Date(item.date), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    amount: item?.amount
      ? Math.abs(item.amount)
      : 0,
    note: item?.note || "",
    isAccounting: item?.isAccounting ?? true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(f => ({
      ...f,
      content,
      staff,
      personType,
      person,
    }));
  }, [content, staff, personType, person]);

  const handleChange = (key, value) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (print = false) => {
    setLoading(true);
    if (
      !content ||
      content === "--Chọn loại thu--" ||
      content === "--Chọn loại chi--" ||
      !form.amount ||
      Number(form.amount) <= 0 ||
      !person ||
      !source
    ) {
      alert("Vui lòng chọn đầy đủ thông tin, nhập số tiền hợp lệ và chọn nguồn tiền!");
      setLoading(false);
      return;
    }
    try {
      const body = {
        code: form.code,
        date: new Date(form.date),
        type: modalType,
        content: content,
        amount: isThu ? Math.abs(Number(form.amount)) : -Math.abs(Number(form.amount)),
        staff: staff,
        personType: personType,
        person: person,
        note: form.note,
        isAccounting: form.isAccounting,
        source: source,
      };
      const url = item ? `/api/cashbook/${item._id}` : `/api/cashbook`;
      const res = await fetch(url, {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (res.ok) {
        alert(item ? "Cập nhật thành công!" : "Tạo phiếu thành công!");
        onSaved && onSaved();
        onClose();
      } else {
        alert(result.message || "Có lỗi xảy ra!");
      }
    } catch (err) {
      alert("Lỗi kết nối server");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg w-full max-w-3xl p-6">
        <h2 className="text-lg font-bold mb-4">
          {item
            ? isThu
              ? "Sửa phiếu thu"
              : "Sửa phiếu chi"
            : isThu
            ? "Lập phiếu thu (tiền mặt)"
            : "Lập phiếu chi (tiền mặt)"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cột 1 */}
          <div>
            <div className="mb-3">
              <label className="font-medium">Mã phiếu</label>
              <input
                className="border rounded px-2 py-1 w-full"
                placeholder="Mã phiếu tự động"
                value={form.code}
                disabled
                onChange={e => handleChange("code", e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="font-medium">Thời gian</label>
              <input
                className="border rounded px-2 py-1 w-full"
                type="datetime-local"
                value={form.date}
                onChange={e => handleChange("date", e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="font-medium">
                {isThu ? "Loại thu" : "Loại chi"}
              </label>
              <EditableSelect
                label={isThu ? "Loại thu" : "Loại chi"}
                value={content}
                setValue={setContent}
                storageKey={isThu ? "loai-thu" : "loai-chi"}
                placeholder={isThu ? "--Chọn loại thu--" : "--Chọn loại chi--"}
              />
            </div>
            <div className="mb-3">
              <label className="font-medium">Giá trị</label>
              <input
                className="border rounded px-2 py-1 w-full"
                inputMode="numeric"
                value={formatNumberInput(form.amount)}
                onChange={e => {
                  const raw = unformatNumberInput(e.target.value);
                  handleChange("amount", raw);
                }}
                placeholder="Nhập số tiền..."
              />
            </div>
            <div className="mb-3">
              <label className="font-medium">
                Nguồn tiền
              </label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={source}
                onChange={e => setSource(e.target.value)}
              >
                <option value="tien_mat">Tiền mặt</option>
                <option value="the">Thẻ</option>
                <option value="vi_dien_tu">Ví điện tử</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="font-medium">
                Nhân viên {isThu ? "thu" : "chi"}
              </label>
              <EditableSelect
                label={`Nhân viên ${isThu ? "thu" : "chi"}`}
                value={staff}
                setValue={setStaff}
                storageKey="nhan-vien-thu-chi"
                placeholder="VPhone24h"
              />
            </div>
          </div>
          {/* Cột 2 */}
          <div>
            <div className="mb-3">
              <label className="font-medium">
                Đối tượng {isThu ? "nộp" : "nhận"}
              </label>
              <EditableSelect
                label={`Đối tượng ${isThu ? "nộp" : "nhận"}`}
                value={personType}
                setValue={setPersonType}
                storageKey="doi-tuong-thu-chi"
                placeholder="Khác"
              />
            </div>
            <div className="mb-3">
              <label className="font-medium">
                Tên người {isThu ? "nộp" : "nhận"}
              </label>
              <EditableSelect
                label={`Tên người ${isThu ? "nộp" : "nhận"}`}
                value={person}
                setValue={setPerson}
                storageKey="ten-nguoi-thu-chi"
                placeholder=""
              />
            </div>
            <div className="mb-3">
              <label className="font-medium">Ghi chú</label>
              <input
                className="border rounded px-2 py-1 w-full"
                placeholder="..."
                value={form.note}
                onChange={e => handleChange("note", e.target.value)}
              />
            </div>
            <div className="mb-3 flex items-center">
              <input
                type="checkbox"
                checked={form.isAccounting}
                onChange={e => handleChange("isAccounting", e.target.checked)}
                className="mr-2"
              />
              <span>Hạch toán vào kết quả hoạt động kinh doanh</span>
              <span className="ml-2 text-gray-400 cursor-pointer" title="Khoản này sẽ tính vào tổng kết doanh thu, chi phí...">ⓘ</span>
            </div>
          </div>
        </div>
        {/* Nút */}
        <div className="flex gap-4 mt-6 justify-end">
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded font-bold flex items-center"
          >
            Lưu
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="bg-green-500 text-white px-6 py-2 rounded font-bold flex items-center"
          >
            Lưu & In
          </button>
          <button
            onClick={onClose}
            className="bg-gray-400 text-white px-6 py-2 rounded font-bold flex items-center"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
}
