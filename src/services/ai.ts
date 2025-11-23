import { AITaggingResult, AIConfig, StudyNotes } from '@/types'

class AIService {
  private config: AIConfig | null = null

  async init(config: AIConfig): Promise<void> {
    this.config = config
  }

  async processContent(
    content: string,
    type: 'text' | 'image' | 'page'
  ): Promise<AITaggingResult> {
    console.log('🔍 AI Processing started:', {
      enabled: this.config?.enabled,
      provider: this.config?.provider,
      hasApiKey: !!this.config?.apiKey,
      contentType: type,
      contentLength: content.length
    })

    if (!this.config?.enabled) {
      console.log('⚠️ AI processing disabled, using default result')
      return this.getDefaultResult(content, type)
    }

    try {
      // Check if we're in a service worker context (no window object)
      const isServiceWorker = typeof window === 'undefined'
      console.log('🌐 Context check:', { isServiceWorker })

      // Always use local processing in service worker context
      if (isServiceWorker) {
        console.log('⚠️ Using local processing in service worker context')
        return await this.processLocally(content, type)
      }

      // Only try OpenAI in non-service worker contexts
      if (this.config.provider === 'openai' && this.config.apiKey) {
        console.log('🤖 Attempting OpenAI processing...')
        try {
          return await this.processWithOpenAI(content, type)
        } catch (error) {
          console.error(
            '❌ OpenAI processing failed, falling back to local processing:',
            error
          )
          return await this.processLocally(content, type)
        }
      } else {
        console.log('🏠 Using local processing (provider:', this.config?.provider, ')')
        return await this.processLocally(content, type)
      }
    } catch (error) {
      console.error('❌ AI processing failed:', error)
      return this.getDefaultResult(content, type)
    }
  }

  private async processWithOpenAI(
    content: string,
    type: string
  ): Promise<AITaggingResult> {
    console.log('🤖 OpenAI processing started for content type:', type)
    
    if (!this.config?.apiKey) {
      console.error('❌ OpenAI API key not configured')
      throw new Error('OpenAI API key not configured')
    }

    // Double-check we're not in a service worker context
    if (typeof window === 'undefined') {
      console.log('⚠️ OpenAI processing skipped in service worker context')
      return this.processLocally(content, type)
    }

    try {
      console.log('📡 Loading OpenAI library...')
      const { OpenAI } = await import('openai')
      const openai = new OpenAI({
        apiKey: this.config.apiKey,
        dangerouslyAllowBrowser: true,
      })

      const prompt = this.buildPrompt(content, type)
      console.log('📝 Sending request to OpenAI API...', {
        model: this.config.model || 'gpt-3.5-turbo',
        contentLength: content.length,
        promptLength: prompt.length
      })

      const response = await openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI assistant that categorizes and tags content. Return a JSON response with summary, tags (array), category (string), and confidence (number 0-1).',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      })

      const result = response.choices[0]?.message?.content
      console.log('✅ OpenAI API response received:', {
        hasResult: !!result,
        resultLength: result?.length || 0,
        usage: response.usage
      })
      
      if (!result) {
        console.error('❌ No response from OpenAI')
        throw new Error('No response from OpenAI')
      }

      try {
        const parsed = JSON.parse(result)
        console.log('🎯 OpenAI processing successful:', {
          summary: parsed.summary?.substring(0, 50) + '...',
          tags: parsed.tags,
          category: parsed.category,
          confidence: parsed.confidence
        })
        
        return {
          summary: parsed.summary || this.generateSummary(content),
          tags: Array.isArray(parsed.tags)
            ? parsed.tags
            : this.generateTags(content),
          category: parsed.category || this.categorizeContent(content, type),
          confidence: parsed.confidence || 0.8,
        }
      } catch (parseError) {
        console.error('❌ Failed to parse OpenAI response:', parseError)
        return this.getDefaultResult(content, type)
      }
    } catch (error) {
      console.error(
        '❌ OpenAI processing failed, falling back to local processing:',
        error
      )
      return this.processLocally(content, type)
    }
  }

  private async processLocally(
    content: string,
    type: string
  ): Promise<AITaggingResult> {
    // Local processing using simple heuristics
    // In a real implementation, you might use TensorFlow.js or ONNX
    return {
      summary: this.generateSummary(content),
      tags: this.generateTags(content),
      category: this.categorizeContent(content, type),
      confidence: 0.6,
    }
  }

