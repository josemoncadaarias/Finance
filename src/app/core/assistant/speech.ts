/**
 * The phone's own dictation, for the assistant's microphone (mockup `39h`).
 *
 * On Android it is `SpeechPlugin` (RecognizerIntent: the phone listens and
 * shows its own "Habla ahora", the app keeps no audio and asks for no
 * microphone permission). In a browser it is the browser's own recognition
 * where there is one. Where neither exists the button says so.
 */

import { registerPlugin } from '@capacitor/core';
import { DEVICE } from '../device/device';

interface SpeechPlugin {
  available(): Promise<{ available: boolean }>;
  listen(options: { language: string; prompt: string }): Promise<{ text: string }>;
}

const Native = registerPlugin<SpeechPlugin>('Speech');

interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
}

function browserRecognition(): (new () => BrowserRecognition) | null {
  const w = globalThis as unknown as { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export async function canListen(): Promise<boolean> {
  if (DEVICE.nativeVoice) {
    try {
      return (await Native.available()).available;
    } catch {
      return false;
    }
  }
  // A phone without its own dictation plugin (an iPhone, for now) offers no microphone.
  if (DEVICE.native) return false;
  return browserRecognition() !== null;
}

/** What was said, or '' when nothing was. Rejects only when the phone cannot listen at all. */
export async function listen(language: string, prompt: string): Promise<string> {
  if (DEVICE.nativeVoice) return (await Native.listen({ language, prompt })).text ?? '';
  const Recognition = browserRecognition();
  if (!Recognition) throw new Error('unavailable');
  return new Promise<string>(resolve => {
    const recognition = new Recognition();
    let said = '';
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => { said = event.results[0]?.[0]?.transcript ?? ''; };
    recognition.onerror = () => resolve('');
    recognition.onend = () => resolve(said);
    recognition.start();
  });
}
