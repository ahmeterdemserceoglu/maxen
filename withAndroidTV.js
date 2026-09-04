const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidTV(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest['uses-feature']) {
      androidManifest['uses-feature'] = [];
    }

    const features = androidManifest['uses-feature'];

    // Android TV'lerde dokunmatik ekran zorunluluğunu kaldırıyoruz
    const hasTouchscreen = features.find(
      (f) => f.$['android:name'] === 'android.hardware.touchscreen'
    );
    if (!hasTouchscreen) {
      features.push({
        $: {
          'android:name': 'android.hardware.touchscreen',
          'android:required': 'false',
        },
      });
    } else {
      hasTouchscreen.$['android:required'] = 'false';
    }

    // Leanback (TV arayüzü) özelliğini ekliyoruz (hem mobil hem TV için required false yapıyoruz)
    const hasLeanback = features.find(
      (f) => f.$['android:name'] === 'android.software.leanback'
    );
    if (!hasLeanback) {
      features.push({
        $: {
          'android:name': 'android.software.leanback',
          'android:required': 'false',
        },
      });
    } else {
      hasLeanback.$['android:required'] = 'false';
    }

    return config;
  });
};
