import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://realtime-co-shopping-platform.onrender.com';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor: Her isteğe (request) gitmeden önce bak ve varsa Token'ı ekle
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
