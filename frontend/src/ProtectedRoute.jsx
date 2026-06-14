import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

export default function ProtectedRoute({ requiredRole, children }) {
  const token = localStorage.getItem('vigilantia_token');
  if (!token) return <Navigate to="/" replace />;

  try {
    const { role } = jwtDecode(token);
    if (requiredRole && role !== requiredRole) return <Navigate to="/dashboard" replace />;
    return children;
  } catch {
    return <Navigate to="/" replace />;
  }
}
