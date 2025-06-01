export const runtime = 'edge';

export async function POST(req) {
  try {
    const body = await req.json();
    const prompt = body.prompt;

    if (!prompt || prompt.trim() === "") {
      return new Response("Prompt is required", { status: 400 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        stream: true,
        messages: [
          {
            role: "system",
            content: `QuranGPT Pro is an AI tool designed for in-depth Quranic studies...` // your full system prompt here (same as current)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok || !response.body) {
      throw new Error("OpenAI stream failed.");
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n").filter(line => line.trim() !== "");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const json = line.replace("data: ", "");

              if (json === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(json);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  controller.enqueue(encoder.encode(text));
                }
              } catch (err) {
                console.error("Stream parse error:", err);
              }
            }
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    return new Response("Server error", { status: 500 });
  }
}
