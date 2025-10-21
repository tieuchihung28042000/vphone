import React from 'react';

const SOURCES = [
  { value: 'tien_mat', label: 'Tiền mặt' },
  { value: 'the', label: 'Thẻ' },
  { value: 'vi_dien_tu', label: 'Ví điện tử' }
];

export default function PaymentsInput({ payments, onChange, disabled }) {
  const handleChange = (idx, key, val) => {
    const next = (payments || []).map((p, i) => (i === idx ? { ...p, [key]: val } : p));
    onChange(next);
  };

  const addRow = () => {
    const currentPayments = payments || [];
    const usedSources = currentPayments.map(p => p.source);
    
    // Tìm nguồn tiền chưa được sử dụng
    const availableSources = SOURCES.filter(s => !usedSources.includes(s.value));
    
    if (availableSources.length === 0) {
      alert('Đã sử dụng hết các nguồn tiền có sẵn!');
      return;
    }
    
    // Thêm nguồn tiền đầu tiên chưa được sử dụng
    onChange([...currentPayments, { source: availableSources[0].value, amount: '' }]);
  };

  const removeRow = (idx) => {
    const next = (payments || []).filter((_, i) => i !== idx);
    onChange(next);
  };

  const total = (payments || []).reduce((s, p) => {
    const amount = parseFloat(p.amount) || 0;
    return s + amount;
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">Thanh toán (đa nguồn)</div>
        <button type="button" onClick={addRow} disabled={disabled} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
          + Thêm nguồn
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-700">
              <th className="p-2 border text-left">Nguồn</th>
              <th className="p-2 border text-right">Số tiền</th>
              <th className="p-2 border w-24"></th>
            </tr>
          </thead>
          <tbody>
            {(payments || []).length === 0 && (
              <tr>
                <td className="p-2 border text-gray-500 italic" colSpan={3}>Chưa có nguồn thanh toán</td>
              </tr>
            )}
            {(payments || []).map((p, idx) => {
              const currentPayments = payments || [];
              // Lấy tất cả nguồn tiền đã được sử dụng TRỪ dòng hiện tại
              const usedSources = currentPayments.filter((pay, i) => i !== idx).map(pay => pay.source);
              const availableSources = SOURCES.filter(s => !usedSources.includes(s.value));
              
              return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-2 border">
                    <select
                      value={p.source}
                      onChange={(e) => handleChange(idx, 'source', e.target.value)}
                      disabled={disabled}
                      className="form-input"
                    >
                      {availableSources.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 border text-right">
                    <input
                      type="number"
                      value={p.amount}
                      onChange={(e) => handleChange(idx, 'amount', e.target.value)}
                      disabled={disabled}
                      placeholder="Số tiền"
                      className="form-input text-right"
                    />
                  </td>
                  <td className="p-2 border text-right">
                    <button type="button" onClick={() => removeRow(idx)} disabled={disabled} className="text-red-600 hover:underline">Xóa</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="p-2 border text-right font-semibold" colSpan={2}>Tổng thanh toán</td>
              <td className="p-2 border text-right font-bold text-green-700">{total.toLocaleString()} đ</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}


