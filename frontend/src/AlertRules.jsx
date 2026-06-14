import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from './api';
import Navbar from './Navbar';

const PAGE  = { background: '#0d0d1a', minHeight: '100vh' };
const INNER = { padding: '28px 28px 48px', maxWidth: '1000px', margin: '0 auto' };
const CARD  = { background: 'linear-gradient(135deg,#1a1a35 0%,#12122a 100%)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '22px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' };
const INPUT = { width: '100%', padding: '9px 12px', background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#e8eaf0', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };
const LABEL = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' };

const SEVERITIES  = ['', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'];
const SEV_COLOR   = { CRITICAL: '#ef4444', ERROR: '#f97316', WARNING: '#eab308', INFO: '#4ade80' };
const SEV_LABEL   = { CRITICAL: 'CRITICAL', ERROR: 'ERROR ou CRITICAL', WARNING: 'WARNING, ERROR ou CRITICAL', INFO: 'qualquer severidade' };
const emptyForm   = { name: '', severity: '', source: '', keyword: '', threshold: 5, window_minutes: 10 };

export default function AlertRules() {
  const navigate = useNavigate();
  const [role, setRole]         = useState(null);
  const [rules, setRules]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }
    try { setRole(jwtDecode(token).role); } catch { navigate('/'); return; }
    fetchRules();
  }, [navigate]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/alert-rules');
      setRules(res.data);
    } catch (err) {
      if (err.response?.status === 401) navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token   = localStorage.getItem('vigilantia_token');
      const decoded = jwtDecode(token);
      await api.post('/admin/alert-rules', {
        ...form,
        severity:       form.severity || null,
        source:         form.source   || null,
        keyword:        form.keyword  || null,
        threshold:      Number(form.threshold),
        window_minutes: Number(form.window_minutes),
        active:         true,
        created_by:     decoded.sub,
      });
      await fetchRules();
      setShowForm(false);
      setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao criar regra.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await api.put(`/admin/alert-rules/${rule.id}`, { ...rule, active: !rule.active });
      await fetchRules();
    } catch { /* silently */ }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remover a regra "${name}"?`)) return;
    try {
      await api.delete(`/admin/alert-rules/${id}`);
      await fetchRules();
    } catch { /* silently */ }
  };

  return (
    <div style={PAGE}>
      <Navbar role={role} />
      <div style={INNER}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="#4ade80" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e8eaf0', letterSpacing: '-0.3px' }}>Regras de Alerta</h2>
          </div>
          <button onClick={() => { setShowForm(s => !s); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#4ade80', color: '#0a1a0a', border: 'none', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Nova Regra
          </button>
        </div>

        {/* Formulário */}
        {showForm && (
          <div style={{ ...CARD, marginBottom: '20px', borderColor: 'rgba(74,222,128,0.2)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e8eaf0', marginBottom: '18px' }}>Nova Regra de Alerta</h3>
            {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '10px 14px', color: '#f87171', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '14px', marginBottom: '18px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={LABEL}>Nome da Regra</label>
                  <input style={INPUT} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="ex: Brute force SSH" required />
                </div>
                <div>
                  <label style={LABEL}>Severidade mínima ≥ (opcional)</label>
                  <select style={{ ...INPUT, cursor: 'pointer' }} value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s || 'Qualquer'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Fonte (opcional)</label>
                  <input style={INPUT} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="ex: sshd, nginx, firewalld" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={LABEL}>Keyword na mensagem (opcional)</label>
                  <input style={INPUT} value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))} placeholder='ex: "Failed password", "DENY", "exploit"' />
                </div>
                <div>
                  <label style={LABEL}>Threshold (eventos)</label>
                  <input type="number" min={1} style={INPUT} value={form.threshold} onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))} required />
                </div>
                <div>
                  <label style={LABEL}>Janela (minutos)</label>
                  <input type="number" min={1} style={INPUT} value={form.window_minutes} onChange={e => setForm(p => ({ ...p, window_minutes: e.target.value }))} required />
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#4a5068', marginBottom: '18px' }}>
                Dispara quando houver ≥ <strong style={{ color: '#e8eaf0' }}>{form.threshold}</strong> eventos
                {form.severity && <> com severidade <strong style={{ color: SEV_COLOR[form.severity] }}>≥ {SEV_LABEL[form.severity] || form.severity}</strong></>}
                {form.source && <> · fonte <strong style={{ color: '#60a5fa' }}>{form.source}</strong></>}
                {form.keyword && <> · mensagem contém <strong style={{ color: '#a78bfa' }}>"{form.keyword}"</strong></>}
                {' '}nos últimos <strong style={{ color: '#e8eaf0' }}>{form.window_minutes}</strong> min.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8892a4', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: saving ? '#1a3a25' : '#4ade80', color: '#0a1a0a', border: 'none', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Salvando...' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de regras */}
        <div style={CARD}>
          {loading ? (
            <p style={{ color: '#4a5068', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>Carregando...</p>
          ) : rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#4a5068' }}>
              <Bell size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px' }}>Nenhuma regra criada. Clique em "Nova Regra" para começar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rules.map(rule => (
                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${rule.active ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)'}` }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: rule.active ? '#e8eaf0' : '#4a5068', fontSize: '14px' }}>{rule.name}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8892a4' }}>
                      ≥ {rule.threshold} eventos
                      {rule.severity && <> · <span style={{ color: SEV_COLOR[rule.severity] || '#8892a4' }}>≥ {rule.severity}</span></>}
                      {rule.source && <> · <span style={{ color: '#60a5fa' }}>{rule.source}</span></>}
                      {rule.keyword && <> · <span style={{ color: '#a78bfa' }}>"{rule.keyword}"</span></>}
                      {' '}· {rule.window_minutes} min
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => handleToggle(rule)} title={rule.active ? 'Desativar' : 'Ativar'} style={{ padding: '5px 8px', background: rule.active ? 'rgba(74,222,128,0.1)' : 'rgba(136,146,164,0.1)', color: rule.active ? '#4ade80' : '#8892a4', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      {rule.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button onClick={() => handleDelete(rule.id, rule.name)} title="Remover" style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
