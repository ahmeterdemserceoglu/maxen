# TV arayüz kontrolü — 5 Eylül 2026

Telefon tasarımı ve mevcut renkler korunarak TV dalları güncellendi.

| Alan | Yapılan düzenleme |
| --- | --- |
| Ana sayfa / içerik listeleri | Daha küçük görseller, sınırlı liste oluşturma, TV'de sade yükleme durumları, görünür izleme ilerlemesi |
| Detay | TV'ye özel özet ve oynatma eylemleri; sezon seçici, sanallaştırılmış bölüm listesi ve bölüm ilerlemesi; oylama TV'de gizli |
| Arama | Kumanda klavyesi, sesli arama, tür seçimi, filtre penceresi, yatay sonuç kartları |
| Oynatıcı | Büyük etiketli kontroller; menü açıkken arka planda tuş eylemi engeli; odak menü içinde; sanallaştırılmış bölüm rafı |
| Giriş / profil | Belirgin giriş odağı, TV PIN tuş takımı, TV'de dekoratif animasyonların kaldırılması |
| Ayarlar / sosyal / indirmeler / yakında / oyuncu | Kumandayla odaklanabilir kontroller ve ilgili TV boyutlandırmaları / geri davranışı |
| Kısa fragman akışı | TV'de önceki/sonraki düğmeleri; yalnızca aktif fragman; yatay yönün korunması |

## Doğrulama

- TypeScript kontrolü geçti.
- Android JavaScript/Hermes paketleme kontrolü geçti (`expo export --platform android`, 1348 modül). Çıktı `dist/tv-verification` altında; bu bir APK derlemesi değildir.
- Jest: 23 pakette 186 test; 185 geçti, `networkService.test.ts` içindeki bağlantı testi başarısız. Ağ servisi ve bu test bu değişiklikte düzenlenmedi. Servisin başlangıç bağlantı isteği testin sonradan kurduğu fetch taklidiyle çakışabiliyor.
- Ekran görüntüleri 960×540 Chrome önizlemesinde örnek verilerle alındı. Detay, arama, klavye, filtre, oynatıcı ve PIN görsel kontrolleri yapıldı. Bunlar gerçek yayın oynatma veya Android TV D-pad testinin yerine geçmez.
- Önizleme için kullanılan geçici uygulama rotası kaldırıldı.
- Bağlı Android cihazı bulunmadı; fiziksel kumanda odağı, modal kapandıktan sonra odak dönüşü, düşük bellekli TV'de kaydırma ve gerçek video oynatma cihaz üzerinde doğrulanmalı. FPS ölçümü yapılmadı.

Görseller bu klasördedir; üstteki İngilizce sekmeler yalnızca geçici önizleme aracına aittir.
