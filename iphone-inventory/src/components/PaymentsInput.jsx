import React from 'react';

const SOURCES = [
  { value: 'tien_mat', label: 'Tiền mặt' },
  { value: 'the', label: 'Thẻ' },
  { value: 'vi_dien_tu', label: 'Ví điện tử' }
];

export default function PaymentsInput({ payments, onChange, disabled }) {
  const handleChange = (idx, key, val) => {
    const next = payments.map((p, i) => (i === idx ? { ...p, [key]: val } : p));
    onChange(next);
  };

  const addRow = () => {
    onChange([...(payments || []), { source: 'tien_mat', amount: '' }]);
  };

  const removeRow = (idx) => {
    const next = payments.filter((_, i) => i !== idx);
    onChange(next);
  };

  const total = (payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">Thanh toán (đa nguồn)</div>
        <button type="button" onClick={addRow} disabled={disabled} className="px-2 py-1 bg-blue-600 text-white rounded">
          + Thêm nguồn
        </button>
      </div>
      {(payments || []).map((p, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <select
            value={p.source}
            onChange={(e) => handleChange(idx, 'source', e.target.value)}
            disabled={disabled}
            className="border rounded px-2 py-1"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={p.amount}
            onChange={(e) => handleChange(idx, 'amount', e.target.value)}
            disabled={disabled}
            placeholder="Số tiền"
            className="border rounded px-2 py-1 w-40"
          />
          <button type="button" onClick={() => removeRow(idx)} disabled={disabled} className="px-2 py-1 bg-red-600 text-white rounded">
            Xoá
          </button>
        </div>
      ))}
      <div className="text-right font-medium">Tổng: {total.toLocaleString()} đ</div>
    </div>
  );
}


