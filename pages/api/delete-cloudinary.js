import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { publicId } = req.body;

  if (!publicId) {
    return res.status(400).json({ error: 'publicId requis' });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dfnwxqjey';

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Variables Cloudinary manquantes' });
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = crypto
      .createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const formData = new URLSearchParams();
    formData.append('public_id', publicId);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body: formData }
    );

    const data = await response.json();

    if (data.result === 'ok') {
      return res.status(200).json({ success: true, result: data.result });
    } else {
      return res.status(400).json({ success: false, result: data.result });
    }
  } catch (err) {
    console.error('Erreur suppression Cloudinary:', err);
    return res.status(500).json({ error: err.message });
  }
}
