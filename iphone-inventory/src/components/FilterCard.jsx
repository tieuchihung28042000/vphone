// Filter Card Component - Có thể tái sử dụng
const FilterCard = ({ title = "🔍 Tìm kiếm & Lọc dữ liệu", children, onClearFilters }) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl transition-all duration-200 font-medium text-sm"
          >
            🔄 Xóa bộ lọc
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

export default FilterCard; 