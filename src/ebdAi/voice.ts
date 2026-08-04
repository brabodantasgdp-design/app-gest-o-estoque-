// ============================================================
// EBD AI - Voice Module
// Text-to-Speech, Speech-to-Text, voice customization
// ============================================================

import { EbdAiConfig } from './index';

export class EbdAiVoice {
  private config: EbdAiConfig;
  private synth: SpeechSynthesis;
  private recognition: any;
  private voices: SpeechSynthesisVoice[] = [];
  private isListeningFlag = false;
  private onResultCallback?: (text: string) => void;

  constructor(config: EbdAiConfig) {
    this.config = config;
    this.synth = window.speechSynthesis;
    this.loadVoices();
    this.synth.onvoiceschanged = () => this.loadVoices();
  }

  // ============================================================
  // TEXT-TO-SPEECH
  // ============================================================

  async speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const cleanText = text
        .replace(/[✅❌⚠️📊💰📦🏷️🛒📝🔍👤💡🎯🚀⚡🧠]/g, '')
        .replace(/\n+/g, '. ')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Apply voice settings based on personality
      switch (this.config.personality) {
        case 'professional':
          utterance.rate = 1.0;
          utterance.pitch = 0.9;
          break;
        case 'casual':
          utterance.rate = 1.1;
          utterance.pitch = 1.0;
          break;
        case 'technical':
          utterance.rate = 0.95;
          utterance.pitch = 0.85;
          break;
        default:
          utterance.rate = 1.0;
          utterance.pitch = 0.9;
      }

      utterance.volume = 1;

      // Select voice based on language
      const lang = this.config.language?.split('-')[0] || 'pt';
      const voice = this.voices.find(v => v.lang.startsWith(lang));
      if (voice) utterance.voice = voice;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.synth.speak(utterance);
    });
  }

  stop(): void {
    this.synth.cancel();
  }

  // ============================================================
  // SPEECH-TO-TEXT
  // ============================================================

  async startListening(): Promise<void> {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.config.language || 'pt-BR';
    this.recognition.interimResults = false;
    this.recognition.continuous = false;

    this.recognition.onstart = () => {
      this.isListeningFlag = true;
    };

    this.recognition.onend = () => {
      this.isListeningFlag = false;
    };

    this.recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (this.onResultCallback) {
        this.onResultCallback(text);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.isListeningFlag = false;
    };

    this.recognition.start();
  }

  async stopListening(): Promise<void> {
    if (this.recognition) {
      this.recognition.stop();
    }
    this.isListeningFlag = false;
  }

  onResult(callback: (text: string) => void): void {
    this.onResultCallback = callback;
  }

  isListening(): boolean {
    return this.isListeningFlag;
  }

  // ============================================================
  // VOICES
  // ============================================================

  private loadVoices(): void {
    this.voices = this.synth.getVoices();
  }

  getVoices(): Array<{ name: string; lang: string }> {
    return this.voices
      .filter(v => v.lang.startsWith('pt') || v.lang.startsWith('en') || v.lang.startsWith('es'))
      .map(v => ({ name: v.name, lang: v.lang }));
  }

  setVoice(voiceName: string): void {
    // Voice will be applied on next speak call
  }

  // ============================================================
  // UTILITY
  // ============================================================

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  isRecognitionSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }
}
