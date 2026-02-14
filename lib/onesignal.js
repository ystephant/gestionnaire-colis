// lib/onesignal.js
import OneSignal from 'react-onesignal';

export async function initOneSignal(userId) {
  try {
    await OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: {
        enable: false, // On gère nous-mêmes les permissions
      },
      serviceWorkerParam: {
        scope: '/'
      },
      serviceWorkerPath: '/OneSignalSDKWorker.js'
    });

    console.log('✅ OneSignal initialisé');

    // 🔥 Login propre v16 (évite les 409 Conflict)
if (userId) {
  const externalId = userId.toString();

  const currentUser = await OneSignal.getUser();

  if (currentUser?.externalId !== externalId) {
    await OneSignal.logout();
    await OneSignal.login(externalId);
    console.log('✅ User login propre:', externalId);
  }
}

    // Demander la permission
    const permission = await OneSignal.isPushNotificationsEnabled();
    if (!permission) {
      await OneSignal.showNativePrompt();
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur OneSignal:', error);
    return false;
  }
}

export async function sendNotification(userIds, title, message, data = {}) {
  try {
    const response = await fetch('/api/send-onesignal-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: Array.isArray(userIds) ? userIds : [userIds],
        title,
        message,
        data
      })
    });

    const result = await response.json();
    console.log('📤 Notification envoyée:', result);
    return result;
  } catch (error) {
    console.error('❌ Erreur envoi notification:', error);
    return null;
  }
}
