import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Search, Filter, AlertTriangle, Info, AlertOctagon, Flame } from 'lucide-react';
import api from './api';
import Navbar from './Navbar';

const SEVERITIES = ['', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'];

const SEVERITY_STYLE = {
  CRITICAL: { color: '#ef4444', icon: Flame },
  ERROR:    { color: '#f97316', icon: AlertOctagon },
  WARNING:  { color: '#eab308', icon: AlertTriangle },
  INFO:     { color: '#4ade80', icon: Info },
};

function SeverityBadge({ value }) {
  const cfg = SEVERITY_STYLE[value] || { color: '#94a3b8', icon: Info };
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold',
      backgroundColor: cfg.color + '22', color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <Icon size={11} /> {value}
    </span>
  );
}

function formatTs(isoStr) {
  try { return new Date(isoStr).toLocaleString('pt-BR'); }
  catch { return isoStr; }
}

export default function Logs() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [filters, setFilters] = useState({ q: '', severity: '', source: '', from: '', to: '', regex: false });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }
    try { setRole(jwtDecode(token).role); }
    catch { navigate('/'); }
  }, [navigate]);

  const set = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.q)        params.q        = filters.q;
      if (filters.severity) params.severity  = filters.severity;
      if (filters.source)   params.source    = filters.source;
      if (filters.from)     params.from      = new Date(filters.from).toISOString();
      if (filters.to)       params.to        = new Date(filters.to).toISOString();
      if (filters.regex)    params.regex     = true;

      const res = await api.get('/search', { params });
      setResults(res.data);
    } catch (err) {
      if (err.response?.status === 401) { navigate('/'); return; }
      setError(err.response?.data?.detail || 'Erro ao executar busca.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: '8px 12px', borderRadius: '4px', border: '1px solid #3a3a55',
    backgroundColor: '#16162a', color: 'white', fontSize: '13px', width: '100%',
  };

  const labelStyle = { fontSize: '11px', color: '#94a3b8', marginBottom: '4px', display: 'block' };

  return (
    <div style={{ backgroundColor: '#1e1e2f', color: 'white', minHeight: '100vh' }}>
      <Navbar role={role} />

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Search color="#4ade80" size={20} /> Busca de Logs
        </h2>

        {/* Formulário de filtros */}
        <form onSubmit={handleSearch} style={{ backgroundColor: '#2a2a40', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>

            <div>
              <label style={labelStyle}>Texto livre</label>
              <input
                style={inputStyle} placeholder="ex: login failed"
                value={filters.q} onChange={e => set('q', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Severidade</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={filters.severity} onChange={e => set('severity', e.target.value)}
              >
                {SEVERITIES.map(s => <option key={s} value={s}>{s || 'Todas'}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Fonte (source)</label>
              <input
                style={inputStyle} placeholder="ex: firewall"
                value={filters.source} onChange={e => set('source', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Data início</label>
              <input
                type="datetime-local" style={inputStyle}
                value={filters.from} onChange={e => set('from', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Data fim</label>
              <input
                type="datetime-local" style={inputStyle}
                value={filters.to} onChange={e => set('to', e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox" checked={filters.regex} onChange={e => set('regex', e.target.checked)}
                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
              />
              Tratar texto como regex
            </label>

            <button
              type="submit" disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 20px', backgroundColor: loading ? '#3a3a55' : '#4ade80',
                color: '#16162a', fontWeight: 'bold', border: 'none', borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px',
              }}
            >
              <Filter size={14} /> {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {/* Erro */}
        {error && (
          <div style={{ backgroundColor: '#ef444422', border: '1px solid #ef4444', borderRadius: '6px', padding: '12px', marginBottom: '16px', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {/* Resultados */}
        {results && (
          <div style={{ backgroundColor: '#2a2a40', borderRadius: '8px', padding: '20px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#94a3b8' }}>
              {results.total} evento(s) encontrado(s) — exibindo {results.events.length}
            </p>

            {results.events.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>Nenhum evento encontrado para os filtros aplicados.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #3a3a55' }}>
                      {['Timestamp', 'Fonte', 'Severidade', 'Mensagem'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.events.map((ev, i) => (
                      <tr key={ev.id || i} style={{ borderBottom: '1px solid #1e1e2f' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#16162a'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#94a3b8' }}>{formatTs(ev['@timestamp'])}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{ev.source}</td>
                        <td style={{ padding: '10px 12px' }}><SeverityBadge value={ev.severity} /></td>
                        <td style={{ padding: '10px 12px', maxWidth: '500px', wordBreak: 'break-word' }}>{ev.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Estado vazio inicial */}
        {!results && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            <Search size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p>Use os filtros acima para buscar eventos de log.</p>
          </div>
        )}
      </div>
    </div>
  );
}
