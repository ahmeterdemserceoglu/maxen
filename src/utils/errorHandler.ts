import { Alert } from 'react-native';

export const setupGlobalErrorHandlers = () => {
  // React Native's ErrorUtils handles global JavaScript errors.
  const defaultErrorHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.error('Global Error Caught:', error, 'Fatal:', isFatal);

    // TODO: Burada Sentry, Firebase Crashlytics gibi araçlara hatayı loglayabilirsiniz.

    if (isFatal && !__DEV__) {
      Alert.alert(
        'Beklenmeyen Bir Hata Oluştu',
        'Uygulama çalışmaya devam edemiyor. Lütfen uygulamayı yeniden başlatın.',
        [{ text: 'Tamam' }]
      );
    }

    // Geliştirme ortamında RedBox göstermeye devam etmesi için default handler'ı çağırın
    if (__DEV__) {
      defaultErrorHandler(error, isFatal);
    }
  });

  // Modern React Native / Hermes ortamlarında Promise rejection takibi
  const rejectionTracking = require('promise/setimmediate/rejection-tracking');
  if (rejectionTracking && rejectionTracking.enable) {
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (id: string, error: any) => {
        console.warn('Unhandled Promise Rejection (ID: ' + id + '):', error);
        // Hata takip servislerine bildirilebilir
      },
      onHandled: (id: string) => {
        console.warn('Promise Rejection Handled (ID: ' + id + ')');
      },
    });
  }
};
