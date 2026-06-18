import { jwtDecode } from 'jwt-decode';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  let role = null;
  try {
    const token = localStorage.getItem('vigilantia_token');
    if (token) role = jwtDecode(token).role;
  } catch { /* ignore */ }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar role={role} />
      <main style={{ flex: 1, overflow: 'auto', background: '#0d1117' }}>
        {children}
      </main>
    </div>
  );
}
