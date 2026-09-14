import { Document, DocumentChunk } from './types.js';

export interface ChunkerOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

export class TextChunker {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: ChunkerOptions = {}) {
    this.chunkSize = options.chunkSize ?? 500;
    this.chunkOverlap = options.chunkOverlap ?? 100;
  }

  /**
   * Split a document into manageable, overlapping chunks while preserving context.
   */
  public chunkDocument(document: Document): DocumentChunk[] {
    const text = document.content.trim();
    if (!text) {
      return [];
    }

    const rawChunks = this.splitText(text);
    return rawChunks.map((chunkText, index) => ({
      id: `${document.id}_chunk_${index}`,
      documentId: document.id,
      content: chunkText,
      chunkIndex: index,
      totalChunks: rawChunks.length,
      metadata: {
        ...document.metadata,
        chunkIndex: index,
        totalChunks: rawChunks.length,
      },
    }));
  }

  /**
   * Recursive character text splitter strategy.
   * Attempts splitting on double newlines (paragraphs), single newlines, sentences, and words.
   */
  public splitText(text: string): string[] {
    if (text.length <= this.chunkSize) {
      return [text];
    }

    const separators = ['\n\n# ', '\n\n## ', '\n\n### ', '\n\n', '\n', '. ', '? ', '! ', ' ', ''];
    return this.splitTextRecursive(text, separators);
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    // Find the first separator that appears in the text
    let separator = separators[separators.length - 1];
    let nextSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      if (sep === '' || text.includes(sep)) {
        separator = sep;
        nextSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = separator === '' ? text.split('') : text.split(separator);
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const piece = separator === '' ? split : (i > 0 ? separator : '') + split;
      const pieceLength = piece.length;

      if (currentLength + pieceLength > this.chunkSize && currentChunk.length > 0) {
        const chunkText = currentChunk.join('').trim();
        if (chunkText.length > 0) {
          if (chunkText.length > this.chunkSize && nextSeparators.length > 0) {
            // Sub-split overly large chunks with finer separators
            const subChunks = this.splitTextRecursive(chunkText, nextSeparators);
            finalChunks.push(...subChunks);
          } else {
            finalChunks.push(chunkText);
          }
        }

        // Apply overlap from end of current chunk
        const overlapPieces = this.getOverlapPieces(currentChunk, this.chunkOverlap);
        currentChunk = overlapPieces;
        currentLength = currentChunk.join('').length;
      }

      currentChunk.push(piece);
      currentLength += pieceLength;
    }

    if (currentChunk.length > 0) {
      const remainingText = currentChunk.join('').trim();
      if (remainingText.length > 0) {
        if (remainingText.length > this.chunkSize && nextSeparators.length > 0) {
          finalChunks.push(...this.splitTextRecursive(remainingText, nextSeparators));
        } else {
          finalChunks.push(remainingText);
        }
      }
    }

    return finalChunks.filter((c) => c.trim().length > 0);
  }

  private getOverlapPieces(pieces: string[], targetOverlap: number): string[] {
    const overlap: string[] = [];
    let accumulated = 0;

    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (accumulated + p.length <= targetOverlap || overlap.length === 0) {
        overlap.unshift(p);
        accumulated += p.length;
      } else {
        break;
      }
    }

    return overlap;
  }
}
