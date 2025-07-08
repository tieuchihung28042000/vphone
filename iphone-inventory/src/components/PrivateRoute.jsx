import React from "react";
import { Navigate } from "react-router-dom";
import * as jwt_decode from "jwt-decode";

function getDecodedToken() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) return null;
  try {
    return jwt_decode.default(token);
  } catch {
    return null;
  }
}

const PrivateRoute = ({ children, requiredRole, requireReportAccess }) => {
  const decoded = getDecodedToken();

  if (!decoded) {
    return <Navigate to="/login" replace />;
  }

  // Kiểm tra token hết hạn
  const now = Date.now().valueOf() / 1000;
  if (decoded.exp && decoded.exp < now) {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    return <Navigate to="/login" replace />;
  }

  // Kiểm tra quyền truy cập báo cáo
  if (requireReportAccess && decoded.role === 'thu_ngan') {
    return <Navigate to="/not-authorized" replace />;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(decoded.role)) {
      return <Navigate to="/not-authorized" replace />;
    }
  }

  return children;
};

export default PrivateRoute;
