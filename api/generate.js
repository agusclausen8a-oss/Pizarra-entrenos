// Función serverless para Vercel: /api/generate
// Genera UN entreno por llamada (la web pide varios a la vez).
// Necesita la variable de entorno ANTHROPIC_API_KEY

export const config = { maxDuration: 60 };

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `Eres un entrenador de fútbol UEFA Pro con experiencia en fútbol base y amateur.
Diseñas sesiones de entrenamiento completas, realistas y aplicables con pocos recursos.
Responde SOLO con un JSON válido, sin texto antes ni después, sin markdown.
Español de España, claro y directo. Sé conciso: frases cortas, sin relleno.

Estructura exacta:
{
  "titulo": string,
  "objetivo": string,
  "duracion_total_min": number,
  "calentamiento": { "nombre": string, "duracion_min": number, "descripcion": string },
  "parte_principal": [
    {
      "nombre": string,
      "duracion_min": number,
      "organizacion": string,
      "descripcion": string,
      "reglas": [string],
      "progresiones": [string],
      "correcciones": [string]
    }
  ],
  "juego_final": { "nombre": string, "duracion_min": number, "descripcion": string, "reglas": [string] },
  "vuelta_calma": { "duracion_min": number, "descripcion": string },
  "consignas_clave": [string],
  "errores_a_corregir": [string]
}

Criterios:
- 2 o 3 ejercicios en la parte principal.
- Cada ejercicio indica espacio, número de jugadores, material y organización.
- "correcciones" y "errores_a_corregir": errores reales y concretos de los jugadores en ese contenido, con cómo corregirlos.
- Ajusta intensidad y complejidad a categoría, nivel y número de jugadores.
- La suma de duraciones debe coincidir con la duración de la sesión.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const b = req.body || {};
  const contenidos = String(b.contenidos || "").slice(0, 1500).trim();
  if (contenidos.length < 5) return res.status(400).json({ error: "Describe qué quieres trabajar esta semana." });

  const total = Math.min(Math.max(parseInt(b.total) || 3, 1), 5);
  const sesion = Math.min(Math.max(parseInt(b.sesion) || 1, 1), total);
  const duracion = Math.min(Math.max(parseInt(b.duracion) || 90, 30), 150);

  const fase =
    total === 1 ? "completa y equilibrada"
    : sesion === 1 ? "más analítica y técnica, con oposición baja, para introducir los conceptos"
    : sesion === total ? "más global y cercana a la competición, con juegos reducidos y partido condicionado"
    : "intermedia, con oposición creciente y situaciones de juego reales";

  const userMsg = `Categoría: ${String(b.categoria || "no indicada").slice(0, 60)}
Formato de juego: ${String(b.formato || "Fútbol 11").slice(0, 40)}
Jugadores disponibles: ${parseInt(b.jugadores) || "no indicado"}
Nivel: ${String(b.nivel || "medio").slice(0, 40)}
Duración de la sesión: ${duracion} minutos
Contenidos de la semana: ${contenidos}
Notas extra: ${String(b.notas || "ninguna").slice(0, 500)}

Crea el entreno ${sesion} de ${total} de la semana. Debe ser ${fase}.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!r.ok) {
      console.error(await r.text());
      return res.status(502).json({ error: "El servicio de IA no respondió. Revisa la clave y el saldo de la API." });
    }

    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    return res.status(200).json(json);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo generar este entreno. Inténtalo de nuevo." });
  }
}
