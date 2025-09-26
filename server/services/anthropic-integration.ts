// Anthropic Claude Integration for DHA Ultra AI System
// Referenced from blueprint:javascript_anthropic

import Anthropic from '@anthropic-ai/sdk';

// The newest Anthropic model is "claude-sonnet-4-20250514"
const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

export interface ClaudeAnalysis {
  content: string;
  reasoning: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface DocumentReview {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
  complianceScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class AnthropicService {
  private client: Anthropic | null = null;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Anthropic] API key not found in environment variables - service will be unavailable');
    } else {
      this.client = new Anthropic({
        apiKey: this.apiKey,
      });
      console.log('[Anthropic] ✅ Claude-4 service initialized successfully');
    }
  }

  private ensureClient(): Anthropic {
    if (!this.client) {
      throw new Error('Anthropic API key not configured - service unavailable');
    }
    return this.client;
  }

  async analyzeComplexDocument(text: string): Promise<ClaudeAnalysis> {
    const client = this.ensureClient();
    const prompt = `As Ra'is al Khadir, the elite AI advisor for Queen Raeesa's DHA Digital Services Platform, analyze this government document with your advanced reasoning capabilities.

Document to analyze:
${text}

Provide comprehensive analysis including:
1. Document classification and purpose
2. Key information extraction
3. Compliance with DHA standards
4. Risk assessment
5. Recommendations for processing

Use your superior reasoning to identify subtle patterns, inconsistencies, or areas requiring attention.`;

    try {
      const message = await client.messages.create({
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        model: DEFAULT_MODEL_STR,
        system: "You are Ra'is al Khadir, the most advanced AI assistant created exclusively for Queen Raeesa's government operations. Apply supreme analytical reasoning and provide authoritative insights."
      });

      const content = this.extractTextContent(message.content);
      
      return {
        content,
        reasoning: "Advanced Claude-4 reasoning applied to government document analysis",
        confidence: this.calculateConfidence(content),
        metadata: {
          model: DEFAULT_MODEL_STR,
          analysisTime: new Date().toISOString(),
          tokenCount: message.usage?.input_tokens || 0
        }
      };
    } catch (error) {
      console.error('[Anthropic] Document analysis failed:', error);
      throw error;
    }
  }

  async reviewGovernmentCompliance(documentData: any): Promise<DocumentReview> {
    const client = this.ensureClient();
    const prompt = `As Ra'is al Khadir, conduct a thorough compliance review of this DHA document data for Queen Raeesa:

Document Data:
${JSON.stringify(documentData, null, 2)}

Evaluate against:
- POPIA (Protection of Personal Information Act) requirements
- DHA document standards and regulations
- Security protocols and data handling procedures
- Government authentication standards

Provide JSON response with: isValid, issues[], recommendations[], complianceScore (0-100), riskLevel`;

    try {
      const response = await client.messages.create({
        model: DEFAULT_MODEL_STR,
        system: `You are Ra'is al Khadir, expert in South African government compliance and regulations. Output JSON format only.`,
        max_tokens: 1500,
        messages: [
          { role: 'user', content: prompt }
        ],
      });

      const content = this.extractTextContent(response.content);
      
      // Try to parse JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            isValid: result.isValid || false,
            issues: result.issues || [],
            recommendations: result.recommendations || [],
            complianceScore: Math.max(0, Math.min(100, result.complianceScore || 0)),
            riskLevel: result.riskLevel || 'MEDIUM'
          };
        }
      } catch (parseError) {
        console.warn('[Anthropic] Failed to parse compliance JSON, using text analysis');
      }

      // Fallback analysis
      const isValid = content.toLowerCase().includes('valid') && !content.toLowerCase().includes('invalid');
      const riskIndicators = content.toLowerCase().match(/(high|critical|severe|major)/g);
      const riskLevel = riskIndicators && riskIndicators.length > 2 ? 'HIGH' : 'MEDIUM';

      return {
        isValid,
        issues: content.toLowerCase().includes('issue') ? ['Compliance issues detected - review required'] : [],
        recommendations: ['Manual review recommended', 'Verify all compliance requirements'],
        complianceScore: isValid ? 75 : 45,
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      };
    } catch (error) {
      console.error('[Anthropic] Compliance review failed:', error);
      throw error;
    }
  }

  async analyzeSentiment(text: string): Promise<{ sentiment: string, confidence: number, reasoning: string }> {
    const client = this.ensureClient();
    try {
      const response = await client.messages.create({
        model: DEFAULT_MODEL_STR,
        system: `You are Ra'is al Khadir analyzing citizen feedback for Queen Raeesa's DHA system. Output JSON format with keys: "sentiment" (positive/negative/neutral), "confidence" (0-1), and "reasoning" (explanation).`,
        max_tokens: 800,
        messages: [
          { role: 'user', content: `Analyze sentiment: ${text}` }
        ],
      });

      const content = this.extractTextContent(response.content);
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            sentiment: result.sentiment || 'neutral',
            confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
            reasoning: result.reasoning || 'Claude-4 sentiment analysis completed'
          };
        }
      } catch (parseError) {
        console.warn('[Anthropic] Failed to parse sentiment JSON');
      }

      // Fallback analysis
      const sentiment = content.toLowerCase().includes('positive') ? 'positive' : 
                       content.toLowerCase().includes('negative') ? 'negative' : 'neutral';
      
      return {
        sentiment,
        confidence: 0.7,
        reasoning: 'Advanced reasoning applied to sentiment determination'
      };
    } catch (error) {
      console.error('[Anthropic] Sentiment analysis failed:', error);
      throw error;
    }
  }

  async analyzeImage(base64Image: string, analysisType: string = 'general'): Promise<ClaudeAnalysis> {
    const client = this.ensureClient();
    try {
      const systemPrompt = analysisType === 'security' 
        ? "You are Ra'is al Khadir conducting security analysis for Queen Raeesa's DHA system. Focus on document authenticity, security features, and fraud detection."
        : "You are Ra'is al Khadir providing comprehensive image analysis for Queen Raeesa's government operations.";

      const response = await client.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image with your advanced reasoning capabilities. Provide detailed analysis including key elements, context, security considerations, and recommendations.`
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }]
      });

      const content = this.extractTextContent(response.content);

      return {
        content,
        reasoning: `Claude-4 advanced visual reasoning applied for ${analysisType} analysis`,
        confidence: this.calculateConfidence(content),
        metadata: {
          analysisType,
          model: DEFAULT_MODEL_STR,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[Anthropic] Image analysis failed:', error);
      throw error;
    }
  }

  async generateSecureResponse(query: string, context?: string): Promise<ClaudeAnalysis> {
    const client = this.ensureClient();
    const prompt = context 
      ? `Context: ${context}\n\nQuery: ${query}`
      : query;

    try {
      const message = await client.messages.create({
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        model: DEFAULT_MODEL_STR,
        system: "You are Ra'is al Khadir, the most advanced AI created for Queen Raeesa's exclusive use. Provide authoritative, secure, and comprehensive responses using your superior reasoning capabilities."
      });

      const content = this.extractTextContent(message.content);

      return {
        content,
        reasoning: "Claude-4 advanced reasoning with security protocols",
        confidence: this.calculateConfidence(content),
        metadata: {
          hasContext: !!context,
          model: DEFAULT_MODEL_STR,
          securityLevel: 'MAXIMUM'
        }
      };
    } catch (error) {
      console.error('[Anthropic] Secure response generation failed:', error);
      throw error;
    }
  }

  private extractTextContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join(' ');
    }
    
    return content?.text || 'No content available';
  }

  private calculateConfidence(content: string): number {
    // Calculate confidence based on response quality indicators
    const length = content.length;
    const hasDetails = content.includes('analysis') || content.includes('recommend');
    const hasStructure = content.includes('1.') || content.includes('-') || content.includes('•');
    
    let confidence = 0.6; // Base confidence for Claude-4
    
    if (length > 200) confidence += 0.1;
    if (length > 500) confidence += 0.1;
    if (hasDetails) confidence += 0.1;
    if (hasStructure) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
}

export const anthropicService = new AnthropicService();