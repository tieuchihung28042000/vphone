import express from 'express';
const router = express.Router();
import Inventory from '../models/Inventory.js';
import ExportHistory from '../models/ExportHistory.js';
import Cashbook from '../models/Cashbook.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

// POST /api/report/xuat-hang-batch
router.post('/report/xuat-hang-batch', authenticateToken, requireRole(['admin','thu_ngan','nhan_vien_ban_hang']), async (req, res) => {
  try {
    const { items = [], customer_name, customer_phone, branch, sold_date, note, payments = [], sales_channel, auto_cashbook = true } = req.body;
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
          batch_id, sales_channel: sales_channel || '',
          created_by: req.user?._id,
          created_by_email: req.user?.email || '',
          created_by_name: req.user?.full_name || '',
          da_thanh_toan: Array.isArray(payments) ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0) : 0,
          payments: Array.isArray(payments) ? payments.filter(p => p && p.source && Number(p.amount) > 0) : []
        });
        created.push(rec);

        // === GHI NHẬN HOẠT ĐỘNG ===
        try {
          const activityData = {
            user_id: req.user?._id,
            username: req.user?.username || req.user?.email || '',
            role: req.user?.role,
            action: 'create',
            module: 'xuat_hang',
            payload_snapshot: {
              imei: item.imei,
              product_name: item.product_name || item.tenSanPham,
              quantity: 1,
              price_sell: Number(price_sell) || item.price_sell || 0,
              customer_name: customer_name,
              customer_phone: customer_phone,
              total_paid: Array.isArray(payments) ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0) : 0,
              branch: branch || item.branch,
              batch_id: batch_id
            },
            ref_id: item.imei || String(rec._id),
            branch: branch || item.branch
          };
          
          // Tạo mô tả chi tiết
          const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
          activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) tạo đơn xuất hàng batch - Sản phẩm: ${item.product_name || item.tenSanPham}${item.imei ? ` (IMEI: ${item.imei})` : ''} - Giá bán: ${new Intl.NumberFormat('vi-VN').format(Number(price_sell) || item.price_sell || 0)}đ${customer_name ? ` - Khách hàng: ${customer_name}` : ''}${customer_phone ? ` (${customer_phone})` : ''} - Đã thanh toán: ${new Intl.NumberFormat('vi-VN').format(Array.isArray(payments) ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0) : 0)}đ`;
          
          await ActivityLog.create(activityData);
        } catch (e) { /* ignore log error */ }
      } else {
        // Xuất phụ kiện: nới điều kiện tìm theo SKU + chi nhánh, bỏ ràng buộc tên; trừ tồn trên nhiều bản ghi nếu cần
        const q = parseInt(quantity) || 1;
        const findCond = { sku, status: 'in_stock', ...(branch ? { branch } : {}) };
        const candidates = await Inventory.find(findCond).sort({ import_date: 1, _id: 1 });
        const totalAvail = candidates.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        if (totalAvail <= 0) {
          return res.status(400).json({ message: `Không đủ số lượng cho ${product_name || sku} (còn 0)` });
        }
        if (totalAvail < q) {
          return res.status(400).json({ message: `Không đủ số lượng cho ${product_name || sku} (còn ${totalAvail})` });
        }

        let remaining = q;
        for (const doc of candidates) {
          if (remaining <= 0) break;
          const canTake = Math.min(Number(doc.quantity) || 0, remaining);
          doc.quantity = (Number(doc.quantity) || 0) - canTake;
          if ((Number(doc.quantity) || 0) <= 0) {
            doc.quantity = 0;
            doc.status = 'sold';
          }
          await doc.save();
          remaining -= canTake;
        }

        const refInv = candidates[0];
        const rec = await ExportHistory.create({
          imei: '',
          sku: refInv?.sku || sku,
          product_name: refInv?.product_name || refInv?.tenSanPham || (product_name || ''),
          quantity: q,
          price_import: refInv?.price_import || 0,
          price_sell: Number(price_sell) || 0,
          sold_date: soldDate,
          customer_name,
          customer_phone,
          note,
          branch: branch || refInv?.branch || '',
          category: refInv?.category || '',
          export_type: 'accessory',
          batch_id,
          sales_channel: sales_channel || '',
          created_by: req.user?._id,
          created_by_email: req.user?.email || '',
          created_by_name: req.user?.full_name || '',
          da_thanh_toan: Array.isArray(payments) ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0) : 0,
          payments: Array.isArray(payments) ? payments.filter(p => p && p.source && Number(p.amount) > 0) : []
        });
        created.push(rec);

        // === GHI NHẬN HOẠT ĐỘNG ===
        try {
          const activityData = {
            user_id: req.user?._id,
            username: req.user?.username || req.user?.email || '',
            role: req.user?.role,
            action: 'create',
            module: 'xuat_hang',
            payload_snapshot: {
              sku: refInv?.sku || sku,
              product_name: refInv?.product_name || refInv?.tenSanPham || (product_name || ''),
              quantity: q,
              price_sell: Number(price_sell) || 0,
              customer_name: customer_name,
              customer_phone: customer_phone,
              total_paid: Array.isArray(payments) ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0) : 0,
              branch: branch || refInv?.branch || '',
              batch_id: batch_id,
              export_type: 'accessory'
            },
            ref_id: refInv?.sku || sku || String(rec._id),
            branch: branch || refInv?.branch || ''
          };
          
          // Tạo mô tả chi tiết
          const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
          activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) tạo đơn xuất hàng phụ kiện batch - Sản phẩm: ${refInv?.product_name || refInv?.tenSanPham || (product_name || '')} (SKU: ${refInv?.sku || sku}) - Số lượng: ${q} - Giá bán: ${new Intl.NumberFormat('vi-VN').format(Number(price_sell) || 0)}đ${customer_name ? ` - Khách hàng: ${customer_name}` : ''}${customer_phone ? ` (${customer_phone})` : ''} - Đã thanh toán: ${new Intl.NumberFormat('vi-VN').format(Array.isArray(payments) ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0) : 0)}đ`;
          
          await ActivityLog.create(activityData);
        } catch (e) { /* ignore log error */ }
      }
    }

    // ✅ Phân bổ đã thanh toán theo tỉ lệ trên từng dòng (nếu có payments)
    try {
      const totalPaid = Array.isArray(payments) ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0) : 0;
      const totalSale = created.reduce((s, r) => s + ((Number(r.price_sell)||0) * (Number(r.quantity)||1)), 0);
      if (totalPaid > 0 && totalSale > 0) {
        let allocated = 0;
        for (let i = 0; i < created.length; i++) {
          const r = created[i];
          const lineTotal = (Number(r.price_sell)||0) * (Number(r.quantity)||1);
          let share = Math.floor((totalPaid * lineTotal) / totalSale);
          if (i === created.length - 1) {
            // dồn phần dư cho dòng cuối
            share = totalPaid - allocated;
          }
          allocated += share;
          r.da_thanh_toan = share;
          await r.save();
        }
      }
    } catch (e) { /* ignore proportional allocation errors */ }

    // Auto ghi sổ quỹ theo payments nếu bật
    if (auto_cashbook && Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        if (!p || !p.source || !p.amount) continue;
        await Cashbook.create({
          type: 'thu', amount: Number(p.amount), source: p.source,
          content: 'Doanh thu bán hàng (batch)',
          customer: customer_name || '',
          date: soldDate, branch: branch || 'Chi nhanh 1',
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

// GET /api/report/xuat-hang-batch/:batch_id -> trả về tất cả items thuộc batch
router.get('/report/xuat-hang-batch/:batch_id', authenticateToken, async (req, res) => {
  try {
    const { batch_id } = req.params;
    if (!batch_id) return res.status(400).json({ message: 'Thiếu batch_id' });
    const items = await ExportHistory.find({ batch_id }).sort({ sold_date: -1, _id: -1 });

    // Fetch and aggregate payments for this batch
    const cashbookPayments = await Cashbook.aggregate([
      { $match: { related_type: 'ban_hang', related_id: batch_id, type: 'thu' } },
      { $group: { _id: '$source', totalAmount: { $sum: '$amount' } } }
    ]);
    const payments = cashbookPayments.map(p => ({ source: p._id, amount: p.totalAmount }));

    return res.json({ batch_id, items, payments });
  } catch (err) {
    return res.status(500).json({ message: '❌ Lỗi lấy batch', error: err.message });
  }
});

// PUT /api/report/xuat-hang-batch/:batch_id -> cập nhật nhiều items trong batch
router.put('/report/xuat-hang-batch/:batch_id', authenticateToken, requireRole(['admin','thu_ngan','nhan_vien_ban_hang']), async (req, res) => {
  try {
    const { batch_id } = req.params;
    const { items = [], customer_name, customer_phone, branch, sold_date, note, payments = [], total_paid } = req.body;
    if (!batch_id) return res.status(400).json({ message: 'Thiếu batch_id' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Thiếu danh sách items để cập nhật' });
    }

    // ✅ Tính sẵn phân bổ theo payload nếu có total_paid
    let shareMap = {};
    try {
      const sumPaidRaw = (Array.isArray(payments) && payments.length > 0)
        ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0)
        : (total_paid !== undefined ? Number(total_paid) : undefined);
      if (sumPaidRaw !== undefined) {
        const sumPaid = Math.max(0, Number.isFinite(sumPaidRaw) ? sumPaidRaw : 0);
        const totals = (items || []).map(it => ({
          _id: String(it._id || ''),
          total: (Number(it.price_sell)||0) * (Number(it.quantity)||1)
        }));
        const totalSaleFromPayload = totals.reduce((s,t)=> s + t.total, 0);
        if (totalSaleFromPayload > 0) {
          let allocated = 0;
          for (let i = 0; i < totals.length; i++) {
            const t = totals[i];
            let share = sumPaid === 0 ? 0 : Math.floor((sumPaid * t.total) / totalSaleFromPayload);
            if (i === totals.length - 1) share = sumPaid - allocated;
            allocated += share;
            shareMap[t._id] = share;
          }
        } else if (sumPaid === 0) {
          for (const it of (items || [])) {
            shareMap[String(it._id || '')] = 0;
          }
        }
      }
    } catch (e) { /* ignore pre-allocation */ }

    const updateResults = [];
    for (const row of items) {
      const { _id, quantity, price_sell, da_thanh_toan, warranty } = row || {};
      if (!_id) continue;
      const update = {
        ...(quantity !== undefined ? { quantity: parseInt(quantity) || 1 } : {}),
        ...(price_sell !== undefined ? { price_sell: Number(price_sell) || 0 } : {}),
        ...(da_thanh_toan !== undefined ? { da_thanh_toan: Number(da_thanh_toan) || 0 } : {}),
        ...(shareMap[String(_id)] !== undefined ? { da_thanh_toan: Number(shareMap[String(_id)]) || 0 } : {}),
        ...(warranty !== undefined ? { warranty: warranty || '' } : {}),
        ...(sold_date ? { sold_date: new Date(sold_date) } : {}),
        ...(note !== undefined ? { note: note || '' } : {}),
        ...(customer_name !== undefined ? { customer_name: customer_name || '' } : {}),
        ...(customer_phone !== undefined ? { customer_phone: customer_phone || '' } : {}),
        ...(branch !== undefined ? { branch: branch || '' } : {}),
      };
      // Không cập nhật các trường nhận diện như imei, sku, product_name trong flow sửa
      const updated = await ExportHistory.findOneAndUpdate({ _id, batch_id }, { $set: update }, { new: true });
      if (updated) updateResults.push(updated);
    }

    // ✅ Re-allocate paid amount if provided (payments or total_paid), rồi trả về dữ liệu sau cùng
    try {
      const sumPaidRaw = (Array.isArray(payments) && payments.length > 0)
        ? payments.reduce((s,p)=> s + (Number(p?.amount)||0), 0)
        : (total_paid !== undefined ? Number(total_paid) : undefined);
      if (sumPaidRaw !== undefined) {
        const sumPaid = Math.max(0, Number.isFinite(sumPaidRaw) ? sumPaidRaw : 0);
        // Load again các dòng hiện tại của batch
        const current = await ExportHistory.find({ batch_id }).sort({ _id: 1 });
        const totalSale = current.reduce((s, r) => s + ((Number(r.price_sell)||0) * (Number(r.quantity)||1)), 0);
        if (totalSale > 0 && sumPaid > 0) {
          let allocated = 0;
          for (let i = 0; i < current.length; i++) {
            const r = current[i];
            const lineTotal = (Number(r.price_sell)||0) * (Number(r.quantity)||1);
            let share = Math.floor((sumPaid * lineTotal) / totalSale);
            if (i === current.length - 1) share = sumPaid - allocated;
            allocated += share;
            if (r.da_thanh_toan !== share) {
              r.da_thanh_toan = share;
              await r.save();
            }
          }
        } else if (sumPaid === 0) {
          for (const r of current) {
            if (r.da_thanh_toan !== 0) {
              r.da_thanh_toan = 0;
              await r.save();
            }
          }
        }
      }
    } catch (e) { /* ignore */ }

    // ✅ Chuẩn hoá payments và cập nhật sổ quỹ cho batch (thay thế toàn bộ bút toán cũ)
    let normalizedPayments = [];
    try {
      const validSources = new Set(['tien_mat', 'the', 'vi_dien_tu']);
      const mapBySource = new Map();
      if (Array.isArray(payments)) {
        for (const p of payments) {
          if (!p || !validSources.has(p.source)) continue;
          const amt = Number(p.amount) || 0;
          if (amt <= 0) continue;
          mapBySource.set(p.source, (mapBySource.get(p.source) || 0) + amt);
        }
      }
      normalizedPayments = Array.from(mapBySource.entries()).map(([source, amount]) => ({ source, amount }));

      // Ghi sổ quỹ: xoá cũ, ghi mới
      await Cashbook.deleteMany({ related_type: 'ban_hang', related_id: batch_id });
      if (normalizedPayments.length > 0) {
        const paidDate = sold_date ? new Date(sold_date) : new Date();
        const branchForEntry = branch || '';
        const customerForEntry = customer_name || '';
        for (const p of normalizedPayments) {
          await Cashbook.create({
            type: 'thu', amount: Number(p.amount), source: p.source,
            content: 'Doanh thu bán hàng (batch - cập nhật)',
            customer: customerForEntry,
            date: paidDate, branch: branchForEntry,
            related_id: batch_id, related_type: 'ban_hang',
            is_auto: true, editable: false
          });
        }
      }
    } catch (e) {
      // Không chặn flow chính nếu sổ quỹ lỗi
    }

    const refreshed = await ExportHistory.find({ batch_id });
    return res.json({ message: '✅ Cập nhật batch thành công', batch_id, updated_count: updateResults.length, items: refreshed, payments: normalizedPayments });
  } catch (err) {
    return res.status(500).json({ message: '❌ Lỗi cập nhật batch', error: err.message });
  }
});

export default router;



