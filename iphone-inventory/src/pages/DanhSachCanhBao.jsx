import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import DataTable from "../components/DataTable";

function formatNumber(val) {
  if (val === undefined || val === null || val === "") return "";
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function DanhSachCanhBao() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/canh-bao-ton-kho`)
      .then((res) => res.json())
      .then((res) => {
        // Group by SKU + BRANCH
  const map = {};
  res.items.forEach(item => {
    const key = (item.sku || '') + '|' + (item.branch || '');
    if (!map[key]) {
      map[key] = {
        sku: item.sku,
        tenSanPham: item.tenSanPham || item.product_name,
        branch: item.branch,
        totalRemain: 0,
      };
    }
    map[key].totalRemain += Number(item.totalRemain || item.quantity || 0);
  });

  setData(Object.values(map));
  setLoading(false);
})
      .catch((err) => {
        console.error("Lỗi:", err);
        setLoading(false);
      });
  }, []);

  const handleGuiEmail = () => {
    setMessage("✅ Đã gửi email cảnh báo thành công (mô phỏng)");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleTaoDeNghi = () => {
    const content = data
      .map((row) => `- ${row.tenSanPham} (${row.sku}) tại ${row.branch}: còn ${row.totalRemain}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "de-nghi-nhap-hang.txt";
    a.click();
    URL.revokeObjectURL(url);
    setMessage("✅ Đã tạo đơn đề nghị nhập hàng (file .txt)");
    setTimeout(() => setMessage(""), 3000);
  };

  // Stats calculation
  const totalLowStock = data.length;
  const criticalItems = data.filter(item => item.totalRemain === 0).length;
  const warningItems = data.filter(item => item.totalRemain > 0 && item.totalRemain < 2).length;

  const stats = {
    totalLowStock,
    criticalItems,
    warningItems,
    averageStock: totalLowStock > 0 ? (data.reduce((sum, item) => sum + item.totalRemain, 0) / totalLowStock).toFixed(1) : 0
  };

  // Table columns definition
  const tableColumns = [
    {
      header: "Sản phẩm",
      key: "product",
      render: (row) => (
        <div>
          <div className="text-sm font-semibold text-gray-900">{row.tenSanPham}</div>
          <div className="text-sm text-gray-500">SKU: {row.sku}</div>
        </div>
      )
    },
    {
      header: "Chi nhánh",
      key: "branch",
      render: (row) => (
        <span className="badge-blue text-xs">{row.branch}</span>
      )
    },
    {
      header: "Tồn kho",
      key: "stock",
      render: (row) => {
        let colorClass = "text-orange-600";
        let icon = "⚠️";
        
        if (row.totalRemain === 0) {
          colorClass = "text-red-600";
          icon = "❌";
        } else if (row.totalRemain === 1) {
          colorClass = "text-orange-600";
          icon = "⚠️";
        }
        
        return (
          <div className={`text-sm font-bold ${colorClass}`}>
            {icon} {formatNumber(row.totalRemain)}
          </div>
        );
      }
    },
    {
      header: "Mức độ",
      key: "severity",
      render: (row) => {
        if (row.totalRemain === 0) {
          return <span className="badge-danger">🚨 Hết hàng</span>;
        } else if (row.totalRemain === 1) {
          return <span className="badge-orange">⚠️ Sắp hết</span>;
        } else {
          return <span className="badge-yellow">⚡ Thấp</span>;
        }
      }
    }
  ];

  if (loading) {
    return (
      <Layout 
        activeTab="canh-bao"
        title="⚠️ Cảnh Báo Tồn Kho"
        subtitle="Danh sách sản phẩm cần nhập thêm"
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải dữ liệu cảnh báo...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      activeTab="canh-bao"
      title="⚠️ Cảnh Báo Tồn Kho"
      subtitle="Danh sách sản phẩm cần nhập thêm"
    >
      {/* Message Alert */}
      {message && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-2xl mb-6">
          <div className="flex items-center">
            <div className="text-green-600 text-xl mr-3">✅</div>
            <p className="text-green-800 font-medium">{message}</p>
          </div>
        </div>
      )}

      {/* Stats Dashboard */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Sản phẩm cảnh báo"
            value={stats.totalLowStock.toString()}
            icon="⚠️"
            color="orange"
            subtitle="Cần nhập thêm"
          />
          <StatsCard
            title="Hết hàng"
            value={stats.criticalItems.toString()}
            icon="❌"
            color="red"
            subtitle="Cần nhập ngay"
          />
          <StatsCard
            title="Sắp hết"
            value={stats.warningItems.toString()}
            icon="⚡"
            color="yellow"
            subtitle="Còn ít sản phẩm"
          />
          <StatsCard
            title="Tồn kho TB"
            value={stats.averageStock.toString()}
            icon="📊"
            color="blue"
            subtitle="Số lượng trung bình"
          />
        </div>
      )}

      {/* Action Buttons */}
      {data.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🔧 Thao tác nhanh</h3>
          <div className="flex flex-wrap gap-4">
          <button
            onClick={handleGuiEmail}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all font-medium"
          >
            📧 Gửi email cảnh báo
          </button>
          <button
            onClick={handleTaoDeNghi}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl transition-all font-medium"
          >
              📄 Tạo đơn đề nghị
          </button>
        <button
  onClick={() => navigate("/ton-kho-so-luong")}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-all font-medium"
>
              🔙 Quay lại tồn kho
</button>
          </div>
      </div>
      )}

      {/* Data Table or Empty State */}
      {data.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Tất cả sản phẩm đều đủ tồn kho</h3>
          <p className="text-gray-600">Không có sản phẩm nào cần cảnh báo nhập thêm.</p>
          <button
            onClick={() => navigate("/ton-kho-so-luong")}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all font-medium"
          >
            📦 Xem tồn kho
          </button>
        </div>
      ) : (
        <DataTable
          title="📋 Danh sách sản phẩm cần nhập thêm"
          data={data.map((item, index) => ({ ...item, id: index }))}
          columns={tableColumns}
          currentPage={1}
          totalPages={1}
          itemsPerPage={data.length}
          totalItems={data.length}
        />
      )}
    </Layout>
  );
}

export default DanhSachCanhBao;
