// Google AI Gemini Integration for DHA Ultra AI System  
// Referenced from blueprint:javascript_gemini

import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

// The newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeminiAnalysis {
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface BiometricAnalysis {
  faceDetected: boolean;
  quality: number;
  landmarks: Array<{ x: number; y: number; type: string }>;
  spoofingDetected: boolean;
  recommendation: string;
}

export class GeminiService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      console.error('[Gemini] API key not found in environment variables');
    }
  }

  async summarizeDocument(text: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = `As Ra'is al Khadir, elite AI assistant for Queen Raeesa, provide a comprehensive summary of this DHA document while maintaining all critical information and government-specific terminology:\n\n${text}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return response.text || "Document analysis unavailable";
    } catch (error) {
      console.error('[Gemini] Document summarization failed:', error);
      throw error;
    }
  }

  async analyzeSentiment(text: string): Promise<{ rating: number; confidence: number }> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const systemPrompt = `You are Ra'is al Khadir, analyzing sentiment for Queen Raeesa's DHA system. 
Analyze the sentiment and provide a rating from 1 to 5 stars and confidence score between 0 and 1.
Respond with JSON in this format: {'rating': number, 'confidence': number}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              rating: { type: "number" },
              confidence: { type: "number" },
            },
            required: ["rating", "confidence"],
          },
        },
        contents: text,
      });

      const rawJson = response.text;
      console.log(`[Gemini] Sentiment analysis: ${rawJson}`);

      if (rawJson) {
        const data = JSON.parse(rawJson);
        return {
          rating: Math.max(1, Math.min(5, data.rating)),
          confidence: Math.max(0, Math.min(1, data.confidence))
        };
      } else {
        throw new Error("Empty response from Gemini model");
      }
    } catch (error) {
      console.error('[Gemini] Sentiment analysis failed:', error);
      throw error;
    }
  }

  async analyzeIDDocument(base64Image: string): Promise<{
    documentType: string;
    isValid: boolean;
    extractedData: Record<string, string>;
    confidence: number;
    securityFeatures: string[];
  }> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const contents = [
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      },
      `As Ra'is al Khadir, analyze this South African identity document for Queen Raeesa's DHA system. 
      Extract all visible information, verify security features, and assess document authenticity.
      Focus on: ID number, names, dates, addresses, and any DHA security features visible.
      Return detailed analysis in JSON format with fields: documentType, isValid, extractedData, confidence, securityFeatures.`,
    ];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: contents,
      });

      const analysisText = response.text || "";
      
      // Extract JSON from response if present
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            documentType: parsed.documentType || 'Unknown',
            isValid: parsed.isValid || false,
            extractedData: parsed.extractedData || {},
            confidence: parsed.confidence || 0.5,
            securityFeatures: parsed.securityFeatures || []
          };
        } catch (parseError) {
          console.warn('[Gemini] Failed to parse JSON response, using text analysis');
        }
      }

      // Fallback to text-based analysis
      return {
        documentType: 'South African ID',
        isValid: analysisText.toLowerCase().includes('valid'),
        extractedData: { analysis: analysisText },
        confidence: 0.7,
        securityFeatures: []
      };
    } catch (error) {
      console.error('[Gemini] ID document analysis failed:', error);
      throw error;
    }
  }

  async analyzeBiometricImage(base64Image: string): Promise<BiometricAnalysis> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const contents = [
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      },
      `As Ra'is al Khadir, perform biometric analysis for Queen Raeesa's DHA system:
      1. Detect face presence and quality
      2. Identify key facial landmarks
      3. Assess potential spoofing or fraud
      4. Provide recommendations for biometric enrollment
      
      Return JSON with: faceDetected, quality (0-100), landmarks, spoofingDetected, recommendation`,
    ];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: contents,
      });

      const analysisText = response.text || "";
      
      // Extract JSON from response if present
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            faceDetected: parsed.faceDetected || false,
            quality: Math.max(0, Math.min(100, parsed.quality || 0)),
            landmarks: parsed.landmarks || [],
            spoofingDetected: parsed.spoofingDetected || false,
            recommendation: parsed.recommendation || 'Unable to analyze biometric data'
          };
        } catch (parseError) {
          console.warn('[Gemini] Failed to parse biometric JSON response');
        }
      }

      // Fallback analysis
      const faceDetected = analysisText.toLowerCase().includes('face');
      const highQuality = analysisText.toLowerCase().includes('high quality') || analysisText.toLowerCase().includes('clear');
      
      return {
        faceDetected,
        quality: faceDetected ? (highQuality ? 85 : 60) : 0,
        landmarks: [],
        spoofingDetected: analysisText.toLowerCase().includes('spoof') || analysisText.toLowerCase().includes('fake'),
        recommendation: faceDetected ? 'Face detected - suitable for biometric enrollment' : 'No face detected - retake image required'
      };
    } catch (error) {
      console.error('[Gemini] Biometric analysis failed:', error);
      throw error;
    }
  }

  async generateSecureImage(prompt: string, outputPath: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const securePrompt = `Generate a professional government-grade image for Queen Raeesa's DHA system: ${prompt}. 
      Ensure the image meets official standards with appropriate security features and professional appearance.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: [{ role: "user", parts: [{ text: securePrompt }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No image candidates generated');
      }

      const content = candidates[0].content;
      if (!content || !content.parts) {
        throw new Error('No content parts in response');
      }

      for (const part of content.parts) {
        if (part.text) {
          console.log(`[Gemini] Image generation: ${part.text}`);
        } else if (part.inlineData && part.inlineData.data) {
          const imageData = Buffer.from(part.inlineData.data, "base64");
          fs.writeFileSync(outputPath, imageData);
          console.log(`[Gemini] ✅ Secure image saved: ${outputPath}`);
          return;
        }
      }

      throw new Error('No image data found in response');
    } catch (error) {
      console.error('[Gemini] Image generation failed:', error);
      throw error;
    }
  }

  async analyzeVideo(base64Video: string): Promise<GeminiAnalysis> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const contents = [
      {
        inlineData: {
          data: base64Video,
          mimeType: "video/mp4",
        },
      },
      `As Ra'is al Khadir, analyze this video for Queen Raeesa's DHA system. 
      Identify key elements, security concerns, and any government-relevant information.
      Provide comprehensive analysis with confidence rating.`,
    ];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: contents,
      });

      const content = response.text || "";
      const confidence = content.length > 100 ? 0.8 : 0.5;

      return {
        content,
        confidence,
        metadata: {
          analysisTime: new Date().toISOString(),
          model: "gemini-2.5-pro",
          type: "video_analysis"
        }
      };
    } catch (error) {
      console.error('[Gemini] Video analysis failed:', error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();