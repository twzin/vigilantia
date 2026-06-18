import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Users as UsersIcon, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import api from './api';

const INNER = { padding: '28px 28px 48px', maxWidth: '1000px', margin: '0 auto' };
const CARD  = { background: '#21262d', border: '1px solid rgba(48,54,61,0.8)', borderRadius: '10px', padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' };
const INPUT = { width: '100%', padding: '9px 12px', background: '#010409', border: '1px solid rgba(48,54,61,0.8)', borderRadius: '6px', color: '#c9d1d9', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };
const LABEL = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' };

const ROLE_STYLE = {
  admin:   { color: '#f0883e', bg: 'rgba(240,136,62,0.1)' },
  cliente: { color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
};

function RoleBadge({ role }) {
  const s = ROLE_STYLE[role] || { color: '#8b949e', bg: 'rgba(139,148,158,0.1)' };
  return <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: s.color, background: s.bg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{role}</span>;
}

const emptyForm = { username: '', password: '', role: 'cliente' };

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('vigilantia_token');
    if (!token) { navigate('/'); return; }
    try { jwtDecode(token); } catch { navigate('/'); return; }
    fetchUsers();
  }, [navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      if (err.response?.status === 401) navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditUser(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit   = (u)  => { setEditUser(u); setForm({ username: u.username, password: '', role: u.role }); setError(''); setShowForm(true); };
  const closeForm  = ()   => { setShowForm(false); setEditUser(null); setForm(emptyForm); setError(''); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editUser) {
        const body = { role: form.role, active: true };
        if (form.password) body.password = form.password;
        await api.put(`/admin/users/${editUser.username}`, body);
      } else {
        await api.post('/admin/users', { username: form.username, password: form.password, role: form.role });
      }
      await fetchUsers();
      closeForm();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await api.put(`/admin/users/${u.username}`, { active: !u.active });
      await fetchUsers();
    } catch { /* silently */ }
  };

  const handleDelete = async (username) => {
    if (!window.confirm(`Remover o usuário "${username}"?`)) return;
    try {
      await api.delete(`/admin/users/${username}`);
      await fetchUsers();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao remover usuário.');
    }
  };

  return (
    <div style={INNER}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UsersIcon size={18} color="#eab308" />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#c9d1d9', letterSpacing: '-0.3px' }}>Gerenciar Usuários</h2>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#ca8a04', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> Novo Usuário
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div style={{ ...CARD, marginBottom: '20px', borderColor: 'rgba(234,179,8,0.25)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#c9d1d9', marginBottom: '18px' }}>
            {editUser ? `Editar — ${editUser.username}` : 'Novo Usuário'}
          </h3>
          {error && <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', padding: '10px 14px', color: '#f85149', fontSize: '13px', marginBottom: '14px' }}>{error}</div>}
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={LABEL}>Usuário</label>
                <input style={INPUT} value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="nome_usuario" required disabled={!!editUser} />
              </div>
              <div>
                <label style={LABEL}>{editUser ? 'Nova senha (opcional)' : 'Senha'}</label>
                <input type="password" style={INPUT} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••" required={!editUser} />
              </div>
              <div>
                <label style={LABEL}>Role</label>
                <select style={{ ...INPUT, cursor: 'pointer' }} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="cliente">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeForm} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(48,54,61,0.8)', color: '#8b949e', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: saving ? '#1f2937' : '#ca8a04', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div style={CARD}>
        {loading ? (
          <p style={{ color: '#484f58', textAlign: 'center', padding: '40px 0', fontSize: '13px' }}>Carregando...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(48,54,61,0.8)' }}>
                {['Usuário', 'Role', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.username} style={{ borderBottom: '1px solid rgba(48,54,61,0.4)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontWeight: 500, color: '#c9d1d9' }}>{u.username}</td>
                  <td style={{ padding: '12px 14px' }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: u.active ? '#3fb950' : '#f85149' }}>
                      {u.active ? <Check size={12} /> : <X size={12} />}
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEdit(u)} title="Editar" style={{ padding: '5px 8px', background: 'rgba(234,179,8,0.1)', color: '#eab308', border: 'none', borderRadius: '5px', cursor: 'pointer' }}><Pencil size={13} /></button>
                      <button onClick={() => handleToggleActive(u)} title={u.active ? 'Desativar' : 'Ativar'} style={{ padding: '5px 8px', background: u.active ? 'rgba(210,153,34,0.1)' : 'rgba(63,185,80,0.1)', color: u.active ? '#d29922' : '#3fb950', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        {u.active ? <X size={13} /> : <Check size={13} />}
                      </button>
                      <button onClick={() => handleDelete(u.username)} title="Remover" style={{ padding: '5px 8px', background: 'rgba(248,81,73,0.1)', color: '#f85149', border: 'none', borderRadius: '5px', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
