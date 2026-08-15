// Esta función corre en el servidor de Netlify, NUNCA en el navegador de la persona.
// La clave de Anthropic vive aquí, como variable de entorno (ANTHROPIC_API_KEY),
// configurada una sola vez por el administrador en el panel de Netlify.
// Ningún usuario de la app puede ver ni acceder a esta clave.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'El administrador todavía no configuró ANTHROPIC_API_KEY en Netlify.' }),
    };
  }

  try {
    const { system, messages } = JSON.parse(event.body);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data?.error?.message || 'Error al conectar con la IA.' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno de la función: ' + err.message }),
    };
  }
};