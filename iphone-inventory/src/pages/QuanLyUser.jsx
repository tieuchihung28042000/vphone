import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatsCard from "../components/StatsCard";
import DataTable from "../components/DataTable";

function QuanLyUser() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending"); // pending, all, create
  const [allUsers, setAllUsers] = useState([]);

  // State cho form tạo user mới
  const [createUserModal, setCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    email: "",
    password: "",
    username: "",
    role: "nhan_vien_ban_hang",
    branch_id: "",
    branch_name: "",
    full_name: "",
    phone: "",
  });

  // Load danh sách chi nhánh
  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (err) {
      console.error("Error loading branches:", err);
    }
  };

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/pending-users`, {
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

  const fetchAllUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/all-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Lấy danh sách user thất bại");
      }
      const data = await res.json();
      setAllUsers(data);
    } catch (err) {
      setError(err.message || "Lỗi khi lấy dữ liệu");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBranches();
    if (activeTab === "pending") {
      fetchPendingUsers();
    } else if (activeTab === "all") {
      fetchAllUsers();
    }
  }, [activeTab]);

  const handleApprove = async (userId) => {
    if (!window.confirm("Bạn có chắc muốn phê duyệt user này?")) return;
    setApprovingId(userId);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/approve-user/${userId}`, {
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      
      // Tìm branch được chọn
      const selectedBranch = branches.find(b => b._id === createUserForm.branch_id);
      
      const userData = {
        ...createUserForm,
        branch_name: selectedBranch ? selectedBranch.name : "",
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Tạo tài khoản thành công");
        setCreateUserModal(false);
        setCreateUserForm({
          email: "",
          password: "",
          username: "",
          role: "nhan_vien_ban_hang",
          branch_id: "",
          branch_name: "",
          full_name: "",
          phone: "",
        });
        if (activeTab === "all") {
          fetchAllUsers();
        }
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (err) {
      alert("❌ Lỗi khi tạo tài khoản");
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/update-role/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        alert("✅ Cập nhật vai trò thành công");
        fetchAllUsers();
      } else {
        alert("❌ Cập nhật vai trò thất bại");
      }
    } catch (err) {
      alert("❌ Lỗi khi cập nhật vai trò");
    }
  };

  // Stats calculation
  const stats = {
    totalPending: users.length,
    totalUsers: allUsers.length,
    totalToday: users.filter(user => {
      const today = new Date().toDateString();
      const userDate = new Date(user.createdAt).toDateString();
      return userDate === today;
    }).length
  };

  // Table columns for pending users
  const pendingColumns = [
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
      header: "Họ tên",
      key: "full_name",
      render: (user) => (
        <div className="text-sm text-gray-600">
          {user.full_name || "Chưa có"}
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

  // Table columns for all users
  const allUsersColumns = [
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
      header: "Họ tên",
      key: "full_name",
      render: (user) => (
        <div className="text-sm text-gray-600">
          {user.full_name || "Chưa có"}
        </div>
      )
    },
    {
      header: "Vai trò",
      key: "role",
      render: (user) => {
        const roleLabels = {
          admin: "👑 Admin",
          quan_ly: "👨‍💼 Quản lý",
          thu_ngan: "💰 Thu ngân",
          nhan_vien_ban_hang: "🛒 Nhân viên bán hàng",
          user: "👤 User"
        };
        return (
          <select
            value={user.role}
            onChange={(e) => handleUpdateUserRole(user._id, e.target.value)}
            className="text-sm bg-white border border-gray-300 rounded px-2 py-1"
          >
            <option value="nhan_vien_ban_hang">🛒 Nhân viên bán hàng</option>
            <option value="thu_ngan">💰 Thu ngân</option>
            <option value="quan_ly">👨‍💼 Quản lý</option>
            <option value="admin">👑 Admin</option>
          </select>
        );
      }
    },
    {
      header: "Chi nhánh",
      key: "branch_name",
      render: (user) => (
        <div className="text-sm text-gray-600">
          {user.branch_name || "Chưa có"}
        </div>
      )
    },
    {
      header: "Trạng thái",
      key: "approved",
      render: (user) => (
        <span className={`badge-${user.approved ? 'green' : 'red'}`}>
          {user.approved ? "✅ Đã duyệt" : "❌ Chưa duyệt"}
        </span>
      )
    },
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải danh sách user...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl">
          <div className="flex items-center">
            <div className="text-red-600 text-xl mr-3">❌</div>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Có lỗi xảy ra</h3>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "pending") {
      return users.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-12 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Không có user nào đang chờ phê duyệt</h3>
          <p className="text-gray-600">Tất cả user đã được phê duyệt hoặc chưa có đăng ký mới.</p>
        </div>
      ) : (
        <DataTable
          title="📋 Danh sách User chờ phê duyệt"
          data={users.map(user => ({ ...user, id: user._id }))}
          columns={pendingColumns}
          currentPage={1}
          totalPages={1}
          itemsPerPage={users.length}
          totalItems={users.length}
        />
      );
    }

    if (activeTab === "all") {
      return (
        <DataTable
          title="👥 Tất cả User trong hệ thống"
          data={allUsers.map(user => ({ ...user, id: user._id }))}
          columns={allUsersColumns}
          currentPage={1}
          totalPages={1}
          itemsPerPage={allUsers.length}
          totalItems={allUsers.length}
        />
      );
    }

    return null;
  };

  return (
    <Layout 
      activeTab="quan-ly-user"
      title="👥 Quản Lý User"
      subtitle="Phê duyệt và quản lý người dùng"
    >
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Chờ phê duyệt"
          value={stats.totalPending.toString()}
          icon="⏳"
          color="orange"
          subtitle="User đang chờ"
        />
        <StatsCard
          title="Tổng User"
          value={stats.totalUsers.toString()}
          icon="👥"
          color="blue"
          subtitle="Tất cả user"
        />
        <StatsCard
          title="Đăng ký hôm nay"
          value={stats.totalToday.toString()}
          icon="📅"
          color="green"
          subtitle="User mới hôm nay"
        />
      </div>

      {/* Tab Navigation */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "pending"
                ? "bg-orange-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            ⏳ Chờ phê duyệt ({stats.totalPending})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === "all"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            👥 Tất cả User ({stats.totalUsers})
          </button>
          <button
            onClick={() => setCreateUserModal(true)}
            className="px-4 py-2 rounded-xl font-medium bg-green-500 text-white hover:bg-green-600 transition-all"
          >
            ➕ Tạo User mới
          </button>
        </div>

        {renderContent()}
      </div>

      {/* Create User Modal */}
      {createUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">➕ Tạo tài khoản mới</h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={createUserForm.email}
                  onChange={(e) => setCreateUserForm({...createUserForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu *</label>
                <input
                  type="password"
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm({...createUserForm, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Họ tên</label>
                <input
                  type="text"
                  value={createUserForm.full_name}
                  onChange={(e) => setCreateUserForm({...createUserForm, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Số điện thoại</label>
                <input
                  type="text"
                  value={createUserForm.phone}
                  onChange={(e) => setCreateUserForm({...createUserForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Vai trò *</label>
                <select
                  value={createUserForm.role}
                  onChange={(e) => setCreateUserForm({...createUserForm, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="nhan_vien_ban_hang">🛒 Nhân viên bán hàng</option>
                  <option value="thu_ngan">💰 Thu ngân</option>
                  <option value="quan_ly">👨‍💼 Quản lý</option>
                  <option value="admin">👑 Admin</option>
                </select>
              </div>

              {createUserForm.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Chi nhánh *</label>
                  <select
                    value={createUserForm.branch_id}
                    onChange={(e) => setCreateUserForm({...createUserForm, branch_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Chọn chi nhánh</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateUserModal(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  ❌ Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  ➕ Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default QuanLyUser;
