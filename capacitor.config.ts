import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.semanalista.app',
  appName: 'Semana Lista',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-4112362316379237~9605712649',
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0a0f1a',
  },
  server: {
    // En producción usa la URL de Vercel para que Supabase funcione
    // url: 'https://semana-lista.vercel.app',
    // androidScheme: 'https',
  },
};

export default config;
