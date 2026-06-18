import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login        from './Login';
import Dashboard    from './Dashboard';
import Logs         from './Logs';
import Users        from './Users';
import AlertRules   from './AlertRules';
import AlertHistory from './AlertHistory';
import ProtectedRoute from './ProtectedRoute';
import Layout       from './Layout';

function Protected({ children, requiredRole }) {
  return (
    <ProtectedRoute requiredRole={requiredRole}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/logs"      element={<Protected><Logs /></Protected>} />
        <Route path="/alertas"   element={<Protected><AlertHistory /></Protected>} />

        <Route path="/admin/usuarios" element={<Protected requiredRole="admin"><Users /></Protected>} />
        <Route path="/admin/alertas"  element={<Protected requiredRole="admin"><AlertRules /></Protected>} />
      </Routes>
    </Router>
  );
}

export default App;
