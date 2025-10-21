// Data Table Component - Có thể tái sử dụng
const DataTable = ({ 
  title, 
  data, 
  columns, 
  currentPage = 1, 
  totalPages = 1, 
  itemsPerPage = 15,
  onPageChange,
  totalItems = 0
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="table-modern">
      <div className="table-header">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
            {totalItems} hoạt động
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th 
                  key={index}
                  className={`px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider ${column.width || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr key={item.id || index} className="table-row">
                {columns.map((column, colIndex) => (
                  <td 
                    key={colIndex} 
                    className={`px-6 py-4 ${column.width === 'flex-1' ? 'whitespace-normal' : 'whitespace-nowrap'} ${column.width || ''}`}
                  >
                    {column.render ? column.render(item) : item[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          {/* Mobile pagination */}
          <div className="flex justify-between sm:hidden mb-4">
            <button
              onClick={() => onPageChange && onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              ← Trước
            </button>
            <button
              onClick={() => onPageChange && onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              Sau →
            </button>
          </div>

          {/* Desktop pagination */}
          <div className="hidden sm:flex justify-center mb-4">
            <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px">
              {(() => {
                // ✅ Tạo danh sách phân trang rút gọn với dấu "..."
                const pages = [];
                const maxButtons = 9; // tối đa số "nút" hiển thị (bao gồm ...)
                const add = (p) => pages.push(p);

                if (totalPages <= maxButtons) {
                  for (let i = 1; i <= totalPages; i++) add(i);
                } else {
                  const showNeighbors = 1; // số trang lân cận mỗi phía
                  const left = Math.max(2, currentPage - showNeighbors);
                  const right = Math.min(totalPages - 1, currentPage + showNeighbors);

                  add(1);
                  if (left > 2) add('...-left');

                  for (let i = left; i <= right; i++) add(i);

                  if (right < totalPages - 1) add('...-right');
                  add(totalPages);
                }

                return pages.map((p, idx) => {
                  if (typeof p === 'string' && p.startsWith('...')) {
                    // dấu ...
                    const isLeft = p === '...-left';
                    const rounded = isLeft ? 'rounded-none' : 'rounded-none';
                    return (
                      <span
                        key={p + idx}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium bg-white border-gray-300 text-gray-400 ${rounded}`}
                      >
                        ...
                      </span>
                    );
                  }
                  const i = p;
                  const first = i === 1;
                  const last = i === totalPages;
                  return (
                    <button
                      key={i}
                      onClick={() => onPageChange && onPageChange(i)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-all ${
                        currentPage === i
                          ? 'z-10 bg-purple-50 border-purple-500 text-purple-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      } ${first ? 'rounded-l-xl' : ''} ${last ? 'rounded-r-xl' : ''}`}
                    >
                      {i}
                    </button>
                  );
                });
              })()}
            </nav>
          </div>

          {/* Pagination info - Moved to bottom */}
          <div className="text-center">
            <p className="text-sm text-gray-700">
              Hiển thị <span className="font-semibold">{startItem}</span> đến{' '}
              <span className="font-semibold">{endItem}</span> trong tổng{' '}
              <span className="font-semibold">{totalItems}</span> kết quả
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable; 