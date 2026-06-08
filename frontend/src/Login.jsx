import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from './api';
import { ShieldAlert } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // FastAPI OAuth2PasswordRequestForm exige URLSearchParams
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await authApi.post('/login', params);
      
      // Salva o token e redireciona para o dashboard
      localStorage.setItem('vigilantia_token', response.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError('Credenciais incorretas. Tente novamente.');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e1e2f', color: 'white' }}>
      <div style={{ padding: '40px', backgroundColor: '#2a2a40', borderRadius: '8px', width: '350px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <ShieldAlert size={48} color="#4ade80" />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Vigilantia SIEM</h2>
        {error && <p style={{ color: '#f87171', textAlign: 'center' }}>{error}</p>}
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="text" 
            placeholder="Usuário (ex: admin_user)" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', border: 'none' }}
          />
          <input 
            type="password" 
            placeholder="Senha (ex: senha123)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', borderRadius: '4px', border: 'none' }}
          />
          <button type="submit" style={{ padding: '10px', backgroundColor: '#4ade80', color: '#1e1e2f', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Acessar Plataforma
          </button>
        </form>
      </div>
    </div>
  );
}