import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, Search, LogOut } from 'lucide-react';

const ROLE_STYLE = {
  admin:   { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  label: 'Admin' },
  cliente: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', label: 'Cliente' },
};

export default function Navbar({ role }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('vigilantia_token');
    navigate('/');
  };

  const s = ROLE_STYLE[role] || {};

  const navBtn = (path, label, Icon) => {
    const active = pathname === path;
    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '7px 14px', border: 'none', borderRadius: '6px',
          cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500,
          transition: 'background 0.15s, color 0.15s',
          backgroundColor: active ? 'rgba(74,222,128,0.1)' : 'transparent',
          color: active ? '#4ade80' : '#8892a4',
          outline: active ? '1px solid rgba(74,222,128,0.2)' : 'none',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e8eaf0'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#8892a4'; }}
      >
        <Icon size={14} /> {label}
      </button>
    );
  };

  return (
    <header style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 24px', height: '56px',
      background: '#0d0d1a',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={20} color="#4ade80" />
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', color: '#e8eaf0' }}>
            Vigilantia
          </span>
        </div>
        {role && (
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 9px',
            borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.8px',
            color: s.color, background: s.bg,
          }}>
            {s.label}
          </span>
        )}
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {navBtn('/dashboard', 'Dashboard', LayoutDashboard)}
        {navBtn('/logs', 'Busca de Logs', Search)}
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '7px 14px', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500,
            background: 'transparent', color: '#8892a4', transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8892a4'; }}
        >
          <LogOut size={14} /> Sair
        </button>
      </nav>
    </header>
  );
}
