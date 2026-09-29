/**
 * Simple text chunking utility.
 * In RAG, documents are broken down into manageable pieces (chunks)
 * so embeddings can accurately represent specific pieces of information.
 */

function chunkText(text, chunkSize = 300, overlap = 50) {
  if (!text || typeof text !== 'string') return [];
  
  // Clean text
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= chunkSize) {
    return [clean];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + chunkSize;

    // Try not to break words in half
    if (endIndex < clean.length) {
      const nextSpace = clean.indexOf(' ', endIndex);
      const prevSpace = clean.lastIndexOf(' ', endIndex);

      if (prevSpace > startIndex && (endIndex - prevSpace) < 50) {
        endIndex = prevSpace;
      } else if (nextSpace !== -1 && (nextSpace - endIndex) < 30) {
        endIndex = nextSpace;
      }
    } else {
      endIndex = clean.length;
    }

    const chunk = clean.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (endIndex >= clean.length) {
      break;
    }

    // Step forward by (chunkSize - overlap)
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return chunks;
}

module.exports = {
  chunkText
};
