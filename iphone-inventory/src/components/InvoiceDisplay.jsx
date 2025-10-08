import React from 'react';

const InvoiceDisplay = ({ invoiceData, isVisible, onClose }) => {
  if (!isVisible || !invoiceData) return null;

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '0đ';
    const formatted = new Intl.NumberFormat('vi-VN').format(amount);
    return `${formatted}đ`;
  };

  const getPaymentMethodName = (source) => {
    const methods = {
      'tien_mat': 'Tiền mặt',
      'the': 'Thẻ',
      'chuyen_khoan': 'Chuyển khoản',
      'vi_dien_tu': 'Ví điện tử'
    };
    return methods[source] || source;
  };

  const totalAmount = invoiceData.items?.reduce((sum, item) => 
    sum + ((item.price_sell || 0) * (item.quantity || 1)), 0
  ) || 0;

  const totalQuantity = invoiceData.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Hóa đơn bán hàng</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        {/* Invoice Content - Style giống hình mẫu */}
        <div className="p-4 font-mono text-sm" style={{ fontFamily: 'monospace' }}>
          {/* Store Info */}
          <div className="text-center mb-4">
            <div className="text-lg font-bold">VPHONE</div>
            <div className="text-xs">CÔNG TY TNHH VPHONE</div>
            <div className="text-xs">123 Đường ABC, Quận XYZ, TP.HCM</div>
            <div className="text-xs">ĐT: (028) 1234-5678 | MST: 0123456789</div>
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <div className="text-base font-bold">HÓA ĐƠN BÁN HÀNG</div>
            <div className="text-xs mt-1">Số: {invoiceData.invoiceNumber || 'HD' + Date.now()}</div>
          </div>

          {/* Transaction Info */}
          <div className="mb-4 space-y-1">
            <div className="flex justify-between">
              <span>Ngày bán:</span>
              <span>{invoiceData.date || new Date().toLocaleDateString('vi-VN')}</span>
            </div>
            {invoiceData.salesperson && (
              <div className="flex justify-between">
                <span>NV:</span>
                <span>{invoiceData.salesperson}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>KH:</span>
              <span>{invoiceData.customerName || 'Khách lẻ'} - {invoiceData.customerPhone || 'Chưa có'}</span>
            </div>
            {invoiceData.customerAddress && (
              <div className="flex justify-between">
                <span>Đ/C:</span>
                <span>{invoiceData.customerAddress}</span>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-400 my-4"></div>

          {/* Product Table */}
          <div className="mb-4">
            <div className="grid grid-cols-5 gap-2 text-xs font-bold border-b pb-1">
              <div>Sản Phẩm</div>
              <div className="text-center">ĐG</div>
              <div className="text-center">SL</div>
              <div className="text-center">T.Tiền</div>
              <div className="text-center">KM</div>
            </div>
            
            {invoiceData.items?.map((item, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 text-xs py-1 border-b border-gray-200">
                <div className="col-span-1">
                  <div className="font-medium">{item.product_name || ''}</div>
                  <div className="text-gray-600">{item.sku || item.imei || ''}</div>
                </div>
                <div className="text-center">{formatCurrency(item.price_sell || 0)}</div>
                <div className="text-center">{item.quantity || 1}</div>
                <div className="text-center">{formatCurrency((item.price_sell || 0) * (item.quantity || 1))}</div>
                <div className="text-center">0</div>
              </div>
            ))}
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-400 my-4"></div>

          {/* Summary */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Tổng số lượng:</span>
              <span>{totalQuantity}</span>
            </div>
            <div className="flex justify-between">
              <span>Tổng tiền hàng:</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tổng chiết khấu:</span>
              <span>{formatCurrency(invoiceData.discount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Thuế:</span>
              <span>{formatCurrency(invoiceData.tax || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Phí giao hàng:</span>
              <span>{formatCurrency(invoiceData.shippingFee || 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>Khách phải trả:</span>
              <span>{formatCurrency(totalAmount - (invoiceData.discount || 0) + (invoiceData.tax || 0) + (invoiceData.shippingFee || 0))}</span>
            </div>
            
            {/* Payment Info */}
            {invoiceData.payments?.map((payment, index) => (
              <div key={index} className="flex justify-between">
                <span>{getPaymentMethodName(payment.source)}:</span>
                <span>{formatCurrency(payment.amount)}</span>
              </div>
            ))}
            
            <div className="flex justify-between">
              <span>Tiền khách đưa:</span>
              <span>{formatCurrency(invoiceData.customerPaid || totalAmount)}</span>
            </div>
            
            {invoiceData.customerPaid && invoiceData.customerPaid > totalAmount && (
              <div className="flex justify-between">
                <span>Tiền trả lại:</span>
                <span>{formatCurrency(invoiceData.customerPaid - totalAmount)}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-xs">
            <div className="mb-2">
              Ghi chú: Quý khách được phép đổi trả hàng hoá trong 7 ngày kể từ ngày mua hàng
            </div>
            <div className="font-bold">
              CẢM ƠN VÀ HẸN GẶP LẠI QUÝ KHÁCH!
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 px-4 py-3 border-t flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            🖨️ In hóa đơn
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDisplay;
