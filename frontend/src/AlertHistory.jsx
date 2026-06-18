import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { BellRing, CheckCheck, Filter, Globe, User, Server, MessageSquare } from 'lucide-react';
import api from './api';

const INNER = { padding: '28px 28px 48px', maxWidth: '1000px', margin: '0 auto' };
const CARD  = { background: '#21262d', border: '1px solid rgba(48,54,61,0.8)', borderRadius: '10px', padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' };

const SEV_COLOR = { CRITICAL: '#f85149', ERROR: '#f0883e', WARNING: '#d29922', INFO: '#3fb950' };

function Chip({ color, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}30`, marginRight: '4px', marginBottom: '3px' }}>
      {children}
    </span>
  );
}

function MetaRow({ icon, label, items, color }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '6px' }}>
      <span style={{ color: '#484f58', marginTop: '2px', flexShrink: 0 }}>{icon}</span>
      <div>
        <span style={{ fontSize: '10px', color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '6px' }}>{label}</span>
        {items.map((v, i) => <Chip key={i} color={color}>{v}</Chip>)}
      </div>
    </div>
  );
}

function formatTs(iso) {
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}

export default function AlertHistory() {
  const navigate = useNavigate();
  const [alerts, setAlerts]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [filterSev, setFilterSev] = useState('');
  const [filterAck, setFilterAck] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }
    try { jwtDecode(token); } catch { navigate('/'); return; }
    fetchAlerts();
  }, [navigate]);

  const fetchAlerts = async (sev = filterSev, ack = filterAck) => {
    setLoading(true);
    try {
      const params = {};
      if (sev) params.severity = sev;
      if (ack !== '') params.acknowledged = ack === 'true';
      const res = await api.get('/alerts', { params });
      setAlerts(res.data.alerts);
      setTotal(res.data.total);
    } catch (err) {
      if (err.response?.status === 401) navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await api.patch(`/alerts/${id}/acknowledge`);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch { /* silently */ }
  };

  const applyFilters = (e) => { e.preventDefault(); fetchAlerts(filterSev, filterAck); };

  const inputStyle = { padding: '8px 12px', background: '#010409', border: '1px solid rgba(48,54,61,0.8)', borderRadius: '6px', color: '#c9d1d9', fontSize: '13px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' };

  return (
    <div style={INNER}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <BellRing size={18} color="#eab308" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#c9d1d9', letterSpacing: '-0.3px' }}>Histórico de Alertas</h2>
      </div>

      {/* Filtros */}
      <form onSubmit={applyFilters} style={{ ...CARD, marginBottom: '20px', display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Severidade</p>
          <select style={inputStyle} value={filterSev} onChange={e => setFilterSev(e.target.value)}>
            {['', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map(s => <option key={s} value={s}>{s || 'Todas'}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Status</p>
          <select style={inputStyle} value={filterAck} onChange={e => setFilterAck(e.target.value)}>
            <option value="">Todos</option>
            <option value="false">Pendentes</option>
            <option value="true">Reconhecidos</option>
          </select>
        </div>
        <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#ca8a04', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          <Filter size={13} /> Filtrar
        </button>
      </form>

      {/* Lista */}
      <div style={CARD}>
        {!loading && (
          <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '16px' }}>
            <span style={{ color: '#eab308', fontWeight: 700 }}>{total}</span> alerta(s) encontrado(s)
          </p>
        )}

        {loading ? (
          <p style={{ color: '#484f58', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>Carregando...</p>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#484f58' }}>
            <BellRing size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px' }}>Nenhum alerta encontrado.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map(alert => {
              const sColor = SEV_COLOR[alert.severity] || '#8b949e';
              return (
                <div key={alert.id} style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${alert.acknowledged ? 'rgba(48,54,61,0.4)' : `${sColor}33`}`, opacity: alert.acknowledged ? 0.6 : 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: sColor, background: `${sColor}18`, textTransform: 'uppercase' }}>
                        {alert.severity ? `≥ ${alert.severity}` : '—'}
                      </span>
                      {!alert.acknowledged && (
                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: '#f85149', background: 'rgba(248,81,73,0.1)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Pendente
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontWeight: 600, color: '#c9d1d9', fontSize: '14px' }}>{alert.rule_name}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8b949e' }}>
                      {alert.event_count} eventos · threshold: {alert.threshold} / {alert.window_minutes} min
                      {alert.source && <> · fonte: <span style={{ color: '#eab308' }}>{alert.source}</span></>}
                      {alert.keyword && <> · keyword: <span style={{ color: '#a371f7' }}>"{alert.keyword}"</span></>}
                    </p>

                    <MetaRow icon={<Globe size={11} />}   label="IPs"       items={alert.client_ips}      color="#f0883e" />
                    <MetaRow icon={<User   size={11} />}  label="Usuários"  items={alert.usernames}       color="#eab308" />
                    <MetaRow icon={<Server size={11} />}  label="Devices"   items={alert.reporting_hosts} color="#8b949e" />

                    {alert.sample_message && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '6px' }}>
                        <span style={{ color: '#484f58', marginTop: '2px', flexShrink: 0 }}><MessageSquare size={11} /></span>
                        <p style={{ margin: 0, fontSize: '11px', color: '#484f58', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {alert.sample_message}
                        </p>
                      </div>
                    )}

                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#484f58', fontFamily: 'monospace' }}>{formatTs(alert['@timestamp'])}</p>
                  </div>
                  {!alert.acknowledged && (
                    <button onClick={() => handleAcknowledge(alert.id)} title="Marcar como reconhecido" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <CheckCheck size={13} /> Reconhecer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
