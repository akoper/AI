export class VoiceProcessor {
  /**
   * Calculates Root-Mean-Square (RMS) audio energy of a PCM buffer (Int16 Little Endian)
   */
  public static calculateRms(buffer: Buffer): number {
    if (buffer.length < 2) return 0;
    let sum = 0;
    const samplesCount = Math.floor(buffer.length / 2);

    for (let i = 0; i < samplesCount; i++) {
      const sample = buffer.readInt16LE(i * 2) / 32768.0;
      sum += sample * sample;
    }

    return Math.sqrt(sum / samplesCount);
  }

  /**
   * Determines whether the given audio chunk contains speech based on energy threshold
   */
  public static isSpeech(buffer: Buffer, threshold: number = 0.015): boolean {
    const rms = this.calculateRms(buffer);
    return rms >= threshold;
  }

  /**
   * Encodes raw 16-bit PCM mono audio buffer into a valid standard WAV audio buffer
   */
  public static pcmToWav(
    pcmBuffer: Buffer,
    sampleRate: number = 16000,
    numChannels: number = 1,
    bitsPerSample: number = 16
  ): Buffer {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const wavBuffer = Buffer.alloc(headerSize + dataSize);

    // RIFF chunk descriptor
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(36 + dataSize, 4); // File size - 8
    wavBuffer.write('WAVE', 8);

    // "fmt " sub-chunk
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    wavBuffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    wavBuffer.writeUInt16LE(numChannels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(byteRate, 28);
    wavBuffer.writeUInt16LE(blockAlign, 32);
    wavBuffer.writeUInt16LE(bitsPerSample, 34);

    // "data" sub-chunk
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);

    // Copy PCM audio payload
    pcmBuffer.copy(wavBuffer, headerSize);

    return wavBuffer;
  }

  /**
   * Converts Float32Array PCM samples (from Web Audio API) into Int16 Buffer
   */
  public static float32ToInt16Buffer(float32Array: Float32Array): Buffer {
    const buffer = Buffer.alloc(float32Array.length * 2);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      buffer.writeInt16LE(Math.floor(s), i * 2);
    }
    return buffer;
  }

  /**
   * Generates a simple mock PCM tone / test speech signal buffer for tests or CLI simulation
   */
  public static generateTestTone(frequency: number = 440, durationMs: number = 1000, sampleRate: number = 16000): Buffer {
    const numSamples = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = Buffer.alloc(numSamples * 2);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;
      const intSample = Math.floor(sample * 32767);
      buffer.writeInt16LE(intSample, i * 2);
    }

    return buffer;
  }
}
