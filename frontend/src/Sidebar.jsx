import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, BellRing, Users, Bell, LogOut } from 'lucide-react';
import logo from './assets/logo.png';

const ROLE_STYLE = {
  admin:   { color: '#f0883e', bg: 'rgba(240,136,62,0.15)', label: 'Admin' },
  cliente: { color: '#eab308', bg: 'rgba(234,179,8,0.15)', label: 'Cliente' },
};

export default function Sidebar({ role }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const logout = () => {
    localStorage.removeItem('vigilantia_token');
    navigate('/');
  };

  const navItem = (path, label, Icon) => {
    const active = pathname === path || pathname.startsWith(path + '/');
    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', padding: '8px 14px',
          border: 'none', borderRadius: '6px',
          cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500,
          background: active ? 'rgba(234,179,8,0.1)' : 'transparent',
          color: active ? '#eab308' : '#8b949e',
          borderLeft: `3px solid ${active ? '#eab308' : 'transparent'}`,
          transition: 'all 0.15s', textAlign: 'left',
          marginBottom: '1px',
        }}
        onMouseEnter={e => {
          if (!active) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#c9d1d9';
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#8b949e';
          }
        }}
      >
        <Icon size={15} />
        {label}
      </button>
    );
  };

  const s = ROLE_STYLE[role] || {};

  return (
    <aside style={{
      width: '220px', flexShrink: 0,
      background: '#161b22',
      borderRight: '1px solid rgba(48,54,61,0.8)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(48,54,61,0.8)', display: 'flex', justifyContent: 'center' }}>
        <img src={logo} alt="Vigilantia" style={{ width: 160, objectFit: 'contain', borderRadius: '6px' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <p style={{ fontSize: '10px', fontWeight: 600, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px', marginBottom: '6px' }}>
          Monitoramento
        </p>
        {navItem('/dashboard', 'Dashboard',  LayoutDashboard)}
        {navItem('/logs',      'Logs',       Search)}
        {navItem('/alertas',   'Alertas',    BellRing)}

        {role === 'admin' && (
          <>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '14px 8px 6px', marginBottom: '2px' }}>
              Administração
            </p>
            {navItem('/admin/usuarios', 'Usuários',       Users)}
            {navItem('/admin/alertas',  'Regras de Alerta', Bell)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 8px 12px', borderTop: '1px solid rgba(48,54,61,0.8)' }}>
        {role && (
          <div style={{ padding: '6px 10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: s.color, background: s.bg, padding: '2px 8px', borderRadius: '999px' }}>
              {s.label}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '8px 14px',
            border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500,
            background: 'transparent', color: '#8b949e',
            borderLeft: '3px solid transparent',
            transition: 'all 0.15s', textAlign: 'left',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#f85149';
            e.currentTarget.style.background = 'rgba(248,81,73,0.08)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#8b949e';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogOut size={15} /> Sair
        </button>
      </div>
    </aside>
  );
}
