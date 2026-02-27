import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token) {
    // pathname: /dashboard, search: ?roomId=xyz-123
    // Hepsini birleştirip 'from' içine atıyoruz
    const fullPath = location.pathname + location.search;
    return <Navigate to="/" state={{ from: fullPath }} replace />;
  }

  return children;
};

export default ProtectedRoute;