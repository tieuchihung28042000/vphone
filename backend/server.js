import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Set MONGODB_URI if not already set, constructing from granular ENV variables
if (!process.env.MONGODB_URI) {
  const isProd = (process.env.NODE_ENV === 'production');
  const mongoHost = process.env.MONGODB_HOST || (isProd ? 'vphone-mongodb' : 'localhost');
  const mongoPort = process.env.MONGODB_PORT || '27017';
  const mongoDbName = process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || (isProd ? 'vphone_production' : 'vphone_dev');

  const mongoUser = process.env.MONGODB_USER || process.env.MONGO_ROOT_USERNAME;
  const mongoPass = process.env.MONGODB_PASS || process.env.MONGO_ROOT_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || (mongoUser ? (process.env.MONGODB_AUTH_DB || 'admin') : undefined);

  const withCreds = mongoUser ? `${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPass || '')}@` : '';
  const authQuery = authSource ? `?authSource=${encodeURIComponent(authSource)}` : '';
  process.env.MONGODB_URI = `mongodb://${withCreds}${mongoHost}:${mongoPort}/${mongoDbName}${authQuery}`;

  // Masked log for visibility during setup
  const maskedUser = mongoUser ? encodeURIComponent(mongoUser) : '';
  const maskedCreds = mongoUser ? `${maskedUser}:****@` : '';
  console.log(`ℹ️ Resolved MONGODB_URI: mongodb://${maskedCreds}${mongoHost}:${mongoPort}/${mongoDbName}${authQuery}`);
}

import Inventory from './models/Inventory.js';
import Cashbook from './models/Cashbook.js'; // THÊM DÒNG NÀY
import ExportHistory from './models/ExportHistory.js'; // THÊM MODEL EXPORT HISTORY
import ReturnImport from './models/ReturnImport.js'; // THÊM MODEL RETURN IMPORT
import ReturnExport from './models/ReturnExport.js'; // THÊM MODEL RETURN EXPORT
import User from './models/User.js'; // THÊM MODEL USER
import Branch from './models/Branch.js'; // THÊM MODEL BRANCH
import SupplierDebt from './models/SupplierDebt.js';
import ActivityLog from './models/ActivityLog.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import reportRoutes from './routes/report.js';
import reportBatchRoutes from './routes/reportBatch.js';
import branchRoutes from './routes/branch.js';
import categoryRoutes from './routes/category.js';
import congNoRoutes from './routes/congno.js';
import adminRoutes from './routes/admin.js';
import cashbookRoutes from './routes/cashbook.js'; // THÊM DÒNG NÀY
import returnImportRoutes from './routes/returnImport.js';
import returnExportRoutes from './routes/returnExport.js';
import activityLogRoutes from './routes/activityLog.js';
import inventoryRoutes from './routes/inventory.js';
import { authenticateToken, requireBranch, requireRole, filterByBranch } from './middleware/auth.js';

const app = express();

// Helper: chuẩn hóa source cho Cashbook
function normalizeCashSource(input) {
  const map = {
    'Tiền mặt': 'tien_mat',
    '💵 Tiền mặt': 'tien_mat',
    'tien_mat': 'tien_mat',
    'Thẻ': 'the',
    '💳 Thẻ': 'the',
    'the': 'the',
    'Ví điện tử': 'vi_dien_tu',
    '📱 Ví điện tử': 'vi_dien_tu',
    'vi_dien_tu': 'vi_dien_tu',
  };
  return map[input] || 'tien_mat';
}

// CORS configuration - cho phép tất cả origins để dễ triển khai
app.use(cors({
  origin: function (origin, callback) {
    // Cho phép tất cả origins để dễ triển khai cho nhiều người
    console.log('✅ CORS allowing origin:', origin || 'no-origin');
    return callback(null, true);
  },
  credentials: true,
}));

app.options('*', cors());
app.use(express.json());

// ==== Đăng ký các route API ====
console.log('🔧 [SERVER] Đang đăng ký routes...');
app.use('/api', adminRoutes);
// Mount báo cáo dưới /api/report để tránh middleware báo cáo chặn toàn bộ /api
app.use('/api/report', reportRoutes);
app.use('/api', reportBatchRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cong-no', congNoRoutes);
app.use('/api/cashbook', cashbookRoutes); // ROUTE SỔ QUỸ
app.use('/api/inventory', inventoryRoutes); // ROUTE INVENTORY
app.use('/api/activity-logs', activityLogRoutes);
console.log('🔧 [SERVER] Đang đăng ký return routes...');
app.use('/api/return-import', returnImportRoutes);
app.use('/api/return-export', returnExportRoutes);
console.log('✅ [SERVER] Đã đăng ký tất cả routes');

// ==================== API: SUPER DEBUG BACKEND ====================

// ==================== API: SIMPLE UPDATE TEST ====================

// API lấy danh sách nhập hàng
app.get('/api/nhap-hang', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { branch } = req.query;
    let query = {};
    if (req.branchFilter) {
      query = { ...req.branchFilter };
    } else if (branch && branch !== 'all') {
      query.branch = branch;
    }
    const items = await Inventory.find(query).sort({ import_date: -1, _id: -1 });
    res.status(200).json({ items });
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách nhập hàng:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi lấy danh sách', error: error.message });
  }
});

