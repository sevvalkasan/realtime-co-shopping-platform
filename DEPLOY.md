# Deploy ve Guvenlik Checklist

## 1) Kritik: Gizli bilgileri dondur (rotate)

Bu repoda daha once plaintext gorunen tum bilgiler icin yeni deger uret:

- Postgres sifresi
- Gmail app password
- Twilio auth token
- JWT secret
- Extension API key

Eski degerleri kullanmaya devam etme.

## 2) Environment degiskenleri

Localde `.env.example` dosyasini kopyalayip kendi degerlerinle doldur.

Render/Railway'de asagidakileri Environment Variables olarak ekle:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `APP_JWT_SECRET` (en az 32 karakter)
- `APP_EXTENSION_API_KEY` (uzun ve tahmin edilmesi zor bir metin)
- `APP_CORS_ALLOWED_ORIGIN_PATTERNS` (frontend domain + `chrome-extension://*`)
- `APP_MAIL_FROM`, `SPRING_MAIL_*` (e-posta akisi kullaniliyorsa)
- `APP_SMS_TWILIO_*` (SMS/Twilio kullaniliyorsa)

## 3) Render hizli kurulum (backend)

Repoda `render.yaml` dosyasi eklendi. Render'da Blueprint deploy ile otomatik okuyabilirsin.

1. Render'da `New +` -> `Web Service`.
2. Repo sec: `realtime-co-shopping-platform`.
3. Root directory: `backend`
4. Build command: `./mvnw clean package -DskipTests`
5. Start command: `java -jar target/backend-0.0.1-SNAPSHOT.jar`
6. Runtime environment variable: `PORT` otomatik gelir.
7. Tum gerekli env degiskenlerini ekle ve deploy et.

Not: jar ismi farkliysa `target` altindaki mevcut jar adini kullan.

## 4) Railway hizli kurulum (backend)

1. `New Project` -> `Deploy from GitHub repo`.
2. Service root'u `backend` olacak sekilde ayarla.
3. Build: Maven otomatik algilanir; degilse `./mvnw clean package -DskipTests`.
4. Start: `java -jar target/backend-0.0.1-SNAPSHOT.jar`
5. Environment Variables bolumune ayni degiskenleri gir.

## 5) Frontend production ayari

Frontend tarafinda backend base URL production domain olmalı
ornek: `https://projem-backend.onrender.com`.

Gerekirse frontend env:

- `VITE_API_BASE_URL=https://projem-backend.onrender.com`

## 6) Chrome extension paylasimi

Arkadasinla ayni ayarlari kullanin:

- Backend URL: deploy edilen backend URL
- Room ID: ayni oda
- Extension API Key: `APP_EXTENSION_API_KEY` ile ayni

Bu key bir sir olmasa da endpoint spamini azaltan bir kapidir; herkese acik paylasma.
