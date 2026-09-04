# Bundle ve APK Derlemelerinden Önce Sürüm Güncelleme Kuralı

Android App Bundle (`bundleRelease`), APK (`assembleRelease`) veya Web prodüksiyon paketleme işlemlerinden önce **HER ZAMAN** sürüm numarasını (`version`) ve derleme numarasını (`versionCode` / `buildNumber`) bir üst sürüme güncelleyin.

## Güncellenmesi Gereken Dosyalar:
1. `app.json`:
   - `expo.version`: Yeni sürüm adı (örn. `10.4.0`)
   - `expo.android.versionCode`: +1 artırılmalı (örn. `14`)
   - `expo.ios.buildNumber`: +1 artırılmalı (örn. `14`)
2. `package.json`:
   - `version`: Yeni sürüm adı (örn. `10.4.0`)
3. `android/app/build.gradle`:
   - `defaultConfig.versionCode`: +1 artırılmalı (örn. `14`)
   - `defaultConfig.versionName`: Yeni sürüm adı (örn. `10.4.0`)
4. `src/views/SettingsView.tsx`:
   - `SETTINGS_ITEMS` içindeki `'Uygulama Hakkında'` dizesi güncellenmeli (örn. `'Maxen v10.4.0'`).

## Kural Prensibi:
- Derleme komutu (`.\gradlew.bat assembleRelease bundleRelease`, `npx vercel --prod` vb.) tetiklenmeden önce sürüm yükseltme adımı otomatik olarak tamamlanmalı ve ilgili dosyalara yansıtılmalıdır.
