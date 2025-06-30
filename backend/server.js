const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Inventory = require('./models/Inventory');
const Cashbook = require('./models/Cashbook'); // THÊM DÒNG NÀY
const ExportHistory = require('./models/ExportHistory'); // THÊM MODEL EXPORT HISTORY
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const reportRoutes = require('./routes/report');
const branchRoutes = require('./routes/branch');
const categoryRoutes = require('./routes/category');
const congNoRoutes = require('./routes/congno');
const adminRoutes = require('./routes/admin');
const cashbookRoutes = require('./routes/cashbook'); // THÊM DÒNG NÀY

const app = express();

// Danh sách origin frontend được phép truy cập API backend
const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:80',
  'https://chinhthuc-jade.vercel.app',
  'http://app.vphone.vn',
  'https://app.vphone.vn',
  'http://103.109.187.224',
  'https://103.109.187.224',
];

app.use(cors({
  origin: function(origin, callback) {
    // Cho phép các request không có origin (Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    // Kiểm tra nếu origin trong danh sách cho phép
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Cho phép IP addresses trong production (VPS)
    if (origin && origin.match(/^https?:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/)) {
      console.log('✅ CORS cho phép IP:', origin);
      return callback(null, true);
    }
    
    // Trong development, cho phép tất cả origins
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️ CORS dev mode - allowing origin:', origin);
      return callback(null, true);
    }
    
    console.log('❌ CORS bị chặn origin:', origin);
    const msg = '❌ CORS bị chặn: ' + origin;
    return callback(new Error(msg), false);
  },
  credentials: true,
}));

app.options('*', cors());
app.use(express.json());

// ==== Đăng ký các route API ====
app.use('/api', adminRoutes);
app.use('/api', reportRoutes); // ĐÃ SỬA, đặt đúng path
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cong-no', congNoRoutes);
app.use('/api/cashbook', cashbookRoutes); // ROUTE SỔ QUỸ

// ==================== API: SUPER DEBUG BACKEND ====================
app.get('/api/super-debug/:id', async (req, res) => {
  try {
    const id = req.params.id;
    console.log('🔍 BACKEND SUPER DEBUG for ID:', id);
    
    // Test trong Inventory
    const inventoryItem = await Inventory.findById(id);
    console.log('📦 Backend Inventory result:', inventoryItem ? {
      _id: inventoryItem._id,
      product_name: inventoryItem.product_name,
      status: inventoryItem.status,
      price_sell: inventoryItem.price_sell,
      giaBan: inventoryItem.giaBan
    } : 'NOT FOUND');
    
    // Test trong ExportHistory  
    let exportItem = null;
    try {
      exportItem = await ExportHistory.findById(id);
      console.log('📋 Backend ExportHistory result:', exportItem ? {
        _id: exportItem._id,
        product_name: exportItem.product_name,
        price_sell: exportItem.price_sell
      } : 'NOT FOUND');
    } catch (err) {
      console.log('📋 ExportHistory model error:', err.message);
    }
    
    // Đếm records
    const inventoryCount = await Inventory.countDocuments();
    const soldCount = await Inventory.countDocuments({ status: 'sold' });
    
    res.status(200).json({
      message: '🔍 BACKEND SUPER DEBUG RESULTS',
      test_id: id,
      inventory_item: inventoryItem ? {
        found: true,
        _id: inventoryItem._id,
        product_name: inventoryItem.product_name,
        status: inventoryItem.status,
        price_sell: inventoryItem.price_sell,
        giaBan: inventoryItem.giaBan
      } : { found: false },
      export_history_item: exportItem ? {
        found: true,
        _id: exportItem._id,
        product_name: exportItem.product_name,
        price_sell: exportItem.price_sell
      } : { found: false },
      collections_stats: {
        total_inventory: inventoryCount,
        inventory_sold: soldCount
      }
    });
  } catch (error) {
    console.error('❌ Backend super debug error:', error);
    res.status(500).json({ message: '❌ Backend super debug failed', error: error.message });
  }
});

