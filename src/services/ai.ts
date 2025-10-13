import { AITaggingResult, AIConfig } from '@/types';

class AIService {
  private config: AIConfig | null = null;

  async init(config: AIConfig): Promise<void> {
    this.config = config;
  }

  async processContent(content: string, type: 'text' | 'image' | 'page'): Promise<AITaggingResult> {
    if (!this.config?.enabled) {
      return this.getDefaultResult(content, type);
    }

    try {
      // Check if we're in a service worker context (no window object)
      const isServiceWorker = typeof window === 'undefined';
      
      // Always use local processing in service worker context
      if (isServiceWorker) {
        console.log('Using local processing in service worker context');
        return await this.processLocally(content, type);
      }
      
      // Only try OpenAI in non-service worker contexts
      if (this.config.provider === 'openai' && this.config.apiKey) {
        try {
          return await this.processWithOpenAI(content, type);
        } catch (error) {
          console.error('OpenAI processing failed, falling back to local processing:', error);
          return await this.processLocally(content, type);
        }
      } else {
        // Default to local processing
        return await this.processLocally(content, type);
      }
    } catch (error) {
      console.error('AI processing failed:', error);
      return this.getDefaultResult(content, type);
    }
  }

  private async processWithOpenAI(content: string, type: string): Promise<AITaggingResult> {
    if (!this.config?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Double-check we're not in a service worker context
    if (typeof window === 'undefined') {
      console.log('OpenAI processing skipped in service worker context');
      return this.processLocally(content, type);
    }

    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: this.config.apiKey,
        dangerouslyAllowBrowser: true,
      });

      const prompt = this.buildPrompt(content, type);
      
      const response = await openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that categorizes and tags content. Return a JSON response with summary, tags (array), category (string), and confidence (number 0-1).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      try {
        const parsed = JSON.parse(result);
        return {
          summary: parsed.summary || this.generateSummary(content),
          tags: Array.isArray(parsed.tags) ? parsed.tags : this.generateTags(content),
          category: parsed.category || this.categorizeContent(content, type),
          confidence: parsed.confidence || 0.8
        };
      } catch {
        return this.getDefaultResult(content, type);
      }
    } catch (error) {
      console.error('OpenAI processing failed, falling back to local processing:', error);
      return this.processLocally(content, type);
    }
  }

  private async processLocally(content: string, type: string): Promise<AITaggingResult> {
    // Local processing using simple heuristics
    // In a real implementation, you might use TensorFlow.js or ONNX
    return {
      summary: this.generateSummary(content),
      tags: this.generateTags(content),
      category: this.categorizeContent(content, type),
      confidence: 0.6
    };
  }

  private buildPrompt(content: string, type: string): string {
    const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
    
    return `Analyze this ${type} content and provide categorization:

Content: "${truncatedContent}"

Please provide:
1. A brief summary (1-2 sentences)
2. 3-5 relevant tags
3. A category (e.g., "Technology", "News", "Tutorial", "Documentation", "Blog", "Research", "Shopping", "Entertainment", "Education", "Other")
4. Confidence score (0-1)

Format as JSON.`;
  }

  private generateSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const firstSentence = sentences[0]?.trim();
    const secondSentence = sentences[1]?.trim();
    
    if (firstSentence && secondSentence) {
      return `${firstSentence}. ${secondSentence}.`;
    } else if (firstSentence) {
      return `${firstSentence}.`;
    } else {
      return content.substring(0, 100) + (content.length > 100 ? '...' : '');
    }
  }

  private generateTags(content: string): string[] {
    const tags: string[] = [];
    const text = content.toLowerCase();
    
    // Simple keyword-based tagging
    const keywordMap: Record<string, string[]> = {
      'javascript': ['javascript', 'js', 'programming'],
      'react': ['react', 'frontend', 'javascript'],
      'python': ['python', 'programming', 'backend'],
      'tutorial': ['tutorial', 'guide', 'how-to'],
      'news': ['news', 'current events', 'breaking'],
      'technology': ['tech', 'technology', 'innovation'],
      'design': ['design', 'ui', 'ux', 'visual'],
      'business': ['business', 'startup', 'entrepreneur'],
      'science': ['science', 'research', 'study'],
      'education': ['education', 'learning', 'course']
    };

    for (const [category, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        tags.push(category);
      }
    }

    // Add content type tags
    if (text.includes('http') || text.includes('www')) {
      tags.push('web');
    }
    if (text.includes('code') || text.includes('function') || text.includes('class')) {
      tags.push('code');
    }
    if (text.includes('image') || text.includes('photo') || text.includes('picture')) {
      tags.push('image');
    }

    return tags.length > 0 ? tags.slice(0, 5) : ['general'];
  }

  private categorizeContent(content: string, type: string): string {
    const text = content.toLowerCase();
    
    if (type === 'image') return 'Media';
    if (text.includes('tutorial') || text.includes('guide') || text.includes('how to')) return 'Tutorial';
    if (text.includes('news') || text.includes('breaking') || text.includes('update')) return 'News';
    if (text.includes('code') || text.includes('programming') || text.includes('development')) return 'Technology';
    if (text.includes('research') || text.includes('study') || text.includes('analysis')) return 'Research';
    if (text.includes('shopping') || text.includes('buy') || text.includes('price')) return 'Shopping';
    if (text.includes('entertainment') || text.includes('fun') || text.includes('game')) return 'Entertainment';
    
    return 'General';
  }

  private getDefaultResult(content: string, type: string): AITaggingResult {
    return {
      summary: this.generateSummary(content),
      tags: this.generateTags(content),
      category: this.categorizeContent(content, type),
      confidence: 0.5
    };
  }
}

export const aiService = new AIService();
