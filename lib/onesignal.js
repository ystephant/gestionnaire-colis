// lib/onesignal.js
import OneSignal from 'react-onesignal';

/**
 * Initialise OneSignal avec gestion multi-appareils et login forcé
 * @param {string|number} userId - identifiant unique de l'utilisateur
 * @returns {Promise<boolean>}
 */
export async function initOneSignal(userId) {
  try {
    await OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: false }, // On gère nous-mêmes les permissions
      serviceWorkerParam: { scope: '/' },
      serviceWorkerPath: '/OneSignalSDKWorker.js'
    });

    console.log('✅ OneSignal initialisé');

    if (userId) {
      const externalId = String(userId);

      // 🔥 Logout pour éviter les conflits 409
      //await OneSignal.logout().catch(() => {});
      await OneSignal.login(externalId);
      console.log('✅ OneSignal login forcé:', externalId);
    }

    // Demander la permission si elle n'est pas encore accordée
    const permission = await OneSignal.isPushNotificationsEnabled();
    if (!permission) {
      console.log('📌 Permission push non accordée, prompt affiché...');
      await OneSignal.showNativePrompt();
    } else {
      console.log('📌 Permission push déjà accordée');
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur OneSignal init:', error);
    return false;
  }
}

/**
 * Envoie une notification via notre API serveur
 * @param {string[]|string} userIds - liste d'external_user_ids
 * @param {string} title - titre de la notification
 * @param {string} message - contenu de la notification
 * @param {object} data - payload additionnel
 */
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
    if (result.error) {
      console.error('❌ Erreur API notification:', result);
    } else {
      console.log('📤 Notification envoyée avec succès:', result);
    }

    return result;
  } catch (error) {
    console.error('❌ Erreur envoi notification:', error);
    return null;
  }
}

/**
 * Déconnecte le device actuel de OneSignal (utile pour changer d'utilisateur)
 */
export async function logoutOneSignal() {
  try {
    await OneSignal.logout();
    console.log('✅ OneSignal logout effectué');
  } catch (error) {
    console.error('❌ Erreur logout OneSignal:', error);
  }
}
