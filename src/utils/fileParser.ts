/**
 * File parsing utilities
 * Placeholder for actual PDF, DOCX, XLSX parsers
 * In production, use libraries like:
 * - pdf-parse for PDFs
 * - mammoth for DOCX
 * - xlsx for Excel files
 */

import { logger } from './logger';
import { ApiError } from './apiError';

// DocumentType enum values
type DocumentType = 'PDF' | 'DOCX' | 'DOC' | 'XLSX' | 'XLS' | 'TXT' | 'MD';

export interface ParsedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
    [key: string]: unknown;
  };
}

export class FileParser {
  /**
   * Parse document based on type
   */
  static async parseDocument(
    buffer: Buffer,
    type: DocumentType,
    mimeType: string
  ): Promise<ParsedDocument> {
    try {
      switch (type) {
        case 'PDF':
          return await this.parsePDF(buffer);
        case 'DOCX':
        case 'DOC':
          return await this.parseDOCX(buffer);
        case 'XLSX':
        case 'XLS':
          return await this.parseExcel(buffer);
        case 'TXT':
        case 'MD':
          return await this.parseText(buffer);
        default:
          throw ApiError.badRequest(`Unsupported file type: ${type}`);
      }
    } catch (error) {
      logger.error('Failed to parse document', { error, type, mimeType });
      throw ApiError.internal('Failed to parse document');
    }
  }

  /**
   * Parse PDF file
   */
  private static async parsePDF(buffer: Buffer): Promise<ParsedDocument> {
    try {
      // Use require for pdf-parse as it's CommonJS
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);

      return {
        text: data.text,
        metadata: {
          pageCount: data.numpages,
          wordCount: data.text.split(/\s+/).filter((word: string) => word.length > 0).length,
          title: data.info?.Title,
          author: data.info?.Author,
          subject: data.info?.Subject,
        },
      };
    } catch (error) {
      logger.error('PDF parsing failed', { error });
      throw ApiError.internal('Failed to parse PDF file');
    }
  }

  /**
   * Parse DOCX file
   */
  private static async parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
    try {
      // Use require for mammoth as it's CommonJS
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });

      return {
        text: result.value,
        metadata: {
          wordCount: result.value.split(/\s+/).filter((word: string) => word.length > 0).length,
        },
      };
    } catch (error) {
      logger.error('DOCX parsing failed', { error });
      throw ApiError.internal('Failed to parse DOCX file');
    }
  }

  /**
   * Parse Excel file
   */
  private static async parseExcel(buffer: Buffer): Promise<ParsedDocument> {
    try {
      // Use require for xlsx as it's CommonJS
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const sheets = workbook.SheetNames.map((name: string) => {
        const sheet = workbook.Sheets[name];
        const sheetText = XLSX.utils.sheet_to_txt(sheet);
        return `Sheet: ${name}\n${sheetText}`;
      });

      const text = sheets.join('\n\n');
      const totalCells = workbook.SheetNames.reduce((count: number, name: string) => {
        const sheet = workbook.Sheets[name];
        return count + Object.keys(sheet).length;
      }, 0);

      return {
        text,
        metadata: {
          sheetCount: workbook.SheetNames.length,
          sheetNames: workbook.SheetNames,
          totalCells,
        },
      };
    } catch (error) {
      logger.error('Excel parsing failed', { error });
      throw ApiError.internal('Failed to parse Excel file');
    }
  }

  /**
   * Parse text file
   */
  private static async parseText(buffer: Buffer): Promise<ParsedDocument> {
    const text = buffer.toString('utf-8');
    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
    };
  }

  /**
   * Normalize text (clean, remove extra whitespace, etc.)
   */
  static normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
      .trim();
  }
}
