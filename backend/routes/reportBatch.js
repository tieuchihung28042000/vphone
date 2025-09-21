import express from 'express';
const router = express.Router();
import Inventory from '../models/Inventory.js';
import ExportHistory from '../models/ExportHistory.js';
import Cashbook from '../models/Cashbook.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

// POST /api/report/xuat-hang-batch
router.post('/report/xuat-hang-batch', authenticateToken, requireRole(['admin','quan_ly','thu_ngan','nhan_vien_ban_hang']), async (req, res) => {
  try {
    const { items = [], customer_name, customer_phone, branch, sold_date, note, payments = [], sales_channel, salesperson, auto_cashbook = true } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Thiếu danh sách sản phẩm' });
    }

    const batch_id = `BATCH_${Date.now()}_${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const soldDate = sold_date ? new Date(sold_date) : new Date();

    const created = [];

    for (const row of items) {
      const { imei, sku, product_name, quantity = 1, price_sell = 0 } = row;

      if (imei && imei.toString().trim() !== '') {
        // Xuất iPhone: chuyển status sold
        const item = await Inventory.findOne({ imei: imei.trim(), status: 'in_stock' });
        if (!item) {
          return res.status(400).json({ message: `Không tìm thấy IMEI ${imei} trong kho` });
        }
        item.status = 'sold';
        item.sold_date = soldDate;
        await item.save();

        const rec = await ExportHistory.create({
          imei: item.imei,
          sku: item.sku,
          product_name: item.product_name || item.tenSanPham,
          quantity: 1,
          price_import: item.price_import || 0,
          price_sell: Number(price_sell) || item.price_sell || 0,
          sold_date: soldDate,
          customer_name, customer_phone,
          note, branch: branch || item.branch,
          category: item.category || '',
          export_type: 'iphone',
          batch_id, sales_channel: sales_channel || '', salesperson: salesperson || ''
        });
        created.push(rec);
      } else {
        // Xuất phụ kiện: trừ quantity
        const inv = await Inventory.findOne({ sku, product_name, status: { $in: ['in_stock','sold'] } });
        if (!inv) {
          return res.status(400).json({ message: `Không tìm thấy phụ kiện ${product_name || sku} trong kho` });
        }
        const q = parseInt(quantity) || 1;
        if ((inv.quantity || 0) < q) {
          return res.status(400).json({ message: `Không đủ số lượng cho ${product_name || sku} (còn ${inv.quantity || 0})` });
        }
        inv.quantity = (inv.quantity || 0) - q;
        if (inv.quantity <= 0) inv.status = 'sold';
        await inv.save();

        const rec = await ExportHistory.create({
          imei: '', sku: inv.sku,
          product_name: inv.product_name || inv.tenSanPham,
          quantity: q,
          price_import: inv.price_import || 0,
          price_sell: Number(price_sell) || 0,
          sold_date: soldDate,
          customer_name, customer_phone,
          note, branch: branch || inv.branch,
          category: inv.category || '',
          export_type: 'accessory',
          batch_id, sales_channel: sales_channel || '', salesperson: salesperson || ''
        });
        created.push(rec);
      }
    }

    // Auto ghi sổ quỹ theo payments nếu bật
    if (auto_cashbook && Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        if (!p || !p.source || !p.amount) continue;
        await Cashbook.create({
          type: 'thu', amount: Number(p.amount), source: p.source,
          content: 'Doanh thu bán hàng (batch)',
          customer: customer_name || '',
          date: soldDate, branch,
          related_id: batch_id, related_type: 'ban_hang',
          is_auto: true, editable: false
        });
      }
    }

    res.json({ message: '✅ Tạo đơn xuất batch thành công', batch_id, items: created });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi tạo xuất hàng batch', error: err.message });
  }
});

export default router;