// API nhập hàng (tích hợp ghi sổ quỹ)
app.post('/api/nhap-hang', authenticateToken, async (req, res) => {
  try {
    const {
      imei,
      sku,
      price_import,
      product_name,
      import_date,
      supplier,
      branch,
      note,
      quantity,
      category,
      source, // Nguồn tiền: Tiền mặt/Thẻ/Công nợ (từ frontend)
      da_thanh_toan_nhap, // Số tiền đã thanh toán cho nhà cung cấp
      payments // [{source, amount}] nếu đa nguồn
    } = req.body;

    // Gán user thực hiện vào log
    const execUser = req.user?.username || 'Admin';

    if (imei) {
      const exists = await Inventory.findOne({ imei });
      if (exists) {
        return res.status(400).json({ message: '❌ IMEI này đã tồn tại trong kho.' });
      }
      // Tính toán đã thanh toán
      const priceImportNum = Number(price_import) || 0;
      const daTTNhapNum = Number(da_thanh_toan_nhap) || 0; // ✅ Không tự động full, thiếu thì = 0

      const newItem = new Inventory({
        imei,
        sku,
        price_import: priceImportNum,
        product_name,
        tenSanPham: product_name,
        import_date,
        supplier,
        branch,
        note,
        quantity: 1,
        category,
        da_thanh_toan_nhap: daTTNhapNum, // Đã thanh toán cho nhà cung cấp
        status: 'in_stock',
      });
      await newItem.save();
      // Lịch sử hoạt động: Nhập hàng IMEI
      try {
        await ActivityLog.create({
          module: 'nhap_hang',
          action: 'create',
          branch: branch || '',
          ref_id: newItem._id?.toString() || '',
          user_id: req.user?._id,
          username: (req.user && (req.user.full_name || req.user.email || req.user.id)) || 'system',
          role: (req.user && req.user.role) || 'system',
          payload_snapshot: newItem.toObject(),
        });
      } catch (e) { /* ignore */ }

      // --- Cập nhật CÔNG NỢ NHÀ CUNG CẤP ---
      const totalImportCost = priceImportNum; // IMEI luôn số lượng 1
      const totalPaidToSupplier = daTTNhapNum;
      const supplierDebtIncrease = Math.max(totalImportCost - totalPaidToSupplier, 0);
      if (supplier && priceImportNum > 0) {
        // Luôn ghi lịch sử công nợ: số nợ tăng = giá nhập - đã thanh toán
        const supplierDebtIncrease = Math.max(priceImportNum - (daTTNhapNum || 0), 0);
        try {
          await SupplierDebt.findOneAndUpdate(
            { supplier_name: supplier, branch: branch || '' },
            {
              $inc: { total_debt: supplierDebtIncrease, total_paid: daTTNhapNum || 0 },
              $push: {
                debt_history: {
                  type: supplierDebtIncrease > 0 ? 'add' : 'pay',
                  amount: supplierDebtIncrease > 0 ? supplierDebtIncrease : (daTTNhapNum || 0),
                  date: new Date(),
                  note: `Nhập đơn hàng ${product_name} (IMEI: ${imei || 'N/A'}) - Giá: ${priceImportNum}đ, Đã thanh toán: ${daTTNhapNum || 0}đ`,
                  related_id: newItem._id?.toString() || ''
                }
              }
            },
            { upsert: true, new: true }
          );
        } catch (e) {
          console.error('⚠️ Ghi lịch sử công nợ NCC (import) lỗi:', e.message);
        }
      }

      // --- Ghi SỔ QUỸ: hỗ trợ đa nguồn ---
      const payList = Array.isArray(payments) && payments.length > 0
        ? payments
        : (daTTNhapNum > 0 ? [{ source: source || 'tien_mat', amount: daTTNhapNum }] : []);
      for (const p of payList) {
        if (!p || !p.amount) continue;
        await Cashbook.create({
          type: 'chi',
          amount: Number(p.amount),
          content: `Nhập hàng: ${product_name} (IMEI: ${imei})`,
          note: note || '',
          date: import_date || new Date(),
          branch,
          source: p.source || 'tien_mat',
          supplier: supplier || '',
          related_id: newItem._id,
          related_type: 'nhap_hang',
          is_auto: true,
        });
      }

      return res.status(201).json({
        message: '✅ Nhập hàng thành công!',
        item: newItem,
      });
    }

    if (!sku || !product_name) {
      return res.status(400).json({ message: '❌ Thiếu SKU hoặc tên sản phẩm.' });
    }

    // ✅ Sửa: Tìm sản phẩm cùng loại để gộp (không phân biệt giá nhập và ngày tháng)
    let existItem = await Inventory.findOne({
      $or: [{ imei: null }, { imei: "" }, { imei: undefined }],
      sku: sku,
      branch: branch,
      product_name: product_name,
      category: category,
      // Bỏ điều kiện price_import để gộp cùng sản phẩm dù khác giá nhập
    });

    if (existItem) {
      // Cập nhật số lượng
      const quantityNum = Number(quantity || 1);
      const priceImportNum = Number(price_import) || 0;
      const daTTNhapNum = Number(da_thanh_toan_nhap) || 0; // ✅ Không tự động full, thiếu thì = 0

      existItem.quantity = (existItem.quantity || 1) + quantityNum;
      existItem.import_date = import_date || existItem.import_date;
      existItem.supplier = supplier || existItem.supplier;
      existItem.note = note || existItem.note;
      existItem.da_thanh_toan_nhap = (existItem.da_thanh_toan_nhap || 0) + daTTNhapNum;
      await existItem.save();

      // Lịch sử hoạt động: Nhập phụ kiện (cộng dồn)
      try {
        await ActivityLog.create({
          module: 'nhap_hang',
          action: 'update',
          branch: branch || '',
          ref_id: existItem._id?.toString() || '',
          user_id: req.user?._id,
          username: (req.user && (req.user.full_name || req.user.email || req.user.id)) || 'system',
          role: (req.user && req.user.role) || 'system',
          payload_snapshot: { ...existItem.toObject(), added_quantity: quantityNum, added_paid: daTTNhapNum },
        });
      } catch (e) { /* ignore */ }

      // --- Cập nhật CÔNG NỢ NHÀ CUNG CẤP ---
      const totalImportCost2 = priceImportNum * quantityNum;
      const totalPaidToSupplier2 = daTTNhapNum;
      const supplierDebtIncrease2 = Math.max(totalImportCost2 - totalPaidToSupplier2, 0);
      if (supplierDebtIncrease2 > 0 && supplier) {
        await SupplierDebt.findOneAndUpdate(
          { supplier_name: supplier, branch: branch || '' },
          {
            $inc: { total_debt: supplierDebtIncrease2 },
            $push: {
              debt_history: {
                type: 'add', amount: supplierDebtIncrease2, date: new Date(),
                note: `Cộng nợ từ nhập phụ kiện: ${product_name} (SKU: ${sku})`, related_id: existItem._id?.toString() || ''
              }
            }
          },
          { upsert: true, new: true }
        );
      }
      return res.status(200).json({
        message: '✅ Đã cộng dồn số lượng phụ kiện!',
        item: existItem,
      });
    } else {
      // Tính toán cho phụ kiện mới
      const quantityNum = Number(quantity || 1);
      const priceImportNum = Number(price_import) || 0;
      const daTTNhapNum = Number(da_thanh_toan_nhap) || 0; // ✅ Không tự động full, thiếu thì = 0

      const newItem = new Inventory({
        sku,
        price_import: priceImportNum,
        product_name,
        tenSanPham: product_name,
        import_date,
        supplier,
        branch,
        note,
        quantity: quantityNum,
        category,
        da_thanh_toan_nhap: daTTNhapNum, // Đã thanh toán cho nhà cung cấp
        status: 'in_stock',
      });
      await newItem.save();

      // Lịch sử hoạt động: Nhập phụ kiện (tạo mới)
      try {
        await ActivityLog.create({
          module: 'nhap_hang',
          action: 'create',
          branch: branch || '',
          ref_id: newItem._id?.toString() || '',
          user_id: req.user?._id,
          username: (req.user && (req.user.full_name || req.user.email || req.user.id)) || 'system',
          role: (req.user && req.user.role) || 'system',
          payload_snapshot: newItem.toObject(),
        });
      } catch (e) { /* ignore */ }

      // --- Cập nhật CÔNG NỢ NHÀ CUNG CẤP ---
      const totalImportCost3 = priceImportNum * quantityNum;
      const totalPaidToSupplier3 = daTTNhapNum;
      const supplierDebtIncrease3 = Math.max(totalImportCost3 - totalPaidToSupplier3, 0);
      if (supplierDebtIncrease3 > 0 && supplier) {
        await SupplierDebt.findOneAndUpdate(
          { supplier_name: supplier, branch: branch || '' },
          {
            $inc: { total_debt: supplierDebtIncrease3 },
            $push: {
              debt_history: {
                type: 'add', amount: supplierDebtIncrease3, date: new Date(),
                note: `Cộng nợ từ nhập phụ kiện mới: ${product_name} (SKU: ${sku})`, related_id: newItem._id?.toString() || ''
              }
            }
          },
          { upsert: true, new: true }
        );
      }

      // --- Ghi SỔ QUỸ: hỗ trợ đa nguồn ---
      const payList2 = Array.isArray(payments) && payments.length > 0
        ? payments
        : (daTTNhapNum > 0 ? [{ source: source || 'tien_mat', amount: daTTNhapNum }] : []);
      for (const p of payList2) {
        if (!p || !p.amount) continue;
        await Cashbook.create({
          type: 'chi',
          amount: Number(p.amount),
          content: `Nhập phụ kiện: ${product_name}`,
          note: note || '',
          date: import_date || new Date(),
          branch,
          source: p.source || 'tien_mat',
          supplier: supplier || '',
          related_id: newItem._id,
        });
      }

      return res.status(201).json({
        message: '✅ Nhập phụ kiện thành công!',
        item: newItem,
      });
    }
  } catch (error) {
    console.error('❌ Lỗi khi nhập hàng:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi nhập hàng', error: error.message });
  }
});

