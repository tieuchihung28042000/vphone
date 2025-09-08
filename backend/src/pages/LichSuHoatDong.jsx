import React, { useEffect, useState } from "react";

function LichSuHoatDong() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [user, setUser] = useState("");
  const [moduleName, setModuleName] = useState("all");
  const [branch, setBranch] = useState("all");

  const token = localStorage.getItem('token');

  const fetchLogs = async (p = page) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (user) params.append('user', user);
    if (moduleName && moduleName !== 'all') params.append('module', moduleName);
    if (branch && branch !== 'all') params.append('branch', branch);
    params.append('page', String(p));
    params.append('limit', String(limit));

    const url = `${import.meta.env.VITE_API_URL}/api/activity-logs?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : undefined
      }
    });
    const json = await res.json();
    if (res.ok) {
      setItems(json.items || []);
      setTotal(json.total || 0);
      setPage(json.page || 1);
    } else {
      console.error('Load activity logs failed:', json);
      setItems([]);
      setTotal(0);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">📜 Lịch sử hoạt động</h2>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-sm text-gray-500">Từ ngày</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block text-sm text-gray-500">Đến ngày</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block text-sm text-gray-500">Người dùng</label>
          <input placeholder="username/email" value={user} onChange={e => setUser(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block text-sm text-gray-500">Module</label>
          <select value={moduleName} onChange={e => setModuleName(e.target.value)} className="border px-2 py-1 rounded">
            <option value="all">Tất cả</option>
            <option value="cashbook">cashbook</option>
            <option value="return_import">return_import</option>
            <option value="return_export">return_export</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-500">Chi nhánh</label>
          <input placeholder="VD: Dĩ An" value={branch} onChange={e => setBranch(e.target.value)} className="border px-2 py-1 rounded" />
        </div>
        <button onClick={() => fetchLogs(1)} className="bg-blue-600 text-white px-3 py-2 rounded">Lọc</button>
      </div>

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">Thời gian</th>
              <th className="p-2 border">User</th>
              <th className="p-2 border">Role</th>
              <th className="p-2 border">Module</th>
              <th className="p-2 border">Action</th>
              <th className="p-2 border">Chi nhánh</th>
              <th className="p-2 border">Ref</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it._id} className="hover:bg-gray-50">
                <td className="p-2 border">{it.createdAt ? new Date(it.createdAt).toLocaleString('vi-VN') : ''}</td>
                <td className="p-2 border">{it.username}</td>
                <td className="p-2 border">{it.role}</td>
                <td className="p-2 border">{it.module}</td>
                <td className="p-2 border">{it.action}</td>
                <td className="p-2 border">{it.branch}</td>
                <td className="p-2 border font-mono text-xs">{it.ref_id}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={7}>Không có dữ liệu</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button disabled={page<=1} onClick={() => { const p = Math.max(1, page-1); setPage(p); fetchLogs(p); }} className="px-3 py-1 border rounded disabled:opacity-50">Trước</button>
        <span className="text-sm text-gray-600">Trang {page}/{totalPages}</span>
        <button disabled={page>=totalPages} onClick={() => { const p = Math.min(totalPages, page+1); setPage(p); fetchLogs(p); }} className="px-3 py-1 border rounded disabled:opacity-50">Sau</button>
        <select value={limit} onChange={e => { setLimit(Number(e.target.value)); fetchLogs(1); }} className="border px-2 py-1 rounded ml-2">
          {[10,20,50,100].map(n => <option key={n} value={n}>{n}/trang</option>)}
        </select>
      </div>
    </div>
  );
}

export default LichSuHoatDong;


