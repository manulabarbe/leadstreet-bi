const ALLOWED_ORIGIN = "https://manulabarbe.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only POST allowed
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    // Block requests from other origins
    if (origin && origin !== ALLOWED_ORIGIN) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const { prompt } = await request.json();
      if (!prompt || typeof prompt !== "string") {
        return Response.json({ error: "Missing prompt" }, { status: 400, headers: corsHeaders(origin) });
      }

      // Call Anthropic API
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error("Anthropic API error:", anthropicRes.status, errText);
        return Response.json(
          { error: "AI service error" },
          { status: 502, headers: corsHeaders(origin) }
        );
      }

      const result = await anthropicRes.json();
      const answer = result.content?.[0]?.text || "No response generated.";

      return Response.json({ answer }, { headers: corsHeaders(origin) });
    } catch (err) {
      console.error("Worker error:", err);
      return Response.json(
        { error: "Internal error" },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
  },
};
