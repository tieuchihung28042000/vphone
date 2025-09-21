import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateInvoicePDF = (invoiceData) => {
  // Tạo PDF với kích thước K80 (80mm = 226.77 points)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [226.77, 800] // 80mm width, chiều cao tự động
  });
  
  let currentY = 20;
  
  // Thông tin công ty (header) - Chuẩn K80
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('VPHONE', 113, currentY, { align: 'center' });
  currentY += 12;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('CÔNG TY TNHH VPHONE', 113, currentY, { align: 'center' });
  currentY += 10;
  doc.text('123 Đường ABC, Quận XYZ, TP.HCM', 113, currentY, { align: 'center' });
  currentY += 8;
  doc.text('ĐT: (028) 1234-5678 | MST: 0123456789', 113, currentY, { align: 'center' });
  currentY += 12;
  
  // Tiêu đề hóa đơn với dòng kẻ
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('HÓA ĐƠN BÁN HÀNG', 113, currentY, { align: 'center' });
  currentY += 8;
  
  // Dòng kẻ ngang dưới tiêu đề
  doc.setLineWidth(0.3);
  doc.line(10, currentY, 216, currentY);
  currentY += 8;
  
  // Thông tin hóa đơn - Chuẩn K80
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Số hóa đơn: ${invoiceData.invoiceNumber || 'HD' + Date.now()}`, 10, currentY);
  currentY += 8;
  doc.text(`Ngày: ${invoiceData.date || new Date().toLocaleDateString('vi-VN')}`, 10, currentY);
  currentY += 8;
  doc.text(`Chi nhánh: ${invoiceData.branch || ''}`, 10, currentY);
  currentY += 8;
  
  // Thông tin khách hàng - Chuẩn K80
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('THÔNG TIN KHÁCH HÀNG:', 10, currentY);
  currentY += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`Tên: ${invoiceData.customerName || 'Khách lẻ'}`, 10, currentY);
  currentY += 8;
  doc.text(`SĐT: ${invoiceData.customerPhone || 'Chưa có'}`, 10, currentY);
  currentY += 8;
  
  // Thông tin nhân viên và kênh bán
  if (invoiceData.salesperson) {
    doc.text(`N/V: ${invoiceData.salesperson}`, 10, currentY);
    currentY += 8;
  }
  if (invoiceData.salesChannel) {
    doc.text(`Kênh: ${invoiceData.salesChannel}`, 10, currentY);
    currentY += 8;
  }
  
  // Dòng kẻ trước bảng sản phẩm
  doc.setLineWidth(0.2);
  doc.line(10, currentY, 216, currentY);
  currentY += 8;
  
  // Bảng sản phẩm - Chuẩn K80 (compact)
  const tableData = invoiceData.items.map((item, index) => [
    index + 1,
    item.product_name || '',
    item.sku || item.imei || '',
    item.quantity || 1,
    formatCurrency(item.price_sell || 0),
    formatCurrency((item.price_sell || 0) * (item.quantity || 1))
  ]);
  
  autoTable(doc, {
    startY: currentY,
    head: [['STT', 'Tên sản phẩm', 'SKU', 'SL', 'ĐG', 'T.Tiền']],
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 80 },
      2: { cellWidth: 25 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 25 },
    },
    margin: { left: 10, right: 10 },
  });
  
  // Tổng tiền - Chuẩn K80
  currentY = doc.lastAutoTable.finalY + 8;
  
  // Dòng kẻ ngang trước tổng tiền
  doc.setLineWidth(0.2);
  doc.line(10, currentY, 216, currentY);
  currentY += 8;
  
  const totalAmount = invoiceData.items.reduce((sum, item) => 
    sum + ((item.price_sell || 0) * (item.quantity || 1)), 0
  );
  
  // Tổng số lượng
  const totalQuantity = invoiceData.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tổng số lượng: ${totalQuantity}`, 10, currentY);
  currentY += 8;
  
  // Tổng tiền hàng
  doc.text(`Tổng tiền hàng: ${formatCurrency(totalAmount)}`, 10, currentY);
  currentY += 8;
  
  // Chiết khấu (nếu có)
  const discount = invoiceData.discount || 0;
  if (discount > 0) {
    doc.text(`Chiết khấu: ${formatCurrency(discount)}`, 10, currentY);
    currentY += 8;
  }
  
  // Phí giao hàng (nếu có)
  const shippingFee = invoiceData.shippingFee || 0;
  if (shippingFee > 0) {
    doc.text(`Phí giao hàng: ${formatCurrency(shippingFee)}`, 10, currentY);
    currentY += 8;
  }
  
  // Khách phải trả (bold)
  const finalAmount = totalAmount - discount + shippingFee;
  doc.setFont('helvetica', 'bold');
  doc.text(`Khách phải trả: ${formatCurrency(finalAmount)}`, 10, currentY);
  currentY += 8;
  
  // Thông tin thanh toán - Chuẩn K80
  if (invoiceData.payments && invoiceData.payments.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('PHƯƠNG THỨC THANH TOÁN:', 10, currentY);
    currentY += 8;
    
    invoiceData.payments.forEach((payment) => {
      const paymentMethod = getPaymentMethodName(payment.source);
      doc.text(`- ${paymentMethod}: ${formatCurrency(payment.amount)}`, 10, currentY);
      currentY += 8;
    });
  }
  
  // Tiền khách đưa và tiền trả lại
  const customerPaid = invoiceData.customerPaid || finalAmount;
  const change = customerPaid - finalAmount;
  
  doc.text(`Tiền khách đưa: ${formatCurrency(customerPaid)}`, 10, currentY);
  currentY += 8;
  if (change > 0) {
    doc.text(`Tiền trả lại: ${formatCurrency(change)}`, 10, currentY);
    currentY += 8;
  }
  
  // Dòng kẻ cuối
  doc.setLineWidth(0.2);
  doc.line(10, currentY, 216, currentY);
  currentY += 12;
  
  // Chính sách đổi trả - Chuẩn K80
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Quý khách được phép đổi trả hàng trong vòng 7 ngày', 113, currentY, { align: 'center' });
  currentY += 8;
  doc.text('kể từ ngày mua hàng', 113, currentY, { align: 'center' });
  currentY += 12;
  
  // Cảm ơn
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CẢM ƠN VÀ HẸN GẶP LẠI QUÝ KHÁCH!', 113, currentY, { align: 'center' });
  currentY += 8;
  
  // Chữ ký - Chuẩn K80
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('XÁC NHẬN', 10, currentY);
  currentY += 8;
  doc.text('Người bán hàng', 30, currentY);
  doc.text('Khách hàng', 120, currentY);
  
  // Dòng kẻ cho chữ ký
  doc.setLineWidth(0.1);
  doc.line(20, currentY + 5, 80, currentY + 5);
  doc.line(110, currentY + 5, 170, currentY + 5);
  
  // Lưu file
  const fileName = `HoaDon_${invoiceData.invoiceNumber || Date.now()}.pdf`;
  doc.save(fileName);
};

// Helper functions - Chuẩn Việt Nam
const formatCurrency = (amount) => {
  if (!amount || amount === 0) return '0đ';
  
  // Format số theo chuẩn Việt Nam (dấu chấm phân cách hàng nghìn)
  const formatted = new Intl.NumberFormat('vi-VN').format(amount);
  return `${formatted}đ`;
};

const getPaymentMethodName = (source) => {
  const methods = {
    'tien_mat': 'Tiền mặt',
    'the': 'Thẻ',
    'chuyen_khoan': 'Chuyển khoản',
    'vi_dien_tu': 'Ví điện tử',
    'cong_no': 'Công nợ'
  };
  return methods[source] || source;
};

export default generateInvoicePDF;