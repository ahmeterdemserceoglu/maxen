import { NativeModules, Platform } from 'react-native';

const { VoiceRecognition } = NativeModules;

export const startSpeechRecognition = async (): Promise<string> => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      throw new Error('Sesli arama web ortamında başlatılamadı.');
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Tarayıcınız sesli aramayı desteklemiyor. Lütfen Chrome, Edge veya Safari kullanın.');
    }

    return new Promise<string>((resolve, reject) => {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            resolve(transcript);
          } else {
            reject(new Error('Ses anlaşılamadı.'));
          }
        };

        recognition.onerror = (event: any) => {
          reject(new Error(event.error || 'Ses tanıma hatası oluştu.'));
        };

        recognition.start();
      } catch (e: any) {
        reject(new Error(e?.message || 'Mikrofon başlatılamadı.'));
      }
    });
  }

  if (Platform.OS !== 'android') {
    throw new Error('Sesli arama yalnızca Android ve desteklenen Web tarayıcılarında kullanılabilir.');
  }
  if (!VoiceRecognition) {
    throw new Error('Sesli arama modülü yüklenemedi.');
  }
  return await VoiceRecognition.startSpeechRecognition();
};