// API sửa hàng
app.put('/api/nhap-hang/:id', authenticateToken, requireBranch, async (req, res) => {
  try {
    // ✅ FIX: Lấy record hiện tại trước khi cập nhật
    const existingItem = await Inventory.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ message: '❌ Không tìm thấy sản phẩm để cập nhật.' });
    }

    // ✅ FIX: Tạo updateData và bảo vệ price_import khỏi bị thay đổi
    const updateData = { ...req.body };

    // ✅ Bảo vệ price_import - chỉ cho phép cập nhật nếu có giá trị và khác 0
    if (updateData.price_import !== undefined) {
      const newPriceImport = Number(updateData.price_import) || 0;
      if (newPriceImport <= 0) {
        // Nếu giá trị mới <= 0, giữ nguyên giá trị cũ
        updateData.price_import = existingItem.price_import;
      }
    }

    // ✅ Tự động cập nhật status dựa trên quantity
    if (updateData.quantity !== undefined) {
      const newQuantity = Number(updateData.quantity) || 0;
      // Logic: nếu quantity > 0 thì status = 'in_stock', nếu quantity = 0 thì status = 'sold'
      updateData.status = newQuantity > 0 ? 'in_stock' : 'sold';
      console.log('🔄 Auto-updating status based on quantity:', {
        quantity: newQuantity,
        newStatus: updateData.status
      });
    }

    console.log('🔄 Updating inventory item:', {
      id: req.params.id,
      oldPriceImport: existingItem.price_import,
      newPriceImport: updateData.price_import,
      note: 'Bảo vệ price_import khỏi bị thay đổi không mong muốn'
    });

    const updatedItem = await Inventory.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    );

    res.status(200).json({
      message: '✅ Cập nhật thành công!',
      item: updatedItem,
    });
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật sản phẩm:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi cập nhật', error: error.message });
  }
});

// API xoá hàng
app.delete('/api/nhap-hang/:id', authenticateToken, requireBranch, async (req, res) => {
  try {
    const deletedItem = await Inventory.findByIdAndDelete(req.params.id);

    if (!deletedItem) {
      return res.status(404).json({ message: '❌ Không tìm thấy sản phẩm để xoá.' });
    }

    res.status(200).json({
      message: '✅ Đã xoá thành công!',
      item: deletedItem,
    });
  } catch (error) {
    console.error('❌ Lỗi khi xoá sản phẩm:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi xoá sản phẩm', error: error.message });
  }
});

