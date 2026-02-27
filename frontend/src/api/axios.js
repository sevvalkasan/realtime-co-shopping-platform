import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080', // Java backend portun
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