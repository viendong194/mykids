export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  private constructor() {
    this.muted = localStorage.getItem('mykids_muted') === 'true';
    // Tiền nạp danh sách giọng đọc của trình duyệt để sẵn sàng sử dụng
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Khởi tạo AudioContext từ cử chỉ người dùng
   */
  public init() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('mykids_muted', String(this.muted));
    if (this.muted) {
      this.stopSpeaking();
    }
    return this.muted;
  }

  /**
   * Tạo âm thanh click nhẹ
   */
  public playTap() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  /**
   * Phát âm thanh reo vui khi trả lời đúng
   */
  public playCorrect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25];

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.35);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.4);
    });
  }

  /**
   * Phát âm thanh rung lắc/boing trầm khi trả lời sai
   */
  public playIncorrect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.3);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start();
    osc.stop(now + 0.3);
  }

  /**
   * Phát âm thanh chúc mừng thắng cuộc
   */
  public playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50];
    
    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.5);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.6);
    });
  }

  /**
   * Đọc to câu bằng SpeechSynthesis
   */
  public speak(text: string, lang: string) {
    if (this.muted) return;

    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'vi' ? 'vi-VN' : 'en-US';
        
        const voices = window.speechSynthesis.getVoices();
        const targetLang = lang === 'vi' ? 'vi' : 'en';

        // Lọc các giọng tương thích ngôn ngữ
        const matchingVoices = voices.filter(v => 
          v.lang.toLowerCase().replace('_', '-').startsWith(targetLang)
        );

        // Ưu tiên: 1. Giọng Google (Cloud Voice cực tự nhiên), 2. Giọng Natural, 3. Giọng mặc định đầu tiên
        const targetVoice = matchingVoices.find(v => v.name.toLowerCase().includes('google')) ||
                            matchingVoices.find(v => v.name.toLowerCase().includes('natural')) ||
                            matchingVoices[0];

        if (targetVoice) {
          utterance.voice = targetVoice;
        }

        // Tốc độ vừa phải cho bé dễ tiếp thu
        utterance.rate = lang === 'vi' ? 0.82 : 0.88; 
        utterance.pitch = lang === 'vi' ? 1.05 : 1.15; // Giọng hơi trong trẻo một chút

        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("SpeechSynthesis error:", e);
    }
  }

  public stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audioManager = AudioManager.getInstance();
export default audioManager;