// API xuất hàng (tích hợp ghi sổ quỹ)
app.post('/api/xuat-hang', authenticateToken, requireBranch, async (req, res) => {
  try {
    const {
      imei,
      price_sell,
      customer_name,
      customer_phone,
      warranty,
      note,
      sku,
      product_name,
      sold_date,
      da_thanh_toan, // Số tiền đã thanh toán
      branch,
      source, // Nguồn tiền (frontend truyền lên)
      is_accessory,
      quantity // Số lượng (cho phụ kiện)
    } = req.body;

    const execUser = req.user?.username || 'Admin';

    console.log('🔍 POST /api/xuat-hang received da_thanh_toan:', da_thanh_toan);
    console.log('🔍 POST da_thanh_toan type:', typeof da_thanh_toan);
    console.log('🔍 POST full request body:', req.body);

    let item;

    // ✅ Xử lý phụ kiện và sản phẩm có IMEI khác nhau
    if (is_accessory || !imei) {
      // Phụ kiện: ưu tiên tìm theo SKU + chi nhánh, kèm theo tên; chỉ lấy hàng còn tồn
      const orConds = [];
      if (sku) orConds.push({ sku });
      if (product_name) {
        orConds.push({ product_name });
        orConds.push({ tenSanPham: product_name });
      }
      const query = {
        status: 'in_stock',
        ...(branch ? { branch } : {}),
        ...(orConds.length > 0 ? { $or: orConds } : {})
      };
      const availableItems = await Inventory.find(query);

      if (availableItems.length === 0) {
        // Thử tìm mềm hơn theo SKU + chi nhánh, bất kể status (để biết vì sao không thấy)
        const soft = await Inventory.findOne({ sku, ...(branch ? { branch } : {}), status: { $in: ['in_stock', 'sold'] } });
        if (!soft) {
          return res.status(404).json({ message: '❌ Không tìm thấy phụ kiện trong kho.' });
        }
        if ((soft.quantity || 0) <= 0 || soft.status === 'sold') {
          return res.status(400).json({ message: `❌ Phụ kiện đã hết hàng (SL còn ${soft.quantity || 0}).` });
        }
        availableItems.push(soft);
      }

      // Lấy item đầu tiên có số lượng > 0
      item = availableItems.find(i => (i.quantity || 0) > 0) || availableItems[0];

      if (!item) {
        return res.status(404).json({ message: '❌ Phụ kiện đã hết hàng.' });
      }

      // ✅ Kiểm tra số lượng trực tiếp từ Inventory (logic đơn giản)
      const sellQuantity = parseInt(quantity) || 1;
      const currentQuantity = item.quantity || 0;

      if (currentQuantity < sellQuantity) {
        return res.status(400).json({
          message: `❌ Không đủ số lượng. Còn lại: ${currentQuantity}, yêu cầu: ${sellQuantity}`
        });
      }

    } else {
      // Sản phẩm có IMEI: tìm theo IMEI
      item = await Inventory.findOne({ imei });
      if (!item) {
        return res.status(404).json({ message: '❌ Không tìm thấy IMEI trong kho.' });
      }

      if (item.status === 'sold') {
        return res.status(400).json({ message: '⚠️ Máy này đã được bán trước đó.' });
      }
    }

    // ✅ Xử lý khác nhau cho phụ kiện và sản phẩm IMEI
    if (is_accessory || !imei) {
      // ✅ PHỤ KIỆN: TRỪ trực tiếp quantity trong Inventory (logic đơn giản)
      const sellQuantity = parseInt(quantity) || 1;

      // ✅ Trừ trực tiếp quantity trong Inventory
      item.quantity = (item.quantity || 0) - sellQuantity;

      // Nếu hết hàng thì chuyển status
      if (item.quantity <= 0) {
        item.status = 'sold';
        item.quantity = 0;
      }

      // ✅ Ghi vào ExportHistory thay vì Inventory
      const priceSellNum = Number(price_sell) || 0;
      // ✅ FIX: Không tự động tính da_thanh_toan khi bán hàng, lưu đúng giá trị người dùng nhập
      let daTTNum = parseFloat(da_thanh_toan) || 0; // Lưu giá trị người dùng nhập (kể cả 0)

      console.log('🔧 Creating ExportHistory for accessory with quantity:', sellQuantity); // ✅ Debug log
      console.log('🔍 POST Accessory da_thanh_toan - FIXED:', {
        input_da_thanh_toan: da_thanh_toan,
        final_daTTNum: daTTNum,
        priceSellNum,
        sellQuantity,
        note: 'Không tự động tính, lưu đúng giá trị người dùng nhập'
      });

      const soldAccessory = new ExportHistory({
        imei: '', // Phụ kiện không có IMEI
        sku: item.sku,
        product_name: item.product_name,
        category: item.category,
        price_import: item.price_import,
        price_sell: priceSellNum, // ✅ Chỉ dùng field có trong schema
        da_thanh_toan: daTTNum, // ✅ Field này có trong schema
        sold_date: sold_date ? new Date(sold_date) : new Date(),
        customer_name: customer_name || '',
        customer_phone: customer_phone || '',
        warranty: warranty || '',
        note: note || '',
        branch: branch || item.branch,
        quantity: sellQuantity, // ✅ Field này có trong schema
        export_type: 'accessory', // ✅ Đánh dấu là phụ kiện
        created_by: req.user?._id,
        created_by_email: req.user?.email || '',
        created_by_name: req.user?.full_name || ''
      });

      console.log('✅ ExportHistory record to be saved:', {
        sku: soldAccessory.sku,
        product_name: soldAccessory.product_name,
        quantity: soldAccessory.quantity,
        price_sell: soldAccessory.price_sell,
        da_thanh_toan: soldAccessory.da_thanh_toan
      }); // ✅ Debug log

      await soldAccessory.save();
      // Lịch sử hoạt động: Xuất hàng phụ kiện
      try {
        await ActivityLog.create({
          module: 'xuat_hang',
          action: 'create',
          branch: (branch || item.branch || ''),
          ref_id: soldAccessory._id?.toString() || '',
          user_id: req.user?._id,
          username: (req.user && (req.user.full_name || req.user.email || req.user.id)) || 'system',
          role: (req.user && req.user.role) || 'system',
          payload_snapshot: soldAccessory.toObject(),
        });
      } catch (e) { /* ignore */ }
      // ✅ Save item vì đã thay đổi quantity
      await item.save();

      // ✅ DEBUG: Kiểm tra record sau khi lưu
      const savedRecord = await ExportHistory.findById(soldAccessory._id);
      console.log('🔍 SAVED ACCESSORY RECORD:', {
        _id: savedRecord._id,
        da_thanh_toan: savedRecord.da_thanh_toan,
        quantity: savedRecord.quantity,
        price_sell: savedRecord.price_sell
      });

      // Đặt item thành soldAccessory để ghi sổ quỹ
      item = soldAccessory;

    } else {
      // ✅ Sản phẩm IMEI: Tạo record mới trong ExportHistory + cập nhật Inventory

      // 1. Cập nhật Inventory (chuyển status sang sold)
      item.status = 'sold';
      item.sold_date = sold_date ? new Date(sold_date) : new Date();
      await item.save();

      // 2. Tạo record mới trong ExportHistory
      const priceSellNum = Number(price_sell) || 0;
      // ✅ FIX: Không tự động tính da_thanh_toan khi bán hàng, lưu đúng giá trị người dùng nhập
      let daTTNum = parseFloat(da_thanh_toan) || 0; // Lưu giá trị người dùng nhập (kể cả 0)

      console.log('🔧 Creating ExportHistory for IMEI product with quantity: 1'); // ✅ Debug log
      console.log('🔍 POST IMEI da_thanh_toan - FIXED:', {
        input_da_thanh_toan: da_thanh_toan,
        final_daTTNum: daTTNum,
        priceSellNum,
        note: 'Không tự động tính, lưu đúng giá trị người dùng nhập'
      });

      const soldItem = new ExportHistory({
        imei: item.imei,
        sku: sku || item.sku,
        product_name: product_name || item.product_name,
        category: item.category,
        price_import: item.price_import,
        price_sell: priceSellNum,
        da_thanh_toan: daTTNum, // ✅ Field này có trong schema
        sold_date: sold_date ? new Date(sold_date) : new Date(),
        customer_name: customer_name || '',
        customer_phone: customer_phone || '',
        warranty: warranty || '',
        note: note || '',
        branch: branch || item.branch,
        export_type: 'normal', // ✅ Field này có trong schema
        quantity: 1, // ✅ Sản phẩm IMEI luôn là 1
        created_by: req.user?._id,
        created_by_email: req.user?.email || '',
        created_by_name: req.user?.full_name || ''
      });

      console.log('✅ ExportHistory IMEI record to be saved:', {
        imei: soldItem.imei,
        sku: soldItem.sku,
        product_name: soldItem.product_name,
        quantity: soldItem.quantity,
        price_sell: soldItem.price_sell,
        da_thanh_toan: soldItem.da_thanh_toan
      }); // ✅ Debug log

      await soldItem.save();
      // Lịch sử hoạt động: Xuất hàng IMEI
      try {
        await ActivityLog.create({
          module: 'xuat_hang',
          action: 'create',
          branch: (branch || item.branch || ''),
          ref_id: soldItem._id?.toString() || '',
          user_id: req.user?._id,
          username: (req.user && (req.user.full_name || req.user.email || req.user.id)) || 'system',
          role: (req.user && req.user.role) || 'system',
          payload_snapshot: soldItem.toObject(),
        });
      } catch (e) { /* ignore */ }

      // ✅ DEBUG: Kiểm tra record sau khi lưu
      const savedIMEIRecord = await ExportHistory.findById(soldItem._id);
      console.log('🔍 SAVED IMEI RECORD:', {
        _id: savedIMEIRecord._id,
        da_thanh_toan: savedIMEIRecord.da_thanh_toan,
        quantity: savedIMEIRecord.quantity,
        price_sell: savedIMEIRecord.price_sell,
        imei: savedIMEIRecord.imei
      });

      // Cập nhật item để sử dụng cho phần ghi sổ quỹ phía dưới
      item = soldItem;
    }

    const profit = (item.giaBan || 0) - (item.price_import || 0);

    // --- Ghi SỔ QUỸ: THU TIỀN ---
    const productDescription = item.imei
      ? `${item.product_name} (IMEI: ${item.imei})`
      : `${item.product_name} (Phụ kiện - SL: ${item.quantity || 1})`;

    // Ghi sổ quỹ với số tiền đã thanh toán thực tế
    const amountReceived = Number(item.da_thanh_toan || da_thanh_toan || 0);
    if (amountReceived > 0) {
      await Cashbook.create({
        type: 'thu',
        amount: amountReceived,
        content: `Bán hàng: ${productDescription}`,
        note: note || '',
        date: sold_date || new Date(),
        branch: branch || '',
        source: normalizeCashSource(source || 'tien_mat'),
        customer: customer_name || '',
        related_id: item._id,
        related_type: 'ban_hang',
        is_auto: true,
      });
    }

    // ✅ REMOVED: Không dùng field debt nữa, tính công nợ = (giá bán × số lượng) - đã thanh toán
    // Nếu có công nợ thì ghi sổ công nợ khách
    const sellQuantity = parseInt(quantity) || 1;
    const congNo = Math.max(((item.price_sell || 0) * sellQuantity) - (item.da_thanh_toan || 0), 0);
    if (congNo > 0) {
      await Cashbook.create({
        type: 'thu',
        amount: congNo,
        content: `Công nợ khách hàng khi bán: ${productDescription}`,
        note: `Công nợ khách: ${customer_name}`,
        date: sold_date || new Date(),
        branch: branch || '',
        source: 'cong_no',
        customer: customer_name || '',
        related_id: item._id,
        related_type: 'ban_hang',
        is_auto: true,
      });
    }

    res.status(200).json({ message: '✅ Xuất hàng thành công!', item, profit });
  } catch (error) {
    console.error('❌ Lỗi khi xuất hàng:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi xuất hàng', error: error.message });
  }
});

