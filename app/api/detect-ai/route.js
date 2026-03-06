export async function POST(req) {
  try {
    const { imageBase64, imageMime } = await req.json();

    if (!imageBase64 || !imageMime) {
      return Response.json({ error: "Missing image data" }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64, "base64");

    const response = await fetch(
      "https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
          "Content-Type": imageMime,
        },
        body: buffer,
      }
    );

    // Lire le corps brut d'abord
    const rawText = await response.text();

    if (!response.ok) {
      if (response.status === 503) {
        return Response.json(
          { error: "MODEL_LOADING", estimated_time: 20 },
          { status: 503 }
        );
      }
      return Response.json(
        { error: rawText || "Erreur inconnue" },
        { status: response.status }
      );
    }

    // Vérifier que la réponse n'est pas vide avant de parser
    if (!rawText || rawText.trim() === "") {
      return Response.json(
        { error: "Réponse vide du modèle" },
        { status: 502 }
      );
    }

    try {
      const data = JSON.parse(rawText);
      return Response.json(data);
    } catch {
      return Response.json(
        { error: `Réponse non-JSON : ${rawText}` },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("API route error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
