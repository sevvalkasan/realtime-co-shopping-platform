# Coshop Chrome Extension

Bu eklenti Trendyol urun sayfasina `Ortak Sepete Ekle` butonu ekler.

## Kurulum

1. Chrome'da `chrome://extensions` ac.
2. `Developer mode` aktif et.
3. `Load unpacked` ile bu klasoru sec: `.../realtime-co-shopping-platform/extension`.
4. Eklenti popup'inda asagidaki bilgileri doldur:
   - Backend URL: `http://localhost:8080`
   - Oda ID: ortak kullanacaginiz oda (ornek `room-ortak`)
   - Kullanici Adi: kendi adin
   - Extension API Key: backend'deki `APP_EXTENSION_API_KEY` ile ayni deger

## Calisma sekli

- Trendyol urun sayfasinda butona basinca backend'e urun etkinligi gonderilir.
- Diger kullanicilarda eklenti arka planda endpoint'i poll eder ve bildirimi gosterir.

## Notlar

- Bildirim polling suresi 1 dakikadir (Chrome alarm limiti).
- Backend tarafinda `/api/extension/shared-list/add` ve `/api/extension/shared-list/events` endpointleri acik olmalidir.
- Bu endpointler artik `X-Extension-Key` header'i zorunlu bekler.
