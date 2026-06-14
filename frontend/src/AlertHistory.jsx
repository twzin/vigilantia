import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { BellRing, CheckCheck, Filter } from 'lucide-react';
import api from './api';
import Navbar from './Navbar';

const PAGE  = { background: '#0d0d1a', minHeight: '100vh' };
const INNER = { padding: '28px 28px 48px', maxWidth: '1000px', margin: '0 auto' };
const CARD  = { background: 'linear-gradient(135deg,#1a1a35 0%,#12122a 100%)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '22px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' };

const SEV_COLOR = { CRITICAL: '#ef4444', ERROR: '#f97316', WARNING: '#eab308', INFO: '#4ade80' };

function formatTs(iso) {
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}

export default function AlertHistory() {
  const navigate = useNavigate();
  const [role, setRole]               = useState(null);
  const [alerts, setAlerts]           = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [filterSev, setFilterSev]     = useState('');
  const [filterAck, setFilterAck]     = useState('');

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }
    try { setRole(jwtDecode(token).role); } catch { navigate('/'); return; }
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

  const applyFilters = (e) => {
    e.preventDefault();
    fetchAlerts(filterSev, filterAck);
  };

  const inputStyle = { padding: '8px 12px', background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#e8eaf0', fontSize: '13px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' };

  return (
    <div style={PAGE}>
      <Navbar role={role} />
      <div style={INNER}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <BellRing size={18} color="#4ade80" />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e8eaf0', letterSpacing: '-0.3px' }}>Histórico de Alertas</h2>
        </div>

        {/* Filtros */}
        <form onSubmit={applyFilters} style={{ ...CARD, marginBottom: '20px', display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Severidade</p>
            <select style={inputStyle} value={filterSev} onChange={e => setFilterSev(e.target.value)}>
              {['', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map(s => <option key={s} value={s}>{s || 'Todas'}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Status</p>
            <select style={inputStyle} value={filterAck} onChange={e => setFilterAck(e.target.value)}>
              <option value="">Todos</option>
              <option value="false">Pendentes</option>
              <option value="true">Reconhecidos</option>
            </select>
          </div>
          <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#4ade80', color: '#0a1a0a', border: 'none', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <Filter size={13} /> Filtrar
          </button>
        </form>

        {/* Lista */}
        <div style={CARD}>
          {!loading && (
            <p style={{ fontSize: '12px', color: '#8892a4', marginBottom: '16px' }}>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{total}</span> alerta(s) encontrado(s)
            </p>
          )}

          {loading ? (
            <p style={{ color: '#4a5068', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>Carregando...</p>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#4a5068' }}>
              <BellRing size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px' }}>Nenhum alerta encontrado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.map(alert => {
                const sColor = SEV_COLOR[alert.severity] || '#8892a4';
                return (
                  <div key={alert.id} style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${alert.acknowledged ? 'rgba(255,255,255,0.04)' : `${sColor}33`}`, opacity: alert.acknowledged ? 0.6 : 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ padding: '2px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: sColor, background: `${sColor}18`, textTransform: 'uppercase' }}>
                          {alert.severity || '—'}
                        </span>
                        {!alert.acknowledged && (
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Pendente
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, color: '#e8eaf0', fontSize: '14px' }}>{alert.rule_name}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8892a4' }}>
                        {alert.event_count} eventos
                        {alert.source && <> · <span style={{ color: '#60a5fa' }}>{alert.source}</span></>}
                        {' '}· threshold: {alert.threshold} / {alert.window_minutes} min
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#4a5068', fontFamily: 'monospace' }}>{formatTs(alert['@timestamp'])}</p>
                    </div>
                    {!alert.acknowledged && (
                      <button onClick={() => handleAcknowledge(alert.id)} title="Marcar como reconhecido" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
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
    </div>
  );
}
