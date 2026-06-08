import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parserApi } from './api';
import { LogOut, Activity } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    // Testa se o token é válido e busca o status do sistema (apenas admins)
    parserApi.get('/admin/system-status')
      .then(response => setStatus(response.data))
      .catch(() => {
        // Se der erro (token expirado ou acesso negado), volta pro login
        // Em um app real, separaríamos a lógica de "Cliente" e "Admin"
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('vigilantia_token');
    navigate('/');
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e2f', color: 'white', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #2a2a40', paddingBottom: '15px' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Activity color="#4ade80" /> Painel de Controle</h1>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          <LogOut size={16} /> Sair
        </button>
      </header>

      {status ? (
        <div style={{ backgroundColor: '#2a2a40', padding: '20px', borderRadius: '8px' }}>
          <h2>{status.message}</h2>
          <p>Status do Sistema: <span style={{ color: '#4ade80' }}>{status.system_health}</span></p>
          <p>Alertas Ativos: <strong>{status.active_alerts}</strong></p>
        </div>
      ) : (
        <p>Carregando dados seguros do SIEM...</p>
      )}
    </div>
  );
}