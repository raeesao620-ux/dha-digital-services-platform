// Perplexity AI Integration for DHA Ultra AI System
// Referenced from blueprint:perplexity_v0

export interface PerplexitySearchRequest {
  query: string;
  maxTokens?: number;
  temperature?: number;
  searchDomainFilter?: string[];
  searchRecencyFilter?: 'hour' | 'day' | 'week' | 'month' | 'year';
  returnImages?: boolean;
  returnRelatedQuestions?: boolean;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations?: string[];
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexityService {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      console.error('[Perplexity] API key not found in environment variables');
    }
  }

  async search(request: PerplexitySearchRequest): Promise<PerplexityResponse> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key not configured');
    }

    const payload = {
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        {
          role: 'system',
          content: 'You are Ra\'is al Khadir, the elite AI assistant for Queen Raeesa. Provide accurate, comprehensive, and authoritative information with proper citations.'
        },
        {
          role: 'user',
          content: request.query
        }
      ],
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.2,
      top_p: 0.9,
      search_domain_filter: request.searchDomainFilter || [],
      return_images: request.returnImages || false,
      return_related_questions: request.returnRelatedQuestions || false,
      search_recency_filter: request.searchRecencyFilter || 'month',
      top_k: 0,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }

      const data: PerplexityResponse = await response.json();
      
      console.log(`[Perplexity] Search completed - Tokens: ${data.usage?.total_tokens || 0}`);
      
      return data;
    } catch (error) {
      console.error('[Perplexity] Search failed:', error);
      throw error;
    }
  }

  async getFactualAnswer(question: string): Promise<{
    answer: string;
    citations: string[];
    confidence: number;
  }> {
    try {
      const response = await this.search({
        query: question,
        maxTokens: 800,
        temperature: 0.1,
        searchRecencyFilter: 'month',
        returnRelatedQuestions: false,
        returnImages: false
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from Perplexity');
      }

      return {
        answer: choice.message.content,
        citations: response.citations || [],
        confidence: this.calculateConfidence(response)
      };
    } catch (error) {
      console.error('[Perplexity] Failed to get factual answer:', error);
      throw error;
    }
  }

  async searchGovernmentInfo(query: string): Promise<{
    answer: string;
    citations: string[];
    officialSources: string[];
  }> {
    try {
      const response = await this.search({
        query: `South African government official information: ${query}`,
        maxTokens: 1000,
        temperature: 0.1,
        searchDomainFilter: ['gov.za', 'dha.gov.za', 'sars.gov.za'],
        searchRecencyFilter: 'month',
        returnRelatedQuestions: false
      });

      const choice = response.choices[0];
      const citations = response.citations || [];
      const officialSources = citations.filter(url => 
        url.includes('gov.za') || url.includes('dha.gov.za') || url.includes('sars.gov.za')
      );

      return {
        answer: choice.message.content,
        citations,
        officialSources
      };
    } catch (error) {
      console.error('[Perplexity] Failed to search government info:', error);
      throw error;
    }
  }

  private calculateConfidence(response: PerplexityResponse): number {
    // Calculate confidence based on citations and response quality
    const citationCount = response.citations?.length || 0;
    const tokenRatio = response.usage.completion_tokens / response.usage.total_tokens;
    
    let confidence = 0.5; // Base confidence
    
    // More citations = higher confidence
    confidence += Math.min(citationCount * 0.1, 0.3);
    
    // Balanced token ratio indicates good response
    if (tokenRatio > 0.3 && tokenRatio < 0.8) {
      confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }
}

export const perplexityService = new PerplexityService();