// API cảnh báo tồn kho
app.get('/api/canh-bao-ton-kho', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { branch } = req.query;
    let query = { status: 'in_stock' };

    // Apply branch filter (from middleware or query)
    if (req.branchFilter) {
      query = { ...query, ...req.branchFilter };
    } else if (branch && branch !== 'all') {
      query.branch = branch;
    }

    // Lấy tất cả kho theo điều kiện
    const inventories = await Inventory.find(query);

    // Grouping logic for both accessories and others
    const map = {};
    inventories.forEach(item => {
      // Group by SKU and branch
      const key = (item.sku || 'N/A') + '|' + (item.branch || 'N/A');
      if (!map[key]) {
        map[key] = {
          sku: item.sku || "N/A",
          tenSanPham: item.product_name || item.tenSanPham || "N/A",
          branch: item.branch || "Mặc định",
          totalRemain: 0,
        };
      }
      // For items with quantity, add it; for items without (IMEI), it's 1
      map[key].totalRemain += Number(item.quantity || 1);
    });

    const result = Object.values(map).filter(item => item.totalRemain < 2);

    res.status(200).json({
      message: '✅ Danh sách cảnh báo tồn kho',
      total: result.length,
      items: result,
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy cảnh báo tồn kho:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi lấy cảnh báo tồn kho', error: error.message });
  }
});

