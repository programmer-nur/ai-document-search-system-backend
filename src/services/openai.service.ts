import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/apiError';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export class OpenAIService {
  /**
   * Generate embeddings for text
   */
  static async generateEmbedding(
    text: string,
    model: string = 'text-embedding-3-small'
  ): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model,
        input: text,
      });

      const embedding = response.data[0]?.embedding;

      if (!embedding) {
        throw ApiError.internal('Failed to generate embedding');
      }

      logger.debug('Embedding generated', {
        model,
        textLength: text.length,
        embeddingLength: embedding.length,
      });

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', { error, model });
      throw ApiError.internal('Failed to generate embedding');
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  static async generateEmbeddings(
    texts: string[],
    model: string = 'text-embedding-3-small'
  ): Promise<number[][]> {
    try {
      const response = await openai.embeddings.create({
        model,
        input: texts,
      });

      const embeddings = response.data.map((item) => item.embedding);

      logger.debug('Embeddings generated', {
        model,
        count: texts.length,
        embeddingLength: embeddings[0]?.length || 0,
      });

      return embeddings;
    } catch (error) {
      logger.error('Failed to generate embeddings', { error, model });
      throw ApiError.internal('Failed to generate embeddings');
    }
  }

  /**
   * Generate answer using RAG (Retrieval Augmented Generation)
   */
  static async generateAnswer(
    question: string,
    context: string,
    model: string = 'gpt-3.5-turbo'
  ): Promise<{
    answer: string;
    tokensUsed: number;
  }> {
    try {
      const systemPrompt = `You are a helpful assistant that answers questions based only on the provided context. 
If the context doesn't contain enough information to answer the question, say "I don't have enough information to answer this question based on the provided documents."
Always cite the source when possible.`;

      const userPrompt = `Context:
${context}

Question: ${question}

Answer:`;

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const answer = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      logger.debug('Answer generated', {
        model,
        questionLength: question.length,
        contextLength: context.length,
        answerLength: answer.length,
        tokensUsed,
      });

      return {
        answer,
        tokensUsed,
      };
    } catch (error) {
      logger.error('Failed to generate answer', { error, model });
      throw ApiError.internal('Failed to generate answer');
    }
  }

  /**
   * Count tokens in text (rough estimate)
   */
  static estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export default openai;

