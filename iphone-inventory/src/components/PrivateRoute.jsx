import React from "react";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function getDecodedToken() {
  const localToken = localStorage.getItem("token");
  const sessionToken = sessionStorage.getItem("token");
  const token = localToken || sessionToken;
  
  console.log("🔍 PrivateRoute - Local token:", !!localToken);
  console.log("🔍 PrivateRoute - Session token:", !!sessionToken);
  console.log("🔍 PrivateRoute - Using token:", !!token);
  
  if (!token) return null;
  try {
    const decoded = jwtDecode(token);
    console.log("🔍 PrivateRoute - Decoded token:", decoded);
    return decoded;
  } catch (error) {
    console.error("❌ Token decode error:", error);
    // Clear invalid token
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    return null;
  }
}

const PrivateRoute = ({ children, requiredRole, requireReportAccess }) => {
  const decoded = getDecodedToken();

  console.log("🔍 PrivateRoute - Required role:", requiredRole);
  console.log("🔍 PrivateRoute - User role:", decoded?.role);
  console.log("🔍 PrivateRoute - Require report access:", requireReportAccess);

  if (!decoded) {
    console.log("❌ PrivateRoute - No valid token, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // Kiểm tra token hết hạn
  const now = Date.now().valueOf() / 1000;
  console.log("🔍 PrivateRoute - Token exp:", decoded.exp, "Current time:", now);
  if (decoded.exp && decoded.exp < now) {
    console.log("❌ PrivateRoute - Token expired");
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    return <Navigate to="/login" replace />;
  }

  // Kiểm tra quyền truy cập báo cáo
  if (requireReportAccess && decoded.role === 'thu_ngan') {
    console.log("❌ PrivateRoute - Thu ngân không được xem báo cáo");
    return <Navigate to="/not-authorized" replace />;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    console.log("🔍 PrivateRoute - Checking roles:", roles, "vs user role:", decoded.role);
    if (!roles.includes(decoded.role)) {
      console.log("❌ PrivateRoute - Insufficient permissions");
      return <Navigate to="/not-authorized" replace />;
    }
  }

  console.log("✅ PrivateRoute - Access granted");

  return children;
};

export default PrivateRoute;
