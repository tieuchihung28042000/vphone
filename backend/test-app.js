import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

// Load environment variables from root .env
import './load-env.js';

// Import models
import Inventory from './models/Inventory.js';
import Cashbook from './models/Cashbook.js';
import ExportHistory from './models/ExportHistory.js';
import ReturnImport from './models/ReturnImport.js';
import ReturnExport from './models/ReturnExport.js';
import User from './models/User.js';
import Branch from './models/Branch.js';
import ActivityLog from './models/ActivityLog.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import reportRoutes from './routes/report.js';
import reportBatchRoutes from './routes/reportBatch.js';
import branchRoutes from './routes/branch.js';
import categoryRoutes from './routes/category.js';
import inventoryRoutes from './routes/inventory.js';
import cashbookRoutes from './routes/cashbook.js';
import congnoRoutes from './routes/congno.js';
import returnImportRoutes from './routes/returnImport.js';
import returnExportRoutes from './routes/returnExport.js';
import activityLogRoutes from './routes/activityLog.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/report-batch', reportBatchRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/cashbook', cashbookRoutes);
app.use('/api/cong-no', congnoRoutes);
app.use('/api/return-import', returnImportRoutes);
app.use('/api/return-export', returnExportRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// Import middleware
import { authenticateToken, requireRole, filterByBranch } from './middleware/auth.js';

// Add missing routes from server.js
// GET /api/nhap-hang
app.get('/api/nhap-hang', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, branch } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { product_name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { imei: { $regex: search, $options: 'i' } },
      ];
    }

    if (branch) {
      query.branch = branch;
    }

    // Apply branch filter from middleware
    if (req.user.role !== 'admin' && req.user.branch_id) {
      query.branch_id = req.user.branch_id;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
    };

    const result = await Inventory.paginate(query, options);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/nhap-hang
app.post('/api/nhap-hang', authenticateToken, requireRole(['admin', 'quan_ly', 'thu_ngan']), async (req, res) => {
  try {
    const { 
      product_name, 
      sku, 
      imei, 
      price_buy, 
      price_sell, 
      category, 
      branch, 
      supplier, 
      note,
      payments = []
    } = req.body;

    // Validate required fields
    if (!product_name || !price_buy || !price_sell) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    // Create inventory item
    const inventoryItem = new Inventory({
      product_name,
      sku,
      imei,
      price_import: price_buy,
      price_sell,
      category,
      branch,
      supplier,
      note,
      status: 'in_stock',
      import_date: new Date(),
      branch_id: req.user.branch_id || branch
    });

    await inventoryItem.save();

    // Create cashbook entries for payments
    if (payments && payments.length > 0) {
      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      
      for (const payment of payments) {
        const cashbookEntry = new Cashbook({
          date: new Date(),
          content: `Nhập hàng: ${product_name}`,
          amount: payment.amount,
          type: 'chi',
          source: payment.source,
          branch: branch,
          user_id: req.user.id
        });
        await cashbookEntry.save();
      }

      // Create debt entry if not fully paid
      if (totalPaid < price_buy) {
        const debtAmount = price_buy - totalPaid;
        const debtEntry = new Cashbook({
          date: new Date(),
          content: `Công nợ nhập hàng: ${product_name}`,
          amount: debtAmount,
          type: 'chi',
          source: 'cong_no',
          branch: branch,
          user_id: req.user.id
        });
        await debtEntry.save();
      }
    }

    // Create activity log
    await ActivityLog.create({
      user_id: req.user.id,
      username: req.user.email,
      action: 'create',
      module: 'inventory',
      details: `Tạo mới sản phẩm: ${product_name}`,
      branch_id: req.user.branch_id || branch,
      timestamp: new Date()
    });

    res.status(201).json({ 
      message: 'Nhập hàng thành công',
      data: inventoryItem 
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/xuat-hang
app.post('/api/xuat-hang', authenticateToken, requireRole(['admin', 'quan_ly', 'thu_ngan', 'ban_hang']), async (req, res) => {
  try {
    const { 
      product_id, 
      sale_price, 
      buyer_name, 
      buyer_phone, 
      sale_date, 
      warranty, 
      note,
      payments = []
    } = req.body;

    // Validate required fields
    if (!product_id || !sale_price) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    // Find and update inventory item
    const inventoryItem = await Inventory.findById(product_id);
    if (!inventoryItem) {
      return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    }

    if (inventoryItem.status === 'sold') {
      return res.status(400).json({ message: 'Sản phẩm đã được bán' });
    }

    // Update inventory item
    inventoryItem.status = 'sold';
    inventoryItem.sale_price = sale_price;
    inventoryItem.buyer_name = buyer_name;
    inventoryItem.buyer_phone = buyer_phone;
    inventoryItem.sale_date = sale_date || new Date();
    inventoryItem.warranty = warranty;
    inventoryItem.note = note;
    await inventoryItem.save();

    // Create export history
    const exportHistory = new ExportHistory({
      product_id: inventoryItem._id,
      product_name: inventoryItem.product_name,
      sku: inventoryItem.sku,
      imei: inventoryItem.imei,
      price_buy: inventoryItem.price_buy,
      price_sell: sale_price,
      buyer_name,
      buyer_phone,
      sale_date: sale_date || new Date(),
      warranty,
      note,
      branch_id: req.user.branch_id || inventoryItem.branch_id
    });
    await exportHistory.save();

    // Create cashbook entries for payments
    if (payments && payments.length > 0) {
      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      
      for (const payment of payments) {
        const cashbookEntry = new Cashbook({
          date: new Date(),
          content: `Bán hàng: ${inventoryItem.product_name}`,
          amount: payment.amount,
          type: 'income',
          source: payment.source,
          branch_id: req.user.branch_id || inventoryItem.branch_id,
          user_id: req.user.id
        });
        await cashbookEntry.save();
      }

      // Create debt entry if not fully paid
      if (totalPaid < sale_price) {
        const debtAmount = sale_price - totalPaid;
        const debtEntry = new Cashbook({
          date: new Date(),
          content: `Công nợ bán hàng: ${inventoryItem.product_name}`,
          amount: debtAmount,
          type: 'income',
          source: 'cong_no',
          branch_id: req.user.branch_id || inventoryItem.branch_id,
          user_id: req.user.id
        });
        await debtEntry.save();
      }
    }

    // Create activity log
    await ActivityLog.create({
      user_id: req.user.id,
      username: req.user.email,
      action: 'create',
      module: 'export',
      details: `Bán sản phẩm: ${inventoryItem.product_name}`,
      branch_id: req.user.branch_id || inventoryItem.branch_id,
      timestamp: new Date()
    });

    res.status(201).json({ 
      message: 'Xuất hàng thành công',
      data: { inventoryItem, exportHistory }
    });
  } catch (error) {
    console.error('Error creating export:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

export default app;
