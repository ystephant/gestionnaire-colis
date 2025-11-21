import { useEffect } from 'react';
import '../styles/globals.css';
import { initOneSignal } from '../lib/onesignal';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Initialiser OneSignal
    const username = localStorage.getItem('username');
    if (username) {
      initOneSignal(username);
    }
  }, []);

  return <Component {...pageProps} />;
}