  private buildPrompt(content: string, type: string): string {
    const truncatedContent =
      content.length > 2000 ? content.substring(0, 2000) + '...' : content

    return `Analyze this ${type} content and provide categorization:

Content: "${truncatedContent}"

Please provide:
1. A brief summary (1-2 sentences)
2. 3-5 relevant tags
3. A category (e.g., "Technology", "News", "Tutorial", "Documentation", "Blog", "Research", "Shopping", "Entertainment", "Education", "Other")
4. Confidence score (0-1)

Format as JSON.`
  }

  private generateSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const firstSentence = sentences[0]?.trim()
    const secondSentence = sentences[1]?.trim()

    if (firstSentence && secondSentence) {
      return `${firstSentence}. ${secondSentence}.`
    } else if (firstSentence) {
      return `${firstSentence}.`
    } else {
      return content.substring(0, 100) + (content.length > 100 ? '...' : '')
    }
  }

  private generateTags(content: string): string[] {
    const tags: string[] = []
    const text = content.toLowerCase()

    // Simple keyword-based tagging
    const keywordMap: Record<string, string[]> = {
      javascript: ['javascript', 'js', 'programming'],
      react: ['react', 'frontend', 'javascript'],
      python: ['python', 'programming', 'backend'],
      tutorial: ['tutorial', 'guide', 'how-to'],
      news: ['news', 'current events', 'breaking'],
      technology: ['tech', 'technology', 'innovation'],
      design: ['design', 'ui', 'ux', 'visual'],
      business: ['business', 'startup', 'entrepreneur'],
      science: ['science', 'research', 'study'],
      education: ['education', 'learning', 'course'],
    }

    for (const [category, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        tags.push(category)
      }
    }

    // Add content type tags
    if (text.includes('http') || text.includes('www')) {
      tags.push('web')
    }
    if (
      text.includes('code') ||
      text.includes('function') ||
      text.includes('class')
    ) {
      tags.push('code')
    }
    if (
      text.includes('image') ||
      text.includes('photo') ||
      text.includes('picture')
    ) {
      tags.push('image')
    }

    return tags.length > 0 ? tags.slice(0, 5) : ['general']
  }

  private categorizeContent(content: string, type: string): string {
    const text = content.toLowerCase()

    if (type === 'image') return 'Media'
    if (
      text.includes('tutorial') ||
      text.includes('guide') ||
      text.includes('how to')
    )
      return 'Tutorial'
    if (
      text.includes('news') ||
      text.includes('breaking') ||
      text.includes('update')
    )
      return 'News'
    if (
      text.includes('code') ||
      text.includes('programming') ||
      text.includes('development')
    )
      return 'Technology'
    if (
      text.includes('research') ||
      text.includes('study') ||
      text.includes('analysis')
    )
      return 'Research'
    if (
      text.includes('shopping') ||
      text.includes('buy') ||
      text.includes('price')
    )
      return 'Shopping'
    if (
      text.includes('entertainment') ||
      text.includes('fun') ||
      text.includes('game')
    )
      return 'Entertainment'

    return 'General'
  }

  private getDefaultResult(content: string, type: string): AITaggingResult {
    return {
      summary: this.generateSummary(content),
      tags: this.generateTags(content),
      category: this.categorizeContent(content, type),
      confidence: 0.5,
    }
  }

  async generateStudyNotes(
    content: string,
    type: 'text' | 'image' | 'page',
    detailLevel: 'brief' | 'detailed' | 'bullets' = 'detailed'
  ): Promise<StudyNotes> {
    console.log('📝 Generating study notes:', {
      enabled: this.config?.enabled,
      provider: this.config?.provider,
      hasApiKey: !!this.config?.apiKey,
      contentType: type,
      detailLevel,
      contentLength: content.length
    })

    if (!this.config?.enabled) {
      console.log('⚠️ AI processing disabled, using default study notes')
      return this.getDefaultStudyNotes(content, type, detailLevel)
    }

    try {
      // Check if we're in a service worker context (no window object)
      const isServiceWorker = typeof window === 'undefined'
      console.log('🌐 Context check:', { isServiceWorker })

      // Always use local processing in service worker context
      if (isServiceWorker) {
        console.log('⚠️ Using local processing in service worker context')
        return await this.generateStudyNotesLocally(content, type, detailLevel)
      }

      // Only try OpenAI in non-service worker contexts
      if (this.config.provider === 'openai' && this.config.apiKey) {
        console.log('🤖 Attempting OpenAI study notes generation...')
        try {
          return await this.generateStudyNotesWithOpenAI(content, type, detailLevel)
        } catch (error) {
          console.error(
            '❌ OpenAI study notes generation failed, falling back to local processing:',
            error
          )
          return await this.generateStudyNotesLocally(content, type, detailLevel)
        }
      } else {
        console.log('🏠 Using local processing for study notes (provider:', this.config?.provider, ')')
        return await this.generateStudyNotesLocally(content, type, detailLevel)
      }
    } catch (error) {
      console.error('❌ Study notes generation failed:', error)
      return this.getDefaultStudyNotes(content, type, detailLevel)
    }
  }

  private async generateStudyNotesWithOpenAI(
    content: string,
    type: string,
    detailLevel: 'brief' | 'detailed' | 'bullets'
  ): Promise<StudyNotes> {
    console.log('🤖 OpenAI study notes generation started')
    
    if (!this.config?.apiKey) {
      console.error('❌ OpenAI API key not configured')
      throw new Error('OpenAI API key not configured')
    }

    // Double-check we're not in a service worker context
    if (typeof window === 'undefined') {
      console.log('⚠️ OpenAI processing skipped in service worker context')
      return this.generateStudyNotesLocally(content, type, detailLevel)
    }

    try {
      console.log('📡 Loading OpenAI library...')
      const { OpenAI } = await import('openai')
      const openai = new OpenAI({
        apiKey: this.config.apiKey,
        dangerouslyAllowBrowser: true,
      })

      const prompt = this.buildStudyNotesPrompt(content, type, detailLevel)
      console.log('📝 Sending study notes request to OpenAI API...', {
        model: this.config.model || 'gpt-3.5-turbo',
        contentLength: content.length,
        promptLength: prompt.length
      })

      const response = await openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI assistant that generates comprehensive study notes from content. Return a JSON response with briefSummary (string), detailedSummary (string), bulletPoints (array of strings), keyPoints (array of strings), questions (array of strings), and actionItems (array of strings).',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1500,
      })

      const result = response.choices[0]?.message?.content
      console.log('✅ OpenAI study notes response received:', {
        hasResult: !!result,
        resultLength: result?.length || 0,
        usage: response.usage
      })
      
      if (!result) {
        console.error('❌ No response from OpenAI')
        throw new Error('No response from OpenAI')
      }

      try {
        const parsed = JSON.parse(result)
        console.log('🎯 OpenAI study notes generation successful')
        
        const notes: StudyNotes = {
          briefSummary: parsed.briefSummary || this.generateBriefSummary(content),
          detailedSummary: parsed.detailedSummary || this.generateDetailedSummary(content),
          bulletPoints: Array.isArray(parsed.bulletPoints) 
            ? parsed.bulletPoints 
            : this.generateBulletPoints(content),
          keyPoints: Array.isArray(parsed.keyPoints)
            ? parsed.keyPoints
            : this.generateKeyPoints(content),
          questions: Array.isArray(parsed.questions)
            ? parsed.questions
            : this.generateQuestions(content),
          actionItems: Array.isArray(parsed.actionItems)
            ? parsed.actionItems
            : this.generateActionItems(content),
          generatedAt: new Date().toISOString(),
          detailLevel,
        }
        
        return notes
      } catch (parseError) {
        console.error('❌ Failed to parse OpenAI response:', parseError)
        return this.getDefaultStudyNotes(content, type, detailLevel)
      }
    } catch (error) {
      console.error(
        '❌ OpenAI study notes generation failed, falling back to local processing:',
        error
      )
      return this.generateStudyNotesLocally(content, type, detailLevel)
    }
  }

  private async generateStudyNotesLocally(
    content: string,
    _type: string,
    detailLevel: 'brief' | 'detailed' | 'bullets'
  ): Promise<StudyNotes> {
    // Local processing using simple heuristics
    return {
      briefSummary: this.generateBriefSummary(content),
      detailedSummary: this.generateDetailedSummary(content),
      bulletPoints: this.generateBulletPoints(content),
      keyPoints: this.generateKeyPoints(content),
      questions: this.generateQuestions(content),
      actionItems: this.generateActionItems(content),
      generatedAt: new Date().toISOString(),
      detailLevel,
    }
  }

  private buildStudyNotesPrompt(
    content: string,
    type: string,
    detailLevel: 'brief' | 'detailed' | 'bullets'
  ): string {
    const truncatedContent =
      content.length > 4000 ? content.substring(0, 4000) + '...' : content

    const detailInstructions = {
      brief: 'Focus on concise, high-level insights.',
      detailed: 'Provide comprehensive analysis with context.',
      bullets: 'Organize information in clear, structured bullet points.',
    }

    return `Generate comprehensive study notes from this ${type} content:

Content: "${truncatedContent}"

Detail Level: ${detailLevel} - ${detailInstructions[detailLevel]}

Please provide a JSON response with:
1. briefSummary: A 1-2 sentence summary
2. detailedSummary: A comprehensive paragraph summary (3-5 sentences)
3. bulletPoints: An array of 5-8 key bullet points
4. keyPoints: An array of 3-5 main takeaways
5. questions: An array of 3-5 study questions that help understand the content
6. actionItems: An array of any action items, next steps, or tasks mentioned (if any)

Format as JSON.`
  }

  private generateBriefSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const firstSentence = sentences[0]?.trim()
    const secondSentence = sentences[1]?.trim()

    if (firstSentence && secondSentence) {
      return `${firstSentence}. ${secondSentence}.`
    } else if (firstSentence) {
      return `${firstSentence}.`
    } else {
      return content.substring(0, 100) + (content.length > 100 ? '...' : '')
    }
  }

  private generateDetailedSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const summarySentences = sentences.slice(0, 5).map(s => s.trim()).filter(Boolean)
    
    if (summarySentences.length > 0) {
      return summarySentences.join('. ') + '.'
    }
    
    return content.substring(0, 300) + (content.length > 300 ? '...' : '')
  }

  private generateBulletPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15)
    const bullets = sentences.slice(0, 8).map(s => s.trim()).filter(Boolean)
    
    if (bullets.length === 0) {
      // Fallback: split by paragraphs or lines
      const lines = content.split(/\n+/).filter(l => l.trim().length > 20)
      return lines.slice(0, 8).map(l => l.trim().substring(0, 150))
    }
    
    return bullets.map(b => b.substring(0, 200))
  }

  private generateKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const keyPoints = sentences.slice(0, 5).map(s => s.trim()).filter(Boolean)
    
    if (keyPoints.length === 0) {
      return ['Key information extracted from the content']
    }
    
    return keyPoints.map(kp => kp.substring(0, 150))
  }

  private generateQuestions(content: string): string[] {
    // Simple heuristic: generate questions based on content
    const questions = [
      'What are the main concepts discussed?',
      'What are the key takeaways?',
      'How can this information be applied?',
    ]

    // Try to extract question-like sentences from content
    const questionMatches = content.match(/[^.!?]*\?[^.!?]*/g)
    if (questionMatches && questionMatches.length > 0) {
      return questionMatches.slice(0, 5).map(q => q.trim())
    }

    // Generate contextual questions based on content type
    if (content.toLowerCase().includes('how to') || content.toLowerCase().includes('tutorial')) {
      return [
        'What steps are required to complete this task?',
        'What are the prerequisites?',
        'What are common pitfalls to avoid?',
      ]
    }

    return questions
  }

  private generateActionItems(content: string): string[] {
    const actionItems: string[] = []

    // Look for action-oriented keywords
    const actionKeywords = [
      'todo', 'task', 'action', 'next step', 'should', 'must', 'need to',
      'remember to', 'don\'t forget', 'make sure', 'ensure'
    ]

    const sentences = content.split(/[.!?]+/)
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      if (actionKeywords.some(keyword => lowerSentence.includes(keyword))) {
        const trimmed = sentence.trim()
        if (trimmed.length > 10 && trimmed.length < 200) {
          actionItems.push(trimmed)
        }
      }
    }

    // If no action items found, return empty array
    return actionItems.slice(0, 5)
  }

  private getDefaultStudyNotes(
    content: string,
    _type: string,
    detailLevel: 'brief' | 'detailed' | 'bullets'
  ): StudyNotes {
    return {
      briefSummary: this.generateBriefSummary(content),
      detailedSummary: this.generateDetailedSummary(content),
      bulletPoints: this.generateBulletPoints(content),
      keyPoints: this.generateKeyPoints(content),
      questions: this.generateQuestions(content),
      actionItems: this.generateActionItems(content),
      generatedAt: new Date().toISOString(),
      detailLevel,
    }
  }
}

export const aiService = new AIService()
