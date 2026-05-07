export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { messages, system, image } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ text: 'Clé API manquante dans Vercel.' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let finalMessages = messages || [];
    if (image && finalMessages.length > 0) {
      const lastMsg = finalMessages[finalMessages.length - 1];
      finalMessages = [
        ...finalMessages.slice(0, -1),
        {
          role: lastMsg.role,
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mediaType || 'image/jpeg',
                data: image.data,
              },
            },
            { type: 'text', text: lastMsg.content },
          ],
        },
      ];
    }

    const payload = {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: finalMessages,
    };
    if (system) payload.system = system;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        text: `Erreur ${response.status}: ${data.error?.message || JSON.stringify(data)}`
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const text = data.content?.find(b => b.type === 'text')?.text || 'Pas de réponse.';

    return new Response(JSON.stringify({ text }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ text: `Erreur serveur: ${err.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
