import axios from 'axios';

// Ponto único de entrada: tudo passa pelo API Gateway
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: GATEWAY_URL });

// Injeta JWT automaticamente em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vigilantia_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Aliases para compatibilidade com o código existente
export const authApi = api;
export const parserApi = api;
export default api;