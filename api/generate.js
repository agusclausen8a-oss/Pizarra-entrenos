// Función serverless para Vercel: /api/generate
// Necesita la variable de entorno ANTHROPIC_API_KEY (Vercel > Settings > Environment Variables)

export const config = { maxDuration: 60 };

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `Eres un entrenador de fútbol UEFA Pro con experiencia en fútbol base y amateur.
Diseñas semanas de entrenamiento completas, realistas y aplicables en un campo con pocos recursos.
Responde SOLO con un JSON válido, sin texto antes ni después, sin markdown.
Escribe en español de España, con lenguaje claro y directo para un entrenador.

Estructura exacta:
{
  "semana": { "objetivo": string, "enfoque": string },
  "sesiones": [
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
  ]
}

Criterios:
- Las sesiones deben ser distintas entre sí y progresivas a lo largo de la semana (de lo analítico a lo global).
- Cada ejercicio indica espacio, número de jugadores, material y cómo se organiza.
- "correcciones" y "errores_a_corregir" deben ser errores reales y concretos que cometen los jugadores en ese contenido, con cómo corregirlos.
- Ajusta la intensidad y la complejidad a la categoría, nivel y número de jugadores.
- La suma de duraciones debe coincidir con la duración de la sesión.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const b = req.body || {};
  const contenidos = String(b.contenidos || "").slice(0, 1500).trim();
  if (contenidos.length < 5) return res.status(400).json({ error: "Describe qué quieres trabajar esta semana." });

  const entrenos = Math.min(Math.max(parseInt(b.entrenos) || 3, 1), 5);
  const duracion = Math.min(Math.max(parseInt(b.duracion) || 90, 30), 150);

  const userMsg = `Categoría: ${String(b.categoria || "no indicada").slice(0, 60)}
Formato de juego: ${String(b.formato || "Fútbol 11").slice(0, 40)}
Número de jugadores disponibles: ${parseInt(b.jugadores) || "no indicado"}
Nivel: ${String(b.nivel || "medio").slice(0, 40)}
Número de entrenos esta semana: ${entrenos}
Duración de cada entreno: ${duracion} minutos
Esta semana quiero trabajar: ${contenidos}
Notas extra: ${String(b.notas || "ninguna").slice(0, 500)}

Crea los ${entrenos} entrenos completos de la semana.`;

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
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!r.ok) {
      console.error(await r.text());
      return res.status(502).json({ error: "El servicio de IA no respondió. Inténtalo de nuevo." });
    }

    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    return res.status(200).json(json);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo generar la planificación. Inténtalo de nuevo." });
  }
}

