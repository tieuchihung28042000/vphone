// Stats Card Component - Có thể tái sử dụng
const StatsCard = ({ title, value, icon, color = "blue", subtitle, onClick }) => {
  const colorClasses = {
    blue: 'border-l-blue-500 text-blue-600',
    green: 'border-l-green-500 text-green-600', 
    purple: 'border-l-purple-500 text-purple-600',
    orange: 'border-l-orange-500 text-orange-600',
    red: 'border-l-red-500 text-red-600',
    yellow: 'border-l-yellow-500 text-yellow-600',
    indigo: 'border-l-indigo-500 text-indigo-600',
    pink: 'border-l-pink-500 text-pink-600',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    purple: 'bg-purple-100', 
    orange: 'bg-orange-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100',
    indigo: 'bg-indigo-100',
    pink: 'bg-pink-100',
  };

  return (
    <div 
      className={`stats-card border-l-4 ${colorClasses[color]} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div className={`w-16 h-16 ${iconBgClasses[color]} rounded-2xl flex items-center justify-center ml-4`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
};

export default StatsCard; 