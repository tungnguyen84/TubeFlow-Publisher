
import { GoogleGenAI, Type } from "@google/genai";

export interface AIMetadataResult {
  titles: string[];
  description: string;
  tags: string[];
  hashtags: string[];
}

// Hàm gợi ý giờ đăng
export const getBestUploadTimes = async (country: string, niche: string): Promise<{timeSlots: string[]} | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Act as a YouTube Analytics Expert.
      Target Audience Country: ${country}
      Channel Niche: ${niche}
      
      Based on global viewing habits and YouTube trends for this demographic and location:
      Identify the 3 BEST distinct time slots (in 24h format HH:MM) to upload Shorts/Videos for maximum reach.
      Return strictly a JSON list.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        timeSlots: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 3 best times, e.g. ['09:00', '14:00', '20:00']"
                        }
                    }
                }
            }
        });
        if (response.text) return JSON.parse(response.text);
        return null;
    } catch (e) {
        console.error("AI Suggest Error:", e);
        return null;
    }
}

export const generateVideoMetadata = async (
  context: string,
  niche: string
): Promise<AIMetadataResult | null> => {
  // Always use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a professional YouTube SEO expert. 
    Context/Topic: ${context}
    Niche: ${niche}

    Please generate metadata for a YouTube video.
    
    1. Provide 5 catchy, SEO-optimized titles (mix of clickbait and search-friendly).
    2. Provide a professional description (approx 150 words) including a hook, main content summary, and a Call to Action (CTA).
    3. Provide 20 relevant tags (comma separated).
    4. Provide 5 relevant hashtags.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 5 optimized titles"
            },
            description: {
              type: Type.STRING,
              description: "Full video description with Hook and CTA"
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 20 relevant tags"
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 5 hashtags including the #"
            }
          },
          required: ["titles", "description", "tags", "hashtags"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIMetadataResult;
    }
    return null;

  } catch (error) {
    console.error("Error generating metadata:", error);
    throw error;
  }
};
