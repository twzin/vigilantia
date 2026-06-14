import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login        from './Login';
import Dashboard    from './Dashboard';
import Logs         from './Logs';
import Users        from './Users';
import AlertRules   from './AlertRules';
import AlertHistory from './AlertHistory';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"          element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/logs"      element={<ProtectedRoute><Logs /></ProtectedRoute>} />
        <Route path="/alertas"   element={<ProtectedRoute><AlertHistory /></ProtectedRoute>} />

        {/* Admin only */}
        <Route path="/admin/usuarios" element={<ProtectedRoute requiredRole="admin"><Users /></ProtectedRoute>} />
        <Route path="/admin/alertas"  element={<ProtectedRoute requiredRole="admin"><AlertRules /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
