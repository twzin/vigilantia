import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, Search, LogOut } from 'lucide-react';

const ROLE_LABEL = { admin: 'Admin', cliente: 'Cliente' };
const ROLE_COLOR = { admin: '#f97316', cliente: '#60a5fa' };

export default function Navbar({ role }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('vigilantia_token');
    navigate('/');
  };

  const navBtn = (path, label, Icon) => (
    <button
      onClick={() => navigate(path)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer',
        backgroundColor: pathname === path ? '#3a3a55' : 'transparent',
        color: pathname === path ? '#4ade80' : '#cbd5e1',
        fontSize: '14px',
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 24px', backgroundColor: '#16162a',
      borderBottom: '1px solid #2a2a40',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ShieldAlert size={22} color="#4ade80" />
        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Vigilantia SIEM</span>
        {role && (
          <span style={{
            fontSize: '11px', fontWeight: 'bold', padding: '2px 8px',
            borderRadius: '999px', backgroundColor: '#2a2a40',
            color: ROLE_COLOR[role] || '#cbd5e1', textTransform: 'uppercase',
          }}>
            {ROLE_LABEL[role] || role}
          </span>
        )}
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {navBtn('/dashboard', 'Dashboard', LayoutDashboard)}
        {navBtn('/logs', 'Busca de Logs', Search)}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer',
            backgroundColor: 'transparent', color: '#f87171', fontSize: '14px', marginLeft: '8px',
          }}
        >
          <LogOut size={15} /> Sair
        </button>
      </nav>
    </header>
  );
}
