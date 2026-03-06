export async function POST(req) {
  try {
    const { imageBase64, imageMime } = await req.json();

    if (!imageBase64 || !imageMime) {
      return Response.json({ error: "Missing image data" }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64, "base64");

    // Primary model: AI vs real image classifier
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

    if (!response.ok) {
      const err = await response.text();
      // Model might be loading (cold start)
      if (response.status === 503) {
        return Response.json({ error: "MODEL_LOADING", estimated_time: 20 }, { status: 503 });
      }
      return Response.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (err) {
    console.error("API route error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
