export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { imageBase64, imageMime } = req.body;

    if (!imageBase64 || !imageMime) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const buffer = Buffer.from(imageBase64, "base64");

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/umm-maybe/AI-image-detector",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
          "Content-Type": imageMime,
        },
        body: buffer,
      }
    );

    const rawText = await response.text();

    console.log("🔴 HF STATUS:", response.status);
    console.log("🔴 HF RESPONSE:", rawText.substring(0, 300));

    if (!response.ok) {
      if (response.status === 503) {
        return res.status(503).json({ error: "MODEL_LOADING", estimated_time: 20 });
      }
      return res.status(response.status).json({ error: rawText || "Erreur inconnue" });
    }

    if (!rawText || rawText.trim() === "") {
      return res.status(502).json({ error: "Réponse vide du modèle" });
    }

    try {
      const data = JSON.parse(rawText);
      return res.status(200).json(data);
    } catch {
      return res.status(502).json({ error: `Réponse non-JSON : ${rawText}` });
    }

  } catch (err) {
    console.error("API route error:", err);
    return res.status(500).json({ error: err.message });
  }
}
