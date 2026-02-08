
import { GoogleGenAI, Type } from "@google/genai";
import { AIPattern } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateHarmonicPattern(prompt: string): Promise<AIPattern> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a satisfying ball bounce simulation pattern for ${prompt}. 
    Provide exactly 12 balls with velocities that create a mathematical harmonic relationship (like polyrhythms).
    Frequencies should be in Hz (e.g., pentatonic scale notes).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          accentColor: { type: Type.STRING },
          velocities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                vx: { type: Type.NUMBER },
                vy: { type: Type.NUMBER },
                freq: { type: Type.NUMBER },
              },
              required: ["vx", "vy", "freq"]
            }
          }
        },
        required: ["name", "description", "accentColor", "velocities"]
      }
    }
  });

  return JSON.parse(response.text);
}
