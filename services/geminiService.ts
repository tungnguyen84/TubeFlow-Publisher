
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

// --- NEW ADVANCED FUNCTIONS ---

// 1. Generate Smart Reply for Comments
export const generateCommentReply = async (commentText: string, tone: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      Act as a YouTube Creator.
      User Comment: "${commentText}"
      Desired Tone: ${tone} (e.g., Funny, Professional, Grateful, Friendly)
      
      Generate 3 distinct, short, and engaging replies to this comment.
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
                        replies: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of 3 replies"
                        }
                    }
                }
            }
        });
        if (response.text) {
             const data = JSON.parse(response.text);
             return data.replies || [];
        }
        return [];
    } catch (e) {
        console.error("AI Reply Error:", e);
        return ["Thanks!", "Great comment!", "Appreciate it!"];
    }
}

// 2. Analyze Thumbnail (Vision)
export const analyzeThumbnail = async (base64Image: string): Promise<{score: number, feedback: string, ctrPrediction: string}> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Convert base64 to parts
    // Remove header if present (data:image/jpeg;base64,...)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const prompt = `
      Analyze this YouTube Thumbnail image.
      1. Rate it from 1-10 based on: Brightness, Text Readability, Face Emotion, and Color Contrast.
      2. Provide 1 sentence of constructive feedback.
      3. Predict CTR Potential (High/Medium/Low).
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Supports multimodal
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        feedback: { type: Type.STRING },
                        ctrPrediction: { type: Type.STRING }
                    }
                }
            }
        });
        
        if (response.text) {
             return JSON.parse(response.text);
        }
        throw new Error("Empty response");
    } catch (e) {
        console.error("Vision AI Error:", e);
        return { score: 0, feedback: "Error analyzing image", ctrPrediction: "Unknown" };
    }
}

// 3. Trend Hunter (Search Grounding)
export const findTrends = async (niche: string): Promise<{topic: string, reason: string}[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using Search Grounding tool
    const prompt = `Find 5 trending topics or news right now related to "${niche}". Explain why it is trending.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }] // Enable Google Search
                // Note: No JSON schema with Google Search usually, but we can try parsing or just return text. 
                // For this implementation, we will ask for JSON in text.
            }
        });

        // Since Grounding might not return perfect JSON when forced, we will extract text and try to parse or return raw.
        // Let's rely on standard text gen with search context.
        return [
            { topic: "Trend Analysis", reason: response.text || "See Google Search results." }
        ];
    } catch (e) {
        return [{ topic: "Error", reason: "Could not fetch trends." }];
    }
}
