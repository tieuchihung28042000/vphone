const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Inventory = require('./models/Inventory');
const Cashbook = require('./models/Cashbook'); // THÊM DÒNG NÀY
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
      source // Nguồn tiền: Tiền mặt/Thẻ/Công nợ (từ frontend)
    } = req.body;

    if (imei) {
      const exists = await Inventory.findOne({ imei });
      if (exists) {
        return res.status(400).json({ message: '❌ IMEI này đã tồn tại trong kho.' });
      }
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
      });
      await newItem.save();

      // --- Ghi SỔ QUỸ ---
      await Cashbook.create({
        type: 'chi',
        amount: price_import * 1,
        content: `Nhập hàng: ${product_name} (IMEI: ${imei})`,
        note: note || '',
        date: import_date || new Date(),
        branch,
        source: source || 'Tiền mặt',
        supplier: supplier || '',
        related_id: newItem._id,
      });

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
      existItem.quantity = (existItem.quantity || 1) + Number(quantity || 1);
      existItem.import_date = import_date || existItem.import_date;
      existItem.supplier = supplier || existItem.supplier;
      existItem.note = note || existItem.note;
      await existItem.save();
      return res.status(200).json({
        message: '✅ Đã cộng dồn số lượng phụ kiện!',
        item: existItem,
      });
    } else {
      const newItem = new Inventory({
        sku,
        price_import,
        product_name,
        tenSanPham: product_name,
        import_date,
        supplier,
        branch,
        note,
        quantity: Number(quantity || 1),
        category,
      });
      await newItem.save();

      // --- Ghi SỔ QUỸ ---
      await Cashbook.create({
        type: 'chi',
        amount: price_import * Number(quantity || 1),
        content: `Nhập phụ kiện: ${product_name}`,
        note: note || '',
        date: import_date || new Date(),
        branch,
        source: source || 'Tiền mặt',
        supplier: supplier || '',
        related_id: newItem._id,
      });

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
      debt,
      branch,
      source // Nguồn tiền (frontend truyền lên)
    } = req.body;

    const item = await Inventory.findOne({ imei });
    if (!item) {
      return res.status(404).json({ message: '❌ Không tìm thấy IMEI trong kho.' });
    }

    if (item.status === 'sold') {
      return res.status(400).json({ message: '⚠️ Máy này đã được bán trước đó.' });
    }

    item.status = 'sold';
    item.giaBan = price_sell;
    item.price_sell = price_sell;
    item.sold_date = sold_date ? new Date(sold_date) : new Date();
    item.customer_name = customer_name || '';
    item.customer_phone = customer_phone || '';
    item.warranty = warranty || '';
    item.note = note || '';
    item.sku = sku || item.sku;
    item.product_name = product_name || item.product_name;
    item.branch = branch || item.branch;

    if (debt !== undefined && debt !== null && debt !== "") {
      item.debt = Number(debt);
      item.da_tra = Number(item.price_sell) - Number(debt);
    } else {
      item.debt = 0;
      item.da_tra = Number(item.price_sell);
    }

    await item.save();

    const profit = (item.giaBan || 0) - (item.price_import || 0);

    // --- Ghi SỔ QUỸ: THU TIỀN ---
    await Cashbook.create({
      type: 'thu',
      amount: Number(item.da_tra),
      content: `Bán hàng: ${item.product_name} (IMEI: ${item.imei})`,
      note: note || '',
      date: sold_date || new Date(),
      branch: branch || '',
      source: source || 'Tiền mặt',
      customer: customer_name || '',
      related_id: item._id
    });

    // Nếu có công nợ thì ghi sổ công nợ khách
    if (item.debt && item.debt > 0) {
      await Cashbook.create({
        type: 'thu',
        amount: Number(item.debt),
        content: `Công nợ khách hàng khi bán: ${item.product_name} (IMEI: ${item.imei})`,
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
    const rawItems = await Inventory.find({ status: 'sold' }).sort({ sold_date: -1 });
    
    // Debug: Log một sample để check field
    if (rawItems.length > 0) {
      console.log('Sample sold item fields:', {
        price_sell: rawItems[0].price_sell,
        giaBan: rawItems[0].giaBan,
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
      debt: item.debt || 0,
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

app.put('/api/xuat-hang/:id', async (req, res) => {
  try {
    const {
      imei,
      sku,
      product_name,
      price_sell,
      customer_name,
      customer_phone,
      warranty,
      note,
      branch,
      sold_date,
      source,
      debt
    } = req.body;

    console.log('PUT Request data:', req.body); // Debug

    // ✅ Proper field mapping để consistent với POST API
    const updateFields = {
      status: 'sold',
      // Price fields - map to both formats for consistency
      price_sell: parseFloat(price_sell) || 0,
      giaBan: parseFloat(price_sell) || 0,
      // Customer info
      customer_name: customer_name || '',
      customer_phone: customer_phone || '',
      // Product info  
      product_name: product_name || '',
      sku: sku || '',
      imei: imei || '',
      // Other fields
      warranty: warranty || '',
      note: note || '',
      branch: branch || '',
      source: source || 'tien_mat',
      sold_date: sold_date ? new Date(sold_date) : new Date(),
      debt: parseFloat(debt) || 0,
      // Update timestamp
      updatedAt: new Date()
    };

    // Remove undefined/empty fields
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] === undefined || updateFields[key] === '') {
        delete updateFields[key];
      }
    });

    console.log('Processed update fields:', updateFields); // Debug

    const updated = await Inventory.findByIdAndUpdate(
      req.params.id, 
      { $set: updateFields }, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: '❌ Không tìm thấy đơn xuất để cập nhật.' });
    }

    console.log('Updated item price fields:', updated.price_sell, updated.giaBan); // Debug

    res.status(200).json({ 
      message: '✅ Đã cập nhật đơn xuất thành công!', 
      item: updated 
    });
  } catch (error) {
    console.error('❌ Error updating xuat-hang:', error);
    res.status(500).json({ message: '❌ Lỗi khi cập nhật đơn xuất', error: error.message });
  }
});

app.delete('/api/xuat-hang/:id', async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item || item.status !== 'sold') {
      return res.status(404).json({ message: '❌ Không tìm thấy đơn xuất hàng.' });
    }

    item.status = 'in_stock';
    item.giaBan = undefined;
    item.price_sell = undefined;
    item.sold_date = undefined;
    item.customer_name = undefined;
    item.customer_phone = undefined;
    item.warranty = undefined;
    item.note = undefined;
    item.debt = 0;
    item.da_tra = 0;

    await item.save();

    res.status(200).json({ message: '✅ Đã chuyển máy về tồn kho!', item });
  } catch (error) {
    res.status(500).json({ message: '❌ Lỗi khi xoá đơn xuất', error: error.message });
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

mongoose.connect(process.env.MONGODB_URI)
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
