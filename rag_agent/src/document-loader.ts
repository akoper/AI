import fs from 'fs';
import path from 'path';
import { Document, DocumentMetadata } from './types.js';

export class DocumentLoader {
  /**
   * Create document from raw text.
   */
  public static fromText(text: string, metadata: Partial<DocumentMetadata> = {}): Document {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      id,
      content: text,
      metadata: {
        source: metadata.source || 'raw-text',
        title: metadata.title || 'Untitled Document',
        createdAt: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Load a single document from file.
   */
  public static fromFile(filePath: string, customMetadata: Partial<DocumentMetadata> = {}): Document {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    let parsedContent = content;
    if (ext === '.json') {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'string') {
          parsedContent = parsed;
        } else if (Array.isArray(parsed)) {
          parsedContent = parsed.map((item) => (typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item))).join('\n\n');
        } else {
          parsedContent = JSON.stringify(parsed, null, 2);
        }
      } catch {
        parsedContent = content;
      }
    }

    const id = `file_${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
    return {
      id,
      content: parsedContent,
      metadata: {
        source: resolvedPath,
        title: customMetadata.title || filename,
        fileType: ext,
        createdAt: new Date().toISOString(),
        ...customMetadata,
      },
    };
  }

  /**
   * Load all supported files recursively from a directory.
   */
  public static fromDirectory(dirPath: string, supportedExtensions: string[] = ['.txt', '.md', '.json', '.csv']): Document[] {
    const resolvedDir = path.resolve(dirPath);
    if (!fs.existsSync(resolvedDir)) {
      return [];
    }

    const documents: Document[] = [];
    const scan = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            try {
              const doc = DocumentLoader.fromFile(fullPath);
              documents.push(doc);
            } catch (err) {
              console.warn(`Could not load document from ${fullPath}:`, err);
            }
          }
        }
      }
    };

    scan(resolvedDir);
    return documents;
  }
}
