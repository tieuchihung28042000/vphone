// Form Card Component - Có thể tái sử dụng
const FormCard = ({ 
  title, 
  subtitle, 
  children, 
  onReset, 
  resetLabel = "Hủy", 
  showReset = false,
  message,
  className = ""
}) => {
  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-3xl card-shadow p-8 ${className}`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {showReset && onReset && (
          <button
            onClick={onReset}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200"
          >
            ✕ {resetLabel}
          </button>
        )}
      </div>

      {children}

      {message && (
        <div className={`mt-6 p-4 rounded-2xl border-l-4 ${
          message.includes('✅') 
            ? 'bg-green-50 text-green-800 border-green-500' 
            : 'bg-red-50 text-red-800 border-red-500'
        }`}>
          <p className="font-medium">{message}</p>
        </div>
      )}
    </div>
  );
};

export default FormCard; 