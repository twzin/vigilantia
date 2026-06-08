import axios from 'axios';

// Instância para o Serviço de Autenticação (Porta 8001)
export const authApi = axios.create({
  baseURL: 'http://127.0.0.1:8001',
});

// Instância para o Serviço de Parser/Gateway (Porta 8000)
export const parserApi = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

// Interceptor para injetar o token JWT automaticamente nas requisições do Parser
parserApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('vigilantia_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});