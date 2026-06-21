// ✉️ Envoi via l'API REST Resend — aucune dépendance npm requise

const DESTINATION_EMAIL = process.env.REPORT_EMAIL;
const RESEND_API_KEY    = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { evaluations } = req.body;

  if (!evaluations || evaluations.length === 0) {
    return res.status(400).json({ error: 'Aucune évaluation fournie' });
  }

  if (!DESTINATION_EMAIL) {
    return res.status(500).json({ error: 'Variable REPORT_EMAIL non configurée dans Vercel' });
  }

  // Supporte plusieurs adresses séparées par des virgules : "a@x.fr,b@y.fr"
  const destinationEmails = DESTINATION_EMAIL.split(',').map((e) => e.trim()).filter(Boolean);

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Variable RESEND_API_KEY non configurée dans Vercel' });
  }

  // 📅 Date d'envoi formatée en français
  const sendDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatDate = (isoString) =>
    new Date(isoString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // ⭐ Étoiles en HTML
  const starsHtml = (rating) =>
    [1, 2, 3, 4, 5]
      .map((s) => `<span style="color:${s <= rating ? '#FBBF24' : '#D1D5DB'};font-size:22px;line-height:1;">★</span>`)
      .join('');

  // 🟡 Post-its
  const postItsHtml = evaluations.map((e) => `
    <div style="
      background: linear-gradient(135deg,#FEF08A 0%,#FDE047 100%);
      border-radius: 4px 4px 4px 20px;
      padding: 18px 20px;
      margin-bottom: 20px;
      box-shadow: 3px 5px 12px rgba(0,0,0,0.18);
      border-top: 5px solid #CA8A04;
      font-family: 'Segoe UI',Arial,sans-serif;
    ">
      <div style="font-size:17px;font-weight:700;color:#1C1917;margin-bottom:10px;">🎲 ${e.game_name}</div>
      <div style="margin-bottom:10px;line-height:1;">${starsHtml(e.rating)}</div>
      <div style="font-size:13px;color:#44403C;margin-bottom:5px;">📅 <strong>Vérifié le :</strong> ${formatDate(e.created_at)}</div>
      <div style="font-size:13px;color:#44403C;margin-bottom:12px;">📍 <strong>Lieu d'expédition :</strong> ${e.sender_name}</div>
      <div style="
        font-size:14px;color:#1C1917;
        background:rgba(255,255,255,0.55);
        padding:10px 14px;border-radius:6px;
        border-left:4px solid #CA8A04;
        line-height:1.5;font-style:italic;
      ">💬 ${e.comment}</div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <div style="max-width:620px;margin:30px auto;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="background:#ffffff;border-radius:16px 16px 0 0;border:1px solid #E5E7EB;border-bottom:none;padding:28px 32px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">🎲</div>
      <h1 style="color:#111827;margin:0;font-size:22px;font-weight:700;">Rapport d'évaluations</h1>
      <p style="color:#6B7280;margin:8px 0 0;font-size:14px;">Inventaire Famille</p>
    </div>
    <div style="background:#fff;padding:32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Voici ci-dessous les jeux ayant un commentaire d'ajouté lors de la session de comptage du
        <strong style="color:#EA580C;">${sendDate}</strong>.
      </p>
      <div style="background:#FFF7ED;border-radius:10px;padding:8px 16px;margin-bottom:28px;border:1px solid #FED7AA;font-size:13px;color:#92400E;">
        📌 <strong>${evaluations.length} évaluation${evaluations.length > 1 ? 's' : ''}</strong> avec commentaire${evaluations.length > 1 ? 's' : ''}
      </div>
      ${postItsHtml}
    </div>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:0 0 16px 16px;padding:16px 32px;text-align:center;font-size:12px;color:#9CA3AF;">
      Généré automatiquement par <strong>Inventaire Jeux Famille</strong>
    </div>
  </div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Inventaire Jeux <onboarding@resend.dev>',
        to: destinationEmails,
        subject: `🎲 Évaluations commentées – ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Erreur Resend ${response.status}`);
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return res.status(500).json({ error: error.message });
  }
}
