import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import DataTable from "../components/DataTable";

function QuanLyUser() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/pending-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Lấy danh sách user thất bại");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message || "Lỗi khi lấy dữ liệu");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleApprove = async (userId) => {
    if (!window.confirm("Bạn có chắc muốn phê duyệt user này?")) return;
    setApprovingId(userId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/approve-user/${userId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Phê duyệt user thất bại");
      }
      alert("✅ Đã phê duyệt user thành công");
      fetchPendingUsers();
    } catch (err) {
      alert(err.message || "Lỗi khi phê duyệt user");
    }
    setApprovingId(null);
  };

  // Stats calculation
  const stats = {
    totalPending: users.length,
    totalToday: users.filter(user => {
      const today = new Date().toDateString();
      const userDate = new Date(user.createdAt).toDateString();
      return userDate === today;
    }).length
  };

  // Table columns definition
  const tableColumns = [
    {
      header: "Email",
      key: "email",
      render: (user) => (
        <div className="text-sm font-medium text-gray-900">
          {user.email}
        </div>
      )
    },
    {
      header: "Ngày đăng ký",
      key: "createdAt",
      render: (user) => (
        <div className="text-sm text-gray-500">
          {new Date(user.createdAt).toLocaleString('vi-VN')}
        </div>
      )
    },
    {
      header: "Trạng thái",
      key: "status",
      render: (user) => (
        <span className="badge-orange">
          ⏳ Chờ phê duyệt
        </span>
      )
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (user) => (
        <button
          className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
            approvingId === user._id
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
          disabled={approvingId === user._id}
          onClick={() => handleApprove(user._id)}
        >
          {approvingId === user._id ? "⏳ Đang phê duyệt..." : "✅ Phê duyệt"}
        </button>
      )
    }
  ];

  if (loading) {
    return (
      <Layout 
        activeTab="quan-ly-user"
        title="👥 Quản Lý User"
        subtitle="Phê duyệt và quản lý người dùng"
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải danh sách user...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout 
        activeTab="quan-ly-user"
        title="👥 Quản Lý User"
        subtitle="Phê duyệt và quản lý người dùng"
      >
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl">
          <div className="flex items-center">
            <div className="text-red-600 text-xl mr-3">❌</div>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Có lỗi xảy ra</h3>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      activeTab="quan-ly-user"
      title="👥 Quản Lý User"
      subtitle="Phê duyệt và quản lý người dùng"
    >
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Chờ phê duyệt"
          value={stats.totalPending.toString()}
          icon="⏳"
          color="orange"
          subtitle="User đang chờ"
        />
        <StatsCard
          title="Đăng ký hôm nay"
          value={stats.totalToday.toString()}
          icon="📅"
          color="blue"
          subtitle="User mới hôm nay"
        />
        <StatsCard
          title="Hệ thống"
          value="Hoạt động"
          icon="✅"
          color="green"
          subtitle="Trạng thái ổn định"
        />
      </div>

      {/* Main Content */}
      {users.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-12 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Không có user nào đang chờ phê duyệt</h3>
          <p className="text-gray-600">Tất cả user đã được phê duyệt hoặc chưa có đăng ký mới.</p>
        </div>
      ) : (
        <DataTable
          title="📋 Danh sách User chờ phê duyệt"
          data={users.map(user => ({ ...user, id: user._id }))}
          columns={tableColumns}
          currentPage={1}
          totalPages={1}
          itemsPerPage={users.length}
          totalItems={users.length}
        />
      )}
    </Layout>
  );
}

export default QuanLyUser;
