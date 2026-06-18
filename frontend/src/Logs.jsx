import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Search, SlidersHorizontal, Flame, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import api from './api';

const SEVERITIES = ['', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'];

const SEV = {
  CRITICAL: { color: '#f85149', bg: 'rgba(248,81,73,0.1)',   icon: Flame },
  ERROR:    { color: '#f0883e', bg: 'rgba(240,136,62,0.1)',  icon: AlertOctagon },
  WARNING:  { color: '#d29922', bg: 'rgba(210,153,34,0.1)',  icon: AlertTriangle },
  INFO:     { color: '#3fb950', bg: 'rgba(63,185,80,0.1)',   icon: Info },
};

const INNER = { padding: '28px 28px 48px', maxWidth: '1200px', margin: '0 auto' };
const CARD  = {
  background: '#21262d',
  border: '1px solid rgba(48,54,61,0.8)',
  borderRadius: '10px', padding: '20px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
};
const INPUT = {
  width: '100%', padding: '9px 12px',
  background: '#010409', border: '1px solid rgba(48,54,61,0.8)',
  borderRadius: '6px', color: '#c9d1d9', fontSize: '13px', fontFamily: 'inherit',
  outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
};
const LABEL = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' };

function SeverityBadge({ value }) {
  const s = SEV[value] || { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', icon: Info };
  const Icon = s.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
      color: s.color, background: s.bg, whiteSpace: 'nowrap', letterSpacing: '0.3px',
    }}>
      <Icon size={10} /> {value}
    </span>
  );
}

function formatTs(isoStr) {
  try { return new Date(isoStr).toLocaleString('pt-BR'); }
  catch { return isoStr; }
}

export default function Logs() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ q: '', severity: '', source: '', from: '', to: '', regex: false });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }
    try { jwtDecode(token); } catch { navigate('/'); }
  }, [navigate]);

  const set = (key, val) => setFilters(p => ({ ...p, [key]: val }));

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

  const focusStyle = (e) => { e.target.style.borderColor = '#eab308'; e.target.style.boxShadow = '0 0 0 3px rgba(234,179,8,0.1)'; };
  const blurStyle  = (e) => { e.target.style.borderColor = 'rgba(48,54,61,0.8)'; e.target.style.boxShadow = 'none'; };

  return (
    <div style={INNER}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Search size={18} color="#eab308" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#c9d1d9', letterSpacing: '-0.3px' }}>Busca de Logs</h2>
      </div>

      {/* Filtros */}
      <form onSubmit={handleSearch} style={{ ...CARD, marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '18px' }}>
          <SlidersHorizontal size={13} color="#8b949e" />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Filtros</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <div>
            <label style={LABEL}>Texto livre</label>
            <input style={INPUT} placeholder="ex: login failed" value={filters.q}
              onChange={e => set('q', e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
          </div>
          <div>
            <label style={LABEL}>Severidade</label>
            <select style={{ ...INPUT, cursor: 'pointer', appearance: 'none' }}
              value={filters.severity} onChange={e => set('severity', e.target.value)}
              onFocus={focusStyle} onBlur={blurStyle}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s || 'Todas'}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Fonte</label>
            <input style={INPUT} placeholder="ex: firewall" value={filters.source}
              onChange={e => set('source', e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
          </div>
          <div>
            <label style={LABEL}>Data início</label>
            <input type="datetime-local" style={INPUT} value={filters.from}
              onChange={e => set('from', e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
          </div>
          <div>
            <label style={LABEL}>Data fim</label>
            <input type="datetime-local" style={INPUT} value={filters.to}
              onChange={e => set('to', e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: '#8b949e', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={filters.regex} onChange={e => set('regex', e.target.checked)}
              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#eab308' }} />
            Tratar como regex
          </label>
          <button type="submit" disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 22px', border: 'none', borderRadius: '6px',
            fontFamily: 'inherit', fontSize: '13px', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#1f2937' : '#ca8a04',
            color: loading ? '#eab308' : '#fff',
            transition: 'background 0.2s',
          }}>
            <Search size={13} /> {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {/* Erro */}
      {error && (
        <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '8px', padding: '12px 16px', color: '#f85149', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Resultados */}
      {results && (
        <div style={CARD}>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#8b949e' }}>
            <span style={{ color: '#eab308', fontWeight: 700 }}>{results.total.toLocaleString('pt-BR')}</span> evento(s) encontrado(s)
            {results.events.length < results.total && <span> — exibindo {results.events.length}</span>}
          </p>

          {results.events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#484f58', fontSize: '13px' }}>
              <Search size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
              Nenhum evento encontrado para os filtros aplicados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(48,54,61,0.8)' }}>
                    {['Timestamp', 'Fonte', 'Severidade', 'Mensagem'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.events.map((ev, i) => (
                    <tr key={ev.id || i}
                      style={{ borderBottom: '1px solid rgba(48,54,61,0.4)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: '#484f58', fontFamily: 'monospace', fontSize: '12px' }}>
                        {formatTs(ev['@timestamp'])}
                      </td>
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ background: 'rgba(234,179,8,0.08)', color: '#eab308', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                          {ev.source}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}><SeverityBadge value={ev.severity} /></td>
                      <td style={{ padding: '11px 14px', color: '#c9d1d9', maxWidth: '520px', wordBreak: 'break-word', lineHeight: 1.5 }}>
                        {ev.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!results && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#484f58' }}>
          <Search size={40} style={{ opacity: 0.2, display: 'block', margin: '0 auto 14px' }} />
          <p style={{ fontSize: '14px' }}>Use os filtros acima para buscar eventos de log.</p>
        </div>
      )}
    </div>
  );
}
