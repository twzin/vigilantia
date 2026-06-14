import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, AreaChart, Area, CartesianGrid,
} from 'recharts';
import { Activity, Server, Database, AlertTriangle } from 'lucide-react';
import api from './api';
import Navbar from './Navbar';

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  ERROR: '#f97316',
  WARNING: '#eab308',
  INFO:  '#4ade80',
};

const card = (children, style = {}) => (
  <div style={{
    backgroundColor: '#2a2a40', borderRadius: '8px', padding: '20px', ...style,
  }}>
    {children}
  </div>
);

function StatCard({ icon: Icon, label, value, color }) {
  return card(
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <Icon size={28} color={color} />
      <div>
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{label}</p>
        <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{value ?? '—'}</p>
      </div>
    </div>
  );
}

function formatHour(isoStr) {
  try { return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return isoStr; }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [stats, setStats] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }

    let decoded;
    try { decoded = jwtDecode(token); }
    catch { navigate('/'); return; }

    setRole(decoded.role);

    const fetchAll = async () => {
      try {
        const [statsRes] = await Promise.all([api.get('/stats')]);
        setStats(statsRes.data);

        if (decoded.role === 'admin') {
          const statusRes = await api.get('/admin/system-status');
          setSystemStatus(statusRes.data);
        }
      } catch (err) {
        if (err.response?.status === 401) navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#1e1e2f', color: 'white', minHeight: '100vh' }}>
        <Navbar role={role} />
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Carregando dados...</div>
      </div>
    );
  }

  const severityData = stats
    ? Object.entries(stats.severity_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const topSourcesData = stats
    ? Object.entries(stats.top_sources).map(([name, value]) => ({ name, value })).slice(0, 8)
    : [];

  const volumeData = (stats?.volume_over_time ?? [])
    .filter(d => d.count > 0)
    .map(d => ({ ...d, hora: formatHour(d.time) }));

  const criticalCount = stats?.severity_distribution?.CRITICAL ?? 0;
  const errorCount   = stats?.severity_distribution?.ERROR ?? 0;

  return (
    <div style={{ backgroundColor: '#1e1e2f', color: 'white', minHeight: '100vh' }}>
      <Navbar role={role} />

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <Activity color="#4ade80" size={20} /> Painel de Controle
        </h2>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard icon={Database}      label="Total de Eventos"  value={stats?.total_events}  color="#60a5fa" />
          <StatCard icon={AlertTriangle} label="Eventos Críticos"  value={criticalCount}        color="#ef4444" />
          <StatCard icon={AlertTriangle} label="Erros"             value={errorCount}           color="#f97316" />
          {systemStatus && (
            <StatCard icon={Server} label="Saúde do Sistema" value={systemStatus.system_health} color="#4ade80" />
          )}
        </div>

        {/* Gráficos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

          {/* Distribuição por severidade */}
          {card(
            <>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#94a3b8' }}>Distribuição por Severidade</h3>
              {severityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {severityData.map(entry => (
                        <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#2a2a40', border: 'none', color: 'white' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p style={{ color: '#64748b', textAlign: 'center', paddingTop: '60px' }}>Sem dados</p>}
            </>
          )}

          {/* Top fontes */}
          {card(
            <>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#94a3b8' }}>Top Fontes de Log</h3>
              {topSourcesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topSourcesData} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: '#2a2a40', border: 'none', color: 'white' }} />
                    <Bar dataKey="value" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{ color: '#64748b', textAlign: 'center', paddingTop: '60px' }}>Sem dados</p>}
            </>
          )}
        </div>

        {/* Volume ao longo do tempo */}
        {card(
          <>
            <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#94a3b8' }}>Volume de Eventos por Hora</h3>
            {volumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={volumeData}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a55" />
                  <XAxis dataKey="hora" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#2a2a40', border: 'none', color: 'white' }} />
                  <Area type="monotone" dataKey="count" stroke="#4ade80" fill="url(#areaGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p style={{ color: '#64748b', textAlign: 'center', paddingTop: '40px' }}>Nenhum evento registrado ainda</p>}
          </>,
          { marginBottom: '24px' }
        )}

        {/* Painel admin */}
        {systemStatus && role === 'admin' && card(
          <>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} /> Status do Sistema (Admin)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {[
                ['Mensagem',        systemStatus.message],
                ['Elasticsearch',   `v${systemStatus.elasticsearch_version}`],
                ['Total de Eventos', systemStatus.total_events],
                ['Saúde',           systemStatus.system_health],
              ].map(([label, value]) => (
                <div key={label} style={{ backgroundColor: '#16162a', padding: '12px', borderRadius: '6px' }}>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{label}</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 'bold', color: '#4ade80' }}>{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
