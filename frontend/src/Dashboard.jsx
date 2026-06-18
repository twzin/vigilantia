import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, AreaChart, Area, CartesianGrid,
} from 'recharts';
import { Activity, Server, Database, AlertTriangle } from 'lucide-react';
import api from './api';

const SEVERITY_COLORS = { CRITICAL: '#f85149', ERROR: '#f0883e', WARNING: '#d29922', INFO: '#3fb950' };

const INNER  = { padding: '28px 28px 48px', maxWidth: '1200px', margin: '0 auto' };
const CARD   = {
  background: '#21262d',
  border: '1px solid rgba(48,54,61,0.8)',
  borderRadius: '10px', padding: '20px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
};
const SECTION_TITLE = { margin: '0 0 16px', fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.8px' };
const GRID2  = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' };
const GRID4  = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '20px' };

const tooltipStyle = {
  contentStyle: { background: '#161b22', border: '1px solid rgba(48,54,61,0.8)', borderRadius: '8px', color: '#c9d1d9', fontSize: '13px' },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ ...CARD, borderLeft: `3px solid ${color}`, display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: 40, height: 40, borderRadius: '8px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '11px', color: '#8b949e', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: '24px', fontWeight: 700, color: '#c9d1d9', lineHeight: 1, letterSpacing: '-0.5px' }}>{value ?? '—'}</p>
      </div>
    </div>
  );
}

function formatHour(isoStr) {
  try { return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return isoStr; }
}

function EmptyChart({ text = 'Sem dados ainda' }) {
  return <p style={{ color: '#484f58', textAlign: 'center', padding: '60px 0', fontSize: '13px' }}>{text}</p>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [role, setRole]               = useState(null);
  const [stats, setStats]             = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }
    let decoded;
    try { decoded = jwtDecode(token); } catch { navigate('/'); return; }
    setRole(decoded.role);

    (async () => {
      try {
        const [statsRes] = await Promise.all([api.get('/stats')]);
        setStats(statsRes.data);
        if (decoded.role === 'admin') {
          const r = await api.get('/admin/system-status');
          setSystemStatus(r.data);
        }
      } catch (err) {
        if (err.response?.status === 401) navigate('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#484f58', fontSize: '14px', gap: '10px' }}>
        <Activity size={16} color="#eab308" /> Carregando dados...
      </div>
    );
  }

  const severityData   = stats ? Object.entries(stats.severity_distribution).map(([name, value]) => ({ name, value })) : [];
  const topSourcesData = stats ? Object.entries(stats.top_sources).map(([name, value]) => ({ name, value })).slice(0, 8) : [];
  const volumeData     = (stats?.volume_over_time ?? []).filter(d => d.count > 0).map(d => ({ ...d, hora: formatHour(d.time) }));

  return (
    <div style={INNER}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Activity size={18} color="#eab308" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#c9d1d9', letterSpacing: '-0.3px' }}>Painel de Controle</h2>
      </div>

      {/* Stat cards */}
      <div style={GRID4}>
        <StatCard icon={Database}      label="Total de Eventos"   value={stats?.total_events?.toLocaleString('pt-BR')} color="#eab308" />
        <StatCard icon={AlertTriangle} label="Críticos"           value={stats?.severity_distribution?.CRITICAL ?? 0}  color="#f85149" />
        <StatCard icon={AlertTriangle} label="Erros"              value={stats?.severity_distribution?.ERROR ?? 0}     color="#f0883e" />
        <StatCard icon={Activity}      label="Avisos"             value={stats?.severity_distribution?.WARNING ?? 0}   color="#d29922" />
      </div>

      {/* Charts row */}
      <div style={GRID2}>
        <div style={CARD}>
          <p style={SECTION_TITLE}>Distribuição por Severidade</p>
          {severityData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={42} outerRadius={68} paddingAngle={3} label={false}>
                    {severityData.map(e => <Cell key={e.name} fill={SEVERITY_COLORS[e.name] || '#484f58'} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: '10px' }}>
                {severityData.map(({ name, value }) => {
                  const total = severityData.reduce((s, d) => s + d.value, 0);
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLORS[name] || '#484f58', flexShrink: 0 }} />
                      <span style={{ color: '#8b949e' }}>{name}</span>
                      <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{Math.round(value / total * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <EmptyChart />}
        </div>

        <div style={CARD}>
          <p style={SECTION_TITLE}>Top Fontes de Log</p>
          {topSourcesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topSourcesData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" stroke="#484f58" tick={{ fontSize: 11, fill: '#8b949e' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#484f58" tick={{ fontSize: 11, fill: '#8b949e' }} width={90} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" fill="#eab308" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Volume chart */}
      <div style={{ ...CARD, marginBottom: '16px' }}>
        <p style={SECTION_TITLE}>Volume de Eventos por Hora</p>
        {volumeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={volumeData} margin={{ left: -10, right: 8 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#eab308" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="hora" stroke="#484f58" tick={{ fontSize: 11, fill: '#8b949e' }} axisLine={false} tickLine={false} />
              <YAxis stroke="#484f58" tick={{ fontSize: 11, fill: '#8b949e' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="#eab308" strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: '#eab308', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <EmptyChart text="Nenhum evento registrado ainda" />}
      </div>

      {/* Admin panel */}
      {systemStatus && role === 'admin' && (
        <div style={{ ...CARD, borderColor: 'rgba(240,136,62,0.2)' }}>
          <p style={{ ...SECTION_TITLE, color: '#f0883e' }}>
            <Server size={12} style={{ display: 'inline', marginRight: 6 }} />
            Status do Sistema — Admin
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              ['Elasticsearch', `v${systemStatus.elasticsearch_version}`],
              ['Total de Eventos', systemStatus.total_events?.toLocaleString('pt-BR')],
              ['Saúde', systemStatus.system_health],
              ['Status', systemStatus.message],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.6)' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                <p style={{ margin: '5px 0 0', fontWeight: 600, color: '#f0883e', fontSize: '14px' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
