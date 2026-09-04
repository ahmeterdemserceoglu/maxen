import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// .env dosyasindan API Key'i oku
const envPath = path.join(process.cwd(), '.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/EXPO_PUBLIC_FIREBASE_API_KEY=(.*)/);
  if (match) {
    apiKey = match[1].trim();
  }
}

if (!apiKey) {
  console.error("HATA: .env dosyasinda EXPO_PUBLIC_FIREBASE_API_KEY bulunamadi!");
  process.exit(1);
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: 'fiskos-e1baa.firebaseapp.com',
  projectId: 'fiskos-e1baa',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  console.log('=============================================');
  console.log('      MAXEN - FRAGMAN / SHORTS EKLEME        ');
  console.log('=============================================\n');
  
  console.log('Veritabanina yazma izni icin giris yapmaniz gerekiyor.');
  const email = await ask('Email: ');
  const password = await ask('Sifre: ');
  
  console.log('\nGiris yapiliyor...');
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password.trim());
    console.log('✅ Giris basarili!\n');
  } catch (error) {
    console.error('❌ Giris basarisiz:', error.message);
    process.exit(1);
  }

  const url = await ask('1. Video URL (YouTube veya IMDb linki): ');
  if (!url.trim()) {
    console.log('HATA: URL bos olamaz!');
    process.exit(1);
  }

  const tmdbId = await ask('2. TMDB ID (Film/Dizi idsi, baglamak istemiyorsaniz bos birakin): ');
  
  const isVerticalStr = await ask('3. Video dikey mi? (Yatay ise H yazin) [E/h]: ');
  const isVertical = isVerticalStr.trim().toLowerCase() === 'h' ? false : true;

  console.log('\nKaydediliyor, lutfen bekleyin...');

  try {
    const docData = {
      youtubeUrl: url.trim(),
      tmdbId: tmdbId.trim() ? tmdbId.trim() : null,
      isVertical: isVertical,
      createdAt: serverTimestamp(),
    };
    
    if (!tmdbId.trim()) {
      docData.title = 'Özel Fragman';
    }

    const docRef = await addDoc(collection(db, 'shorts'), docData);
    console.log(`\n✅ BASARILI! Fragman eklendi.`);
    console.log(`Dokuman ID: ${docRef.id}`);
  } catch (error) {
    console.error('\n❌ HATA OLUSTU:', error.message);
  }
  
  console.log('\n=============================================');
  rl.close();
  process.exit(0);
}

main();
