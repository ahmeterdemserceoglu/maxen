export type AvatarPreset = {
  id: string;
  category: string;
  name: string;
  url: string;
};

export const AVATAR_CATEGORIES = [
  'Süper Kahramanlar',
  'Çizgi Karakterler',
  'Robotlar & Bilim Kurgu',
  'Popüler & Eğlence',
] as const;

export const AVATAR_PRESETS: AvatarPreset[] = [
  // Süper Kahramanlar & Maceracılar
  {
    id: 'hero-1',
    category: 'Süper Kahramanlar',
    name: 'Kırmızı Kaptan',
    url: 'https://api.dicebear.com/7.x/adventurer/png?seed=CaptainRed&backgroundColor=b6e3f4,c0aed6,d1d4f9',
  },
  {
    id: 'hero-2',
    category: 'Süper Kahramanlar',
    name: 'Gölce Savaşçı',
    url: 'https://api.dicebear.com/7.x/adventurer/png?seed=ShadowKnight&backgroundColor=ffdfbf,ffd5dc',
  },
  {
    id: 'hero-3',
    category: 'Süper Kahramanlar',
    name: 'Güneş Kahramanı',
    url: 'https://api.dicebear.com/7.x/adventurer/png?seed=SunHero&backgroundColor=c0aed6,b6e3f4',
  },
  {
    id: 'hero-4',
    category: 'Süper Kahramanlar',
    name: 'Elektrik',
    url: 'https://api.dicebear.com/7.x/adventurer/png?seed=ElectricGirl&backgroundColor=d1d4f9,ffd5dc',
  },

  // Çizgi Karakterler & Eğlenceli
  {
    id: 'toon-1',
    category: 'Çizgi Karakterler',
    name: 'Mutlu Kedi',
    url: 'https://api.dicebear.com/7.x/fun-emoji/png?seed=HappyCat&backgroundColor=ffdfbf',
  },
  {
    id: 'toon-2',
    category: 'Çizgi Karakterler',
    name: 'Süper Gülüş',
    url: 'https://api.dicebear.com/7.x/fun-emoji/png?seed=SuperSmile&backgroundColor=b6e3f4',
  },
  {
    id: 'toon-3',
    category: 'Çizgi Karakterler',
    name: 'Havalı Gözlük',
    url: 'https://api.dicebear.com/7.x/fun-emoji/png?seed=CoolShades&backgroundColor=ffd5dc',
  },
  {
    id: 'toon-4',
    category: 'Çizgi Karakterler',
    name: 'Şaşkın Canavar',
    url: 'https://api.dicebear.com/7.x/fun-emoji/png?seed=FunnyMonster&backgroundColor=c0aed6',
  },

  // Robotlar & Bilim Kurgu
  {
    id: 'bot-1',
    category: 'Robotlar & Bilim Kurgu',
    name: 'Neon Bot',
    url: 'https://api.dicebear.com/7.x/bottts/png?seed=NeonBot&backgroundColor=b6e3f4',
  },
  {
    id: 'bot-2',
    category: 'Robotlar & Bilim Kurgu',
    name: 'Kırmızı Siber',
    url: 'https://api.dicebear.com/7.x/bottts/png?seed=RedCyber&backgroundColor=ffd5dc',
  },
  {
    id: 'bot-3',
    category: 'Robotlar & Bilim Kurgu',
    name: 'Altın Mech',
    url: 'https://api.dicebear.com/7.x/bottts/png?seed=GoldMech&backgroundColor=ffdfbf',
  },
  {
    id: 'bot-4',
    category: 'Robotlar & Bilim Kurgu',
    name: 'Galaksi Bot',
    url: 'https://api.dicebear.com/7.x/bottts/png?seed=GalaxyBot&backgroundColor=c0aed6',
  },

  // Popüler & Eğlence
  {
    id: 'pop-1',
    category: 'Popüler & Eğlence',
    name: 'Gamer Kral',
    url: 'https://api.dicebear.com/7.x/big-smile/png?seed=GamerKing&backgroundColor=b6e3f4',
  },
  {
    id: 'pop-2',
    category: 'Popüler & Eğlence',
    name: 'Sinema Tutkunu',
    url: 'https://api.dicebear.com/7.x/big-smile/svg?seed=MovieBuff&backgroundColor=ffd5dc',
  },
  {
    id: 'pop-3',
    category: 'Popüler & Eğlence',
    name: 'Astronot',
    url: 'https://api.dicebear.com/7.x/big-smile/svg?seed=Astronaut&backgroundColor=d1d4f9',
  },
  {
    id: 'pop-4',
    category: 'Popüler & Eğlence',
    name: 'Ninja',
    url: 'https://api.dicebear.com/7.x/big-smile/svg?seed=NinjaMaster&backgroundColor=ffdfbf',
  },
];
