/**
 * Intelligent text chunking utility
 * Splits text into chunks with overlap for better context preservation
 */

export interface ChunkOptions {
  maxChunkSize: number; // Maximum characters per chunk
  chunkOverlap: number; // Overlap between chunks in characters
  separators?: string[]; // Preferred separators for splitting
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', ' ', ''],
};

export interface TextChunk {
  text: string;
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
}

/**
 * Split text into chunks with intelligent boundaries
 */
export const chunkText = (
  text: string,
  options: Partial<ChunkOptions> = {}
): TextChunk[] => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;

  while (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    const targetSize = opts.maxChunkSize;
    const overlap = opts.chunkOverlap;

    // Try to find a good split point
    let chunkEnd = Math.min(currentIndex + targetSize, text.length);
    let chunkText = text.substring(currentIndex, chunkEnd);

    // If we're not at the end, try to find a better split point
    if (chunkEnd < text.length) {
      // Try each separator in order of preference
      for (const separator of opts.separators || []) {
        const lastIndex = chunkText.lastIndexOf(separator);
        if (lastIndex > targetSize * 0.5) {
          // Found a good split point (at least 50% through the chunk)
          chunkEnd = currentIndex + lastIndex + separator.length;
          chunkText = text.substring(currentIndex, chunkEnd);
          break;
        }
      }
    }

    chunks.push({
      text: chunkText.trim(),
      startIndex: currentIndex,
      endIndex: chunkEnd,
      chunkIndex: chunkIndex++,
    });

    // Move to next chunk with overlap
    currentIndex = chunkEnd - overlap;
    if (currentIndex < 0) currentIndex = 0;
  }

  return chunks;
};

/**
 * Split text by paragraphs first, then by sentences if needed
 */
export const chunkByParagraphs = (
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 200
): TextChunk[] => {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentIndex = 0;
  let chunkIndex = 0;
  let chunkStartIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) continue;

    // If adding this paragraph would exceed max size, save current chunk
    if (currentChunk && currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex: chunkStartIndex,
        endIndex: currentIndex,
        chunkIndex: chunkIndex++,
      });

      // Start new chunk with overlap
      const overlapText = currentChunk.substring(
        Math.max(0, currentChunk.length - overlap)
      );
      currentChunk = overlapText + '\n\n' + paragraph;
      chunkStartIndex = currentIndex - overlapText.length;
    } else {
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
        chunkStartIndex = currentIndex;
      }
    }

    currentIndex += paragraph.length + 2; // +2 for \n\n
  }

  // Add remaining chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      startIndex: chunkStartIndex,
      endIndex: currentIndex,
      chunkIndex: chunkIndex,
    });
  }

  return chunks;
};

/**
 * Calculate optimal chunk size based on token count
 */
export const calculateOptimalChunkSize = (
  text: string,
  targetTokens: number = 250,
  tokensPerChar: number = 4
): number => {
  const targetChars = targetTokens * tokensPerChar;
  return Math.min(targetChars, text.length);
};