// API chi tiết IMEI
app.get('/api/imei-detail/:imei', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { imei } = req.params;
    let query = { imei };
    if (req.branchFilter) {
      query = { ...query, ...req.branchFilter };
    }
    const item = await Inventory.findOne(query);

    if (!item) {
      return res.status(404).json({ message: '❌ Không tìm thấy IMEI này hoặc bạn không có quyền truy cập.' });
    }

    res.status(200).json({
      message: '✅ Thông tin chi tiết IMEI',
      item
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy chi tiết IMEI:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi lấy chi tiết IMEI', error: error.message });
  }
});

// API tồn kho (đồng bộ với logic gộp trong routes/report.js)
app.get('/api/ton-kho', authenticateToken, filterByBranch, async (req, res) => {
  try {
    let mongoQuery = { status: 'in_stock' };
    let soldQuery = { status: 'sold' };

    const getImportMonth = (d) => {
      const dt = d ? new Date(d) : null;
      if (!dt || isNaN(dt)) return 'Unknown';
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    };

    // Bộ lọc chi nhánh
    if (req.branchFilter) {
      mongoQuery = { ...mongoQuery, ...req.branchFilter };
      soldQuery = { ...soldQuery, ...req.branchFilter };
    } else if (req.query.branch && req.query.branch !== 'all') {
      mongoQuery.branch = req.query.branch;
      soldQuery.branch = req.query.branch;
    }

    const inventories = await Inventory.find(mongoQuery); // Chỉ item còn trong kho
    const soldInventories = await Inventory.find(soldQuery); // Item đã bán để tính totalSold

    // Map tổng đã bán theo key sku|product|category|branch
    const soldCountMap = new Map();
    // NOTE: Đồng bộ với frontend dist hiện tại: gộp theo SKU + tên + category + branch (KHÔNG tách theo tháng)
    soldInventories.forEach((item) => {
      const uniqueKey = item.sku && item.sku.trim()
        ? item.sku
        : item.product_name || item.tenSanPham || `product_${item._id}`;
      const key = uniqueKey + "|" + (item.product_name || item.tenSanPham || "") + "|" + (item.category || "") + "|" + (item.branch || "");
      const isAccessory = !item.imei;
      const soldQty = isAccessory ? Number(item.quantity) || 0 : 1;
      soldCountMap.set(key, (soldCountMap.get(key) || 0) + soldQty);
    });

    // Tổng xuất phụ kiện từ ExportHistory (phòng trường hợp soldCountMap thiếu)
    const exportAgg = await ExportHistory.aggregate([
      { $match: { imei: { $in: [null, ""] } } },
      { $group: { _id: "$sku", totalExported: { $sum: "$quantity" } } }
    ]);
    const exportMap = {};
    exportAgg.forEach(e => { exportMap[e._id] = e.totalExported; });

    // Tổng nhập iPhone (cả in_stock + sold)
    const iphoneImportMap = new Map();
    const allIphoneQuery = {
      imei: { $exists: true, $ne: null, $ne: "" }
    };
    if (req.branchFilter) {
      Object.assign(allIphoneQuery, req.branchFilter);
    } else if (req.query.branch && req.query.branch !== 'all') {
      allIphoneQuery.branch = req.query.branch;
    }
    const allIphones = await Inventory.find(allIphoneQuery);
    allIphones.forEach((item) => {
      const uniqueKey = item.sku && item.sku.trim()
        ? item.sku
        : item.product_name || item.tenSanPham || `product_${item._id}`;
      const groupKey = uniqueKey + "|" + (item.product_name || item.tenSanPham || "") + "|" + (item.category || "") + "|" + (item.branch || "");
      iphoneImportMap.set(groupKey, (iphoneImportMap.get(groupKey) || 0) + 1);
    });

    // Gom nhóm
    const iphoneGroupMap = new Map();
    const accessoriesMap = {};
    const imeiItems = [];

    for (const item of inventories) {
      if (item.imei) {
        const uniqueKey = item.sku && item.sku.trim()
          ? item.sku
          : item.product_name || item.tenSanPham || `product_${item._id}`;
        const groupKey = uniqueKey + "|" + (item.product_name || item.tenSanPham || "") + "|" + (item.category || "") + "|" + (item.branch || "");

        if (!iphoneGroupMap.has(groupKey)) {
          iphoneGroupMap.set(groupKey, {
            items: [],
            totalSold: soldCountMap.get(groupKey) || 0,
            totalImport: iphoneImportMap.get(groupKey) || 0
          });
        }
        iphoneGroupMap.get(groupKey).items.push(item);
      } else {
        const importMonth = getImportMonth(item.import_date);
        const key = (item.sku || '') + '|' + (item.product_name || item.tenSanPham || '') + '|' + (item.category || '') + '|' + (item.branch || '');
        if (!accessoriesMap[key]) {
          accessoriesMap[key] = {
            sku: item.sku || "",
            product_name: item.product_name || item.tenSanPham || "",
            tenSanPham: item.product_name || item.tenSanPham || "",
            price_import: item.price_import || 0,
            import_date: item.import_date,
            supplier: item.supplier,
            branch: item.branch,
            category: item.category,
            note: item.note,
            importMonth,
            quantity: 0,
            soLuongConLai: 0,
            totalImport: 0,
            totalSold: soldCountMap.get(key) || 0,
            totalRemain: 0,
            _id: item._id,
          };
        }
        const importQty = Number(item.quantity) || 1;
        accessoriesMap[key].quantity += importQty;
        accessoriesMap[key].totalImport += importQty;
      }
    }

    // Hoàn thiện iPhone
    for (const [groupKey, group] of iphoneGroupMap.entries()) {
      const totalSold = group.totalSold;
      const totalImport = group.totalImport;
      const totalRemain = Math.max(totalImport - totalSold, group.items.length, 0);

      for (const item of group.items) {
        imeiItems.push({
          ...item.toObject(),
          totalSold,
          totalImport,
          totalRemain,
          importMonth: getImportMonth(item.import_date)
        });
      }
    }

    // Hoàn thiện phụ kiện
    for (const key in accessoriesMap) {
      const acc = accessoriesMap[key];
      acc.totalRemain = acc.totalImport - acc.totalSold;
      if (acc.totalSold === 0 && exportMap[acc.sku]) {
        acc.totalRemain = acc.totalImport - (exportMap[acc.sku] || 0);
        }
      if (acc.totalRemain < 0) acc.totalRemain = 0;
      acc.soLuongConLai = acc.totalRemain;
    }

    const accessoriesItems = Object.values(accessoriesMap);

    res.json({
      imeiItems,
      accessoriesItems,
      items: [...imeiItems, ...accessoriesItems]
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy tồn kho:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi lấy tồn kho', error: error.message });
  }
});


// Duplicate route removed (combined above)

// API danh sách xuất hàng  
app.get('/api/xuat-hang-list', authenticateToken, filterByBranch, async (req, res) => {
  try {
    // ✅ Filter theo branch từ middleware
    let query = {};
    if (req.branchFilter) {
      query.branch = req.branchFilter.branch;
    }

    // ✅ Lấy từ ExportHistory thay vì Inventory (vì dữ liệu thực tế ở đây)
    const rawItems = await ExportHistory.find(query)
      .sort({
        sold_date: -1,      // Ưu tiên theo ngày bán (mới nhất trước)
        export_date: -1,    // Hoặc export_date
        updated_at: -1,     // Nếu không có sold_date thì theo updated_at  
        created_at: -1      // Cuối cùng theo created_at
      });

    console.log(`✅ Found ${rawItems.length} export records from ExportHistory (including accessories)`);

    // Debug: Log một sample để check field (chỉ trong development)
    if (rawItems.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('Sample export record fields:', {
        product_name: rawItems[0].product_name,
        imei: rawItems[0].imei || 'No IMEI (accessory)',
        quantity: rawItems[0].quantity, // ✅ Debug quantity field
        sale_price: rawItems[0].sale_price,
        selling_price: rawItems[0].selling_price,
        customer_name: rawItems[0].customer_name,
        customer_phone: rawItems[0].customer_phone,
        sold_date: rawItems[0].sold_date || rawItems[0].export_date,
        all_keys: Object.keys(rawItems[0].toObject())
      });
    }

    // ✅ Đồng bộ trạng thái hoàn trả từ bảng ReturnExport (phòng khi thiếu cờ is_returned)
    let returnedSet = new Set();
    try {
      const ids = rawItems.map(i => i._id).filter(Boolean);
      if (ids.length > 0) {
        const returns = await ReturnExport.find({ original_export_id: { $in: ids } });
        returnedSet = new Set(returns.map(r => String(r.original_export_id)));
      }
    } catch (e) { /* ignore */ }

    // ✅ FIX: Flexible field mapping để support nhiều field name khác nhau  
    const items = rawItems.map(item => ({
      _id: item._id,
      sale_date: item.sold_date || item.createdAt,
      // ✅ Cải tiến mapping field giá bán - check nhiều field
      sale_price: item.price_sell || item.giaBan || item.sale_price || 0,
      price_sell: item.price_sell || item.giaBan || 0, // Backup field
      buyer_name: item.customer_name || item.buyer_name || '',
      buyer_phone: item.customer_phone || item.buyer_phone || '',
      branch: item.branch || '',
      note: item.note || '',
      source: item.source || 'tien_mat',
      warranty: item.warranty || '',
      // ✅ Thêm các field quan trọng khác  
      price_import: item.price_import || item.giaNhap || 0,
      profit: (item.price_sell || item.giaBan || 0) - (item.price_import || item.giaNhap || 0),
      // ✅ REMOVED: debt field - tính công nợ bằng price_sell - da_thanh_toan
      da_thanh_toan: item.da_thanh_toan || 0, // ✅ THÊM FIELD ĐÃ THANH TOÁN
      quantity: item.quantity || 1, // ✅ THÊM FIELD SỐ LƯỢNG - QUAN TRỌNG!
      batch_id: item.batch_id || null,
      imei: item.imei || '',
      sku: item.sku || '',
      product_name: item.product_name || item.tenSanPham || '',
      customer_name: item.customer_name || '',
      customer_phone: item.customer_phone || '',
      // Flag hoàn trả để UI disable nút trả hàng (kể cả khi thiếu cờ ở ExportHistory)
      is_returned: !!(item.is_returned) || returnedSet.has(String(item._id)),
      return_id: item.return_id || null,
      item: {
        _id: item._id,
        product_name: item.product_name || item.tenSanPham,
        tenSanPham: item.tenSanPham || item.product_name,
        imei: item.imei || '',
        sku: item.sku || '',
        category: item.category || '',
      }
    }));

    res.status(200).json({
      message: '✅ Danh sách xuất hàng',
      total: items.length,
      items
    });
  } catch (error) {
    console.error('❌ Lỗi API xuat-hang-list:', error);
    res.status(500).json({ message: '❌ Lỗi lấy danh sách xuất hàng', error: error.message });
  }
});

// API sửa xuất hàng - ĐƠN GIẢN HÓA THEO CÁCH NHẬP HÀNG
app.put('/api/xuat-hang/:id', authenticateToken, requireBranch, async (req, res) => {
  try {
    console.log('🔄 PUT Request data:', req.body); // Debug
    console.log('🔍 PUT Request ID:', req.params.id); // Debug
    console.log('🔍 DEBUG da_thanh_toan in req.body:', req.body.da_thanh_toan); // Debug specific field

    // Kiểm tra record tồn tại trước khi cập nhật
    const existingRecord = await ExportHistory.findById(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ message: '❌ Không tìm thấy đơn xuất để cập nhật.' });
    }

    console.log('📋 Existing record before update:', {
      _id: existingRecord._id,
      da_thanh_toan: existingRecord.da_thanh_toan,
      quantity: existingRecord.quantity,
      customer_name: existingRecord.customer_name
    });

    // ✅ Xử lý da_thanh_toan: không tự động tính khi edit
    const updateData = { ...req.body };
    if (updateData.da_thanh_toan === undefined || updateData.da_thanh_toan === "") {
      updateData.da_thanh_toan = existingRecord.da_thanh_toan || 0; // Giữ nguyên giá trị cũ
    } else {
      updateData.da_thanh_toan = parseFloat(updateData.da_thanh_toan) || 0;
    }

    // ✅ Đảm bảo quantity được cập nhật
    if (updateData.quantity) {
      updateData.quantity = parseInt(updateData.quantity) || 1;
    }

    const updatedItem = await ExportHistory.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    console.log('✅ Updated successfully:', {
      _id: updatedItem._id,
      da_thanh_toan: updatedItem.da_thanh_toan,
      quantity: updatedItem.quantity,
      price_sell: updatedItem.price_sell,
      customer_name: updatedItem.customer_name
    }); // Debug

    res.status(200).json({
      message: '✅ Cập nhật thành công!',
      item: updatedItem,
    });
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật xuất hàng:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi cập nhật', error: error.message });
  }
});

