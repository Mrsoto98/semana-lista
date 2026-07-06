import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.semanalista.app',
  appName: 'Semana Lista',
  webDir: 'dist',
  plugins: {
    AdMob: {
      // IDs de prueba — reemplazar con los reales cuando tengas la cuenta AdMob
      appId: 'ca-app-pub-3940256099942544~3347511713', // TEST ID Android
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