// ==================== API: SIMPLE UPDATE TEST ====================
app.put('/api/test-update/:id', async (req, res) => {
  try {
    console.log('🧪 SIMPLE UPDATE TEST for ID:', req.params.id);
    console.log('🧪 Request body:', req.body);
    
    // Đơn giản: chỉ update 1 field
    const updated = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $set: { note: 'TEST UPDATE WORKED', updatedAt: new Date() } },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: '❌ Test update failed - record not found' });
    }
    
    res.status(200).json({
      message: '✅ TEST UPDATE SUCCESS!',
      updated_fields: {
        _id: updated._id,
        note: updated.note,
        product_name: updated.product_name,
        status: updated.status
      }
    });
  } catch (error) {
    console.error('❌ Test update error:', error);
    res.status(500).json({ message: '❌ Test update failed', error: error.message });
  }
});

// API lấy danh sách nhập hàng
app.get('/api/nhap-hang', async (req, res) => {
  try {
    const items = await Inventory.find().sort({ import_date: -1, _id: -1 });
    res.status(200).json({ items });
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách nhập hàng:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi lấy danh sách', error: error.message });
  }
});

// API nhập hàng (tích hợp ghi sổ quỹ)
app.post('/api/nhap-hang', async (req, res) => {
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
      da_thanh_toan_nhap // Số tiền đã thanh toán cho nhà cung cấp
    } = req.body;

    if (imei) {
      const exists = await Inventory.findOne({ imei });
      if (exists) {
        return res.status(400).json({ message: '❌ IMEI này đã tồn tại trong kho.' });
      }
      // Tính toán đã thanh toán
      const daTTNhapNum = Number(da_thanh_toan_nhap) || 0;
      
      const newItem = new Inventory({
        imei,
        sku,
        price_import,
        product_name,
        tenSanPham: product_name,
        import_date,
        supplier,
        branch,
        note,
        quantity: 1,
        category,
        da_thanh_toan_nhap: daTTNhapNum, // Đã thanh toán cho nhà cung cấp
      });
      await newItem.save();

      // --- Ghi SỔ QUỸ: chỉ ghi số tiền đã thanh toán thực tế ---
      if (daTTNhapNum > 0) {
        await Cashbook.create({
          type: 'chi',
          amount: daTTNhapNum,
          content: `Nhập hàng: ${product_name} (IMEI: ${imei})`,
          note: note || '',
          date: import_date || new Date(),
          branch,
          source: source || 'Tiền mặt',
          supplier: supplier || '',
          related_id: newItem._id,
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

    let existItem = await Inventory.findOne({
      $or: [{ imei: null }, { imei: "" }, { imei: undefined }],
      sku: sku,
      branch: branch,
      product_name: product_name,
      price_import: price_import,
      category: category,
    });

    if (existItem) {
      // Cập nhật số lượng
      const daTTNhapNum = Number(da_thanh_toan_nhap) || 0;
      
      existItem.quantity = (existItem.quantity || 1) + Number(quantity || 1);
      existItem.import_date = import_date || existItem.import_date;
      existItem.supplier = supplier || existItem.supplier;
      existItem.note = note || existItem.note;
      existItem.da_thanh_toan_nhap = (existItem.da_thanh_toan_nhap || 0) + daTTNhapNum;
      await existItem.save();
      return res.status(200).json({
        message: '✅ Đã cộng dồn số lượng phụ kiện!',
        item: existItem,
      });
    } else {
      // Tính toán cho phụ kiện mới
      const daTTNhapNum = Number(da_thanh_toan_nhap) || 0;
      const quantityNum = Number(quantity || 1);
      
      const newItem = new Inventory({
        sku,
        price_import,
        product_name,
        tenSanPham: product_name,
        import_date,
        supplier,
        branch,
        note,
        quantity: quantityNum,
        category,
        da_thanh_toan_nhap: daTTNhapNum, // Đã thanh toán cho nhà cung cấp
      });
      await newItem.save();

      // --- Ghi SỔ QUỸ: chỉ ghi số tiền đã thanh toán thực tế ---
      if (daTTNhapNum > 0) {
        await Cashbook.create({
          type: 'chi',
          amount: daTTNhapNum,
          content: `Nhập phụ kiện: ${product_name}`,
          note: note || '',
          date: import_date || new Date(),
          branch,
          source: source || 'Tiền mặt',
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
app.put('/api/nhap-hang/:id', async (req, res) => {
  try {
    const updatedItem = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );

    if (!updatedItem) {
      return res.status(404).json({ message: '❌ Không tìm thấy sản phẩm để cập nhật.' });
    }

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
app.delete('/api/nhap-hang/:id', async (req, res) => {
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
app.post('/api/xuat-hang', async (req, res) => {
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
      // debt, // ✅ REMOVED: Không dùng field debt nữa
      da_thanh_toan, // Số tiền đã thanh toán
      branch,
      source, // Nguồn tiền (frontend truyền lên)
      is_accessory,
      quantity // Số lượng (cho phụ kiện)
    } = req.body;

    let item;
    
    // ✅ Xử lý phụ kiện và sản phẩm có IMEI khác nhau
    if (is_accessory || !imei) {
      // Phụ kiện: tìm theo SKU và product_name, status in_stock
      const query = {
        status: 'in_stock',
        $or: [
          { sku: sku },
          { product_name: product_name },
          { tenSanPham: product_name }
        ]
      };
      
      const availableItems = await Inventory.find(query);
      
      if (availableItems.length === 0) {
        return res.status(404).json({ message: '❌ Không tìm thấy phụ kiện trong kho.' });
      }
      
      // Lấy item đầu tiên có số lượng > 0
      item = availableItems.find(i => (i.quantity || 0) > 0) || availableItems[0];
      
      if (!item) {
        return res.status(404).json({ message: '❌ Phụ kiện đã hết hàng.' });
      }
      
      // Kiểm tra số lượng
      const currentQuantity = item.quantity || 0;
      const sellQuantity = parseInt(quantity) || 1;
      
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
      // Phụ kiện: giảm số lượng, không đổi status
      const sellQuantity = parseInt(quantity) || 1;
      item.quantity = (item.quantity || 0) - sellQuantity;
      
      // Nếu hết hàng thì chuyển status
      if (item.quantity <= 0) {
        item.status = 'sold';
        item.quantity = 0;
      }
      
      // ✅ Ghi vào ExportHistory thay vì Inventory
      const priceSellNum = Number(price_sell) || 0;
      const daTTNum = Number(da_thanh_toan) || 0;
      // ✅ REMOVED: autoDebt không cần thiết nữa
      
      const soldAccessory = new ExportHistory({
        imei: '', // Phụ kiện không có IMEI
        sku: item.sku,
        product_name: item.product_name,
        tenSanPham: item.tenSanPham,
        category: item.category,
        price_import: item.price_import,
        giaBan: price_sell,
        price_sell: price_sell,
        da_thanh_toan: daTTNum, // Số tiền đã thanh toán
        // ✅ REMOVED: debt field - tính công nợ bằng price_sell - da_thanh_toan
        sold_date: sold_date ? new Date(sold_date) : new Date(),
        customer_name: customer_name || '',
        customer_phone: customer_phone || '',
        warranty: warranty || '',
        note: note || '',
        branch: branch || item.branch,
        source: source || 'tien_mat',
        status: 'sold',
        quantity: sellQuantity,
        is_accessory: true
      });
      
      await soldAccessory.save();
      await item.save();
      
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
      const daTTNum = Number(da_thanh_toan) || 0;
      // ✅ REMOVED: autoDebt không cần thiết nữa
      
      const soldItem = new ExportHistory({
        imei: item.imei,
        sku: sku || item.sku,
        product_name: product_name || item.product_name,
        category: item.category,
        price_import: item.price_import,
        price_sell: price_sell,
        da_thanh_toan: daTTNum, // Số tiền đã thanh toán
        // ✅ REMOVED: debt field - tính công nợ bằng price_sell - da_thanh_toan
        sold_date: sold_date ? new Date(sold_date) : new Date(),
        customer_name: customer_name || '',
        customer_phone: customer_phone || '',
        warranty: warranty || '',
        note: note || '',
        branch: branch || item.branch,
        export_type: 'normal'
      });
      
      await soldItem.save();
      
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
        source: source || 'Tiền mặt',
        customer: customer_name || '',
        related_id: item._id
      });
    }

    // ✅ REMOVED: Không dùng field debt nữa, tính công nợ bằng price_sell - da_thanh_toan
    // Nếu có công nợ thì ghi sổ công nợ khách
    const congNo = Math.max((item.price_sell || 0) - (item.da_thanh_toan || 0), 0);
    if (congNo > 0) {
      await Cashbook.create({
        type: 'thu',
        amount: congNo,
        content: `Công nợ khách hàng khi bán: ${productDescription}`,
        note: `Công nợ khách: ${customer_name}`,
        date: sold_date || new Date(),
        branch: branch || '',
        source: 'Công nợ',
        customer: customer_name || '',
        related_id: item._id
      });
    }

    res.status(200).json({ message: '✅ Xuất hàng thành công!', item, profit });
  } catch (error) {
    console.error('❌ Lỗi khi xuất hàng:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi xuất hàng', error: error.message });
  }
});

// API chi tiết IMEI
app.get('/api/imei-detail/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    const item = await Inventory.findOne({ imei });
    
    if (!item) {
      return res.status(404).json({ message: '❌ Không tìm thấy IMEI này' });
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

// API tồn kho
app.get('/api/ton-kho', async (req, res) => {
  try {
    const items = await Inventory.find({ status: 'in_stock' });

    res.status(200).json({
      message: '✅ Danh sách máy còn tồn kho',
      total: items.length,
      items,
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy tồn kho:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi lấy tồn kho', error: error.message });
  }
});

// API cảnh báo tồn kho
app.get('/api/canh-bao-ton-kho', async (req, res) => {
  try {
    const items = await Inventory.find({ status: 'in_stock' });

    const grouped = {};
    items.forEach((item) => {
      const key = item.sku + (item.branch || '');
      if (!grouped[key]) {
        grouped[key] = {
          sku: item.sku || 'Không rõ',
          tenSanPham: item.tenSanPham || item.product_name || 'Không rõ',
          branch: item.branch || 'Mặc định',
          totalImport: 0,
          imeis: [],
        };
      }

      grouped[key].totalImport += 1;
      grouped[key].imeis.push(item.imei);
    });

    const result = Object.values(grouped)
      .map((g) => ({
        ...g,
        totalRemain: g.imeis.length,
      }))
      .filter((g) => g.totalRemain < 2);

    res.status(200).json({
      message: '✅ Danh sách hàng tồn kho thấp (dưới 2)',
      total: result.length,
      items: result,
    });
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách cảnh báo tồn kho:', error.message);
    res.status(500).json({ message: '❌ Lỗi server khi xử lý cảnh báo tồn kho', error: error.message });
  }
});

// API danh sách xuất hàng  
app.get('/api/xuat-hang-list', async (req, res) => {
  try {
    // ✅ Lấy từ ExportHistory thay vì Inventory (vì dữ liệu thực tế ở đây)
    const rawItems = await ExportHistory.find({})
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
        sale_price: rawItems[0].sale_price,
        selling_price: rawItems[0].selling_price,
        customer_name: rawItems[0].customer_name,
        customer_phone: rawItems[0].customer_phone,
        sold_date: rawItems[0].sold_date || rawItems[0].export_date,
        all_keys: Object.keys(rawItems[0].toObject())
      });
    }
    
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
      imei: item.imei || '',
      sku: item.sku || '',
      product_name: item.product_name || item.tenSanPham || '',
      customer_name: item.customer_name || '',
      customer_phone: item.customer_phone || '',
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
app.put('/api/xuat-hang/:id', async (req, res) => {
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
      customer_name: existingRecord.customer_name
    });

    const updatedItem = await ExportHistory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    console.log('✅ Updated successfully:', {
      _id: updatedItem._id,
      da_thanh_toan: updatedItem.da_thanh_toan,
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

app.delete('/api/xuat-hang/:id', async (req, res) => {
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
    
    // Nếu là phụ kiện, tăng lại số lượng trong Inventory
    if (!exportRecord.imei && exportRecord.sku) {
      const inventoryItem = await Inventory.findOne({ 
        sku: exportRecord.sku, 
        status: { $in: ['in_stock', 'sold'] }
      });
      if (inventoryItem) {
        inventoryItem.quantity = (inventoryItem.quantity || 0) + 1;
        inventoryItem.status = 'in_stock';
        await inventoryItem.save();
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
app.post('/api/tra-no-ncc', async (req, res) => {
  try {
    const { supplier, amount, date, branch, source, note } = req.body;
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
app.post('/api/thu-no-khach', async (req, res) => {
  try {
    const { customer, amount, date, branch, source, note } = req.body;
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



mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vphone')
.then(() => console.log('✅ Kết nối MongoDB thành công'))
.catch(err => console.error('❌ Kết nối MongoDB lỗi:', err));

app.get('/', (req, res) => {
  res.send('🎉 Backend đang chạy!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