app.delete('/api/xuat-hang/:id', authenticateToken, requireBranch, async (req, res) => {
  try {
    // ✅ Xóa từ ExportHistory
    const exportRecord = await ExportHistory.findById(req.params.id);
    if (!exportRecord) {
      return res.status(404).json({ message: '❌ Không tìm thấy đơn xuất hàng.' });
    }

    // Nếu có IMEI, khôi phục Inventory về in_stock
    if (exportRecord.imei) {
      const inventoryItem = await Inventory.findOne({ imei: exportRecord.imei });
      if (inventoryItem) {
        inventoryItem.status = 'in_stock';
        inventoryItem.sold_date = undefined;
        await inventoryItem.save();
      }
    }

    // ✅ Nếu là phụ kiện, CỘNG lại số lượng trong Inventory (logic đơn giản)
    if (!exportRecord.imei && exportRecord.sku) {
      const inventoryItem = await Inventory.findOne({
        sku: exportRecord.sku,
        status: { $in: ['in_stock', 'sold'] }
      });
      if (inventoryItem) {
        const returnQuantity = exportRecord.quantity || 1;
        inventoryItem.quantity = (inventoryItem.quantity || 0) + returnQuantity;
        inventoryItem.status = 'in_stock';
        await inventoryItem.save();
        console.log(`✅ Đã cộng lại ${returnQuantity} vào inventory cho SKU: ${exportRecord.sku}`);
      }
    }

    // Xóa record khỏi ExportHistory
    await ExportHistory.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: '✅ Đã xóa đơn xuất hàng và khôi phục tồn kho!', item: exportRecord });
  } catch (error) {
    res.status(500).json({ message: '❌ Lỗi khi xóa đơn xuất', error: error.message });
  }
});

