#!/usr/bin/env bash

# Waydroid & Maxen Kararlı Yönetim Betiği

case "$1" in
  start)
    echo "▶ Waydroid başlatılıyor..."
    systemd-run --user --unit=waydroid-session waydroid session start
    sleep 3
    waydroid status
    ;;
  stop)
    echo "⏹ Waydroid durduruluyor..."
    waydroid session stop
    ;;
  restart)
    echo "🔄 Waydroid yeniden başlatılıyor..."
    waydroid session stop
    sleep 1
    systemd-run --user --unit=waydroid-session waydroid session start
    sleep 3
    waydroid status
    ;;
  app)
    echo "📱 Maxen açılıyor..."
    waydroid app launch com.maxen.app
    ;;
  ui)
    echo "🖥 Tam Android ekranı açılıyor..."
    waydroid show-full-ui
    ;;
  tablet)
    echo "📐 Tablet / Geniş Ekran modu (1000x600 - hem gezinme hem video için ideal) ayarlanıyor..."
    waydroid prop set persist.waydroid.multi_windows false
    waydroid prop set persist.waydroid.width 1000
    waydroid prop set persist.waydroid.height 600
    waydroid session stop
    sleep 1
    systemd-run --user --unit=waydroid-session waydroid session start
    sleep 3
    waydroid app launch com.maxen.app
    echo "✔ Tablet modu aktif."
    ;;
  portrait)
    echo "📐 Telefon Dikey modu (500x880) ayarlanıyor..."
    waydroid prop set persist.waydroid.multi_windows false
    waydroid prop set persist.waydroid.width 500
    waydroid prop set persist.waydroid.height 880
    waydroid session stop
    sleep 1
    systemd-run --user --unit=waydroid-session waydroid session start
    sleep 3
    waydroid app launch com.maxen.app
    echo "✔ Telefon dikey mod aktif."
    ;;
  landscape)
    echo "📐 Büyük Yatay mod (1280x720) ayarlanıyor..."
    waydroid prop set persist.waydroid.multi_windows false
    waydroid prop set persist.waydroid.width 1280
    waydroid prop set persist.waydroid.height 720
    waydroid session stop
    sleep 1
    systemd-run --user --unit=waydroid-session waydroid session start
    sleep 3
    waydroid app launch com.maxen.app
    echo "✔ Büyük yatay mod aktif."
    ;;
  fullscreen)
    echo "📺 Tam Ekran modu (Monitörünüzün tam çözünürlüğü) ayarlanıyor..."
    waydroid prop set persist.waydroid.multi_windows false
    waydroid prop set persist.waydroid.width ""
    waydroid prop set persist.waydroid.height ""
    waydroid session stop
    sleep 1
    systemd-run --user --unit=waydroid-session waydroid session start
    sleep 3
    waydroid app launch com.maxen.app
    echo "✔ Tam Ekran modu aktif."
    ;;
  status)
    waydroid status
    ;;
  *)
    echo "Kullanım: ./waydroid-manager.sh [komut]"
    echo ""
    echo "Komutlar:"
    echo "  fullscreen - Monitörün tamamını kaplayan gerçek Tam Ekran"
    echo "  tablet     - Tablet / Geniş ekran (1000x600 - hem film hem gezinme için en iyisi)"
    echo "  portrait   - Dikey telefon modu (500x880)"
    echo "  landscape  - Büyük yatay mod (1280x720)"
    echo "  app        - Maxen uygulamasını açar"
    echo "  ui         - Tam Android arayüzünü (Full UI) açar"
    echo "  restart    - Oturumu yeniden başlatır"
    echo "  stop       - Oturumu durdurur"
    echo "  status     - Anlık durumu gösterir"
    ;;
esac
