# Frontend

Bu uygulama backend adresini `VITE_API_BASE_URL` degiskeninden okur.

## Calistirma

```bash
npm install
npm run dev
```

## Ortam Degiskeni

`.env.example` dosyasini `.env` olarak kopyalayip gerekirse backend URL'yi degistir:

```env
VITE_API_BASE_URL=https://realtime-co-shopping-platform.onrender.com
```

Bu ayar hem REST API hem WebSocket (`/ws`) baglantisinda kullanilir.