// === API TRẢ NỢ NHÀ CUNG CẤP (ghi chi vào sổ quỹ) ===
app.post('/api/tra-no-ncc', authenticateToken, requireBranch, async (req, res) => {
  try {
    const { supplier, amount, date, branch, source, note } = req.body;
    const execUser = req.user?.username || 'Admin';
    await Cashbook.create({
      type: 'chi',
      amount: Number(amount),
      content: `Trả nợ nhà cung cấp: ${supplier}`,
      note: note || '',
      date: date || new Date(),
      branch: branch || '',
      source: source || 'Tiền mặt',
      supplier: supplier || ''
    });
    res.status(201).json({ message: '✅ Đã ghi nhận trả nợ nhà cung cấp!' });
  } catch (error) {
    res.status(500).json({ message: '❌ Lỗi khi ghi sổ trả nợ', error: error.message });
  }
});

// === API THU NỢ KHÁCH HÀNG (ghi thu vào sổ quỹ) ===
app.post('/api/thu-no-khach', authenticateToken, requireBranch, async (req, res) => {
  try {
    const { customer, amount, date, branch, source, note } = req.body;
    const execUser = req.user?.username || 'Admin';
    await Cashbook.create({
      type: 'thu',
      amount: Number(amount),
      content: `Thu nợ khách: ${customer}`,
      note: note || '',
      date: date || new Date(),
      branch: branch || '',
      source: source || 'Tiền mặt',
      customer: customer || ''
    });
    res.status(201).json({ message: '✅ Đã ghi nhận thu nợ khách hàng!' });
  } catch (error) {
    res.status(500).json({ message: '❌ Lỗi khi ghi sổ thu nợ', error: error.message });
  }
});



// ✅ Cải thiện kết nối MongoDB với options để xử lý lỗi tốt hơn
const mongooseOptions = {
  maxPoolSize: 10, // Giới hạn số connection pool
  serverSelectionTimeoutMS: 5000, // Timeout khi chọn server
  socketTimeoutMS: 45000, // Timeout cho socket operations
  family: 4, // Sử dụng IPv4
  retryWrites: true,
  retryReads: true,
};

mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
  .then(async () => {
    console.log('✅ Kết nối MongoDB thành công');
    console.log('🔧 MongoDB connection options:', mongooseOptions);
    console.log('🔧 [MONGODB] Checking models...');

    // Kiểm tra models có hoạt động không
    try {
      await ReturnImport.init();
      console.log('✅ [MONGODB] ReturnImport model initialized');
    } catch (error) {
      console.error('❌ [MONGODB] ReturnImport model error:', error.message);
    }

    try {
      await ReturnExport.init();
      console.log('✅ [MONGODB] ReturnExport model initialized');
    } catch (error) {
      console.error('❌ [MONGODB] ReturnExport model error:', error.message);
    }

    try {
      await User.init();
      console.log('✅ [MONGODB] User model initialized');
    } catch (error) {
      console.error('❌ [MONGODB] User model error:', error.message);
    }

    try {
      await Branch.init();
      console.log('✅ [MONGODB] Branch model initialized');
    } catch (error) {
      console.error('❌ [MONGODB] Branch model error:', error.message);
    }

    // Tự động tạo admin user nếu chưa có
    const initAdminModule = await import('./scripts/init-admin.js');
    const { createDefaultAdmin } = initAdminModule;
    await createDefaultAdmin();
  })
  .catch(err => {
    console.error('❌ Kết nối MongoDB lỗi:', err);
    console.error('❌ MongoDB Error Details:', {
      message: err.message,
      name: err.name,
      code: err.code,
      codeName: err.codeName,
      connectionString: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/.*@/, '//****:****@') : 'not set'
    });
    // Không exit process để có thể retry hoặc handle gracefully
  });

app.get('/', (req, res) => {
  res.send('🎉 Backend đang chạy!');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test endpoint for user creation

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  });
}
