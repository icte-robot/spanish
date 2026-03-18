/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { Send, Mic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getSarahResponse, getPronunciationFeedback } from './services/geminiService';
import SarahFace, { Emotion } from './components/SarahFace';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

type ConversationState = 'IDLE' | 'LISTENING_FOR_REPLY' | 'AWAITING_PRONUNCIATION';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>('IDLE');
  const [spanishPhrase, setSpanishPhrase] = useState('');
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [isTalking, setIsTalking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Refs to fix stale closures in speech recognition callbacks and prevent echo
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const conversationStateRef = useRef<ConversationState>('IDLE');
  const isLoadingRef = useRef(false);
  const spanishPhraseRef = useRef('');
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInterimTranscriptRef = useRef('');
  const ignoreNextFinalRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const lastSpeakEndTimeRef = useRef(0);
  const currentSpeakingTextRef = useRef('');
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
    return audioContextRef.current;
  };

  const startMicVisualization = (stream: MediaStream) => {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(console.error);
    }

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    analyserRef.current = analyser;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateLevel = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      setMicLevel(average); // 0 to 255
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  const stopMicVisualization = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    // Don't close the context, just disconnect the analyser
    analyserRef.current = null;
    setMicLevel(0);
  };

  const updateSpanishPhrase = (phrase: string) => {
    setSpanishPhrase(phrase);
    spanishPhraseRef.current = phrase;
  };

  // Helper to detect if a transcript is likely an echo of what Sarah is currently saying
  const isLikelyEcho = (transcript: string, sarahText: string) => {
    if (!sarahText) return false;
    
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,?!¡¿]/g, '').trim();
    
    const cleanTranscript = normalize(transcript);
    const cleanSarah = normalize(sarahText.replace(/<\/?spanish>/g, ''));
    
    if (!cleanTranscript) return false;

    // Check for exact substring match FIRST (very likely an echo)
    if (cleanSarah.includes(cleanTranscript)) {
      return true;
    }

    const tWords = cleanTranscript.split(/\s+/);
    const sWords = cleanSarah.split(/\s+/);
    
    // Check for high word overlap (handles slight misrecognitions of the echo)
    let matchCount = 0;
    for (const w of tWords) {
      if (sWords.includes(w)) matchCount++;
    }
    
    const matchPercentage = matchCount / tWords.length;
    
    // If it's a short phrase (1-2 words), require 100% match
    if (tWords.length <= 2) {
      return matchPercentage === 1;
    }
    
    // For longer phrases, if more than 50% of the words match, it's probably an echo
    return matchPercentage >= 0.5;
  };

  const resetSleepTimer = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (conversationStateRef.current !== 'IDLE') {
      sleepTimerRef.current = setTimeout(() => {
        if (conversationStateRef.current !== 'IDLE' && !isSpeakingRef.current) {
          updateConversationState('IDLE');
          const sleepMsg = "I haven't heard from you in a while, so I'm going to take a little nap. Just say 'Hi Sarah' when you want to talk again!";
          setMessages(prev => [...prev, { sender: 'bot', text: sleepMsg }]);
          speak(sleepMsg, true);
        }
      }, 60000);
    }
  };

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, []);

  const detectEmotionFromText = (text: string): Emotion => {
    const lower = text.toLowerCase();
    
    // Happy indicators
    if (/\b(happy|joy|great|wonderful|amazing|love|awesome|fantastic|yay|hooray|excited|fun|cool|good|perfect|!\s*$|😊|😄|🎉|giggle|giggles|haha|hehe|laugh)\b/.test(lower) ||
        (lower.includes('!') && (lower.includes('great') || lower.includes('love') || lower.includes('good')))) {
      return 'happy';
    }
    
    // Love indicators
    if (/\b(love you|heart|adore|beautiful|gorgeous|crush|romantic|sweet|kind|friend|bestie|❤|💕|😍)\b/.test(lower)) {
      return 'love';
    }
    
    // Sad indicators
    if (/\b(sad|sorry|cry|miss|lonely|depressed|upset|hurt|bad|unhappy|😢|😭|💔)\b/.test(lower)) {
      return 'sad';
    }
    
    // Angry indicators
    if (/\b(angry|mad|hate|furious|annoyed|frustrated|ugh|argh|stop|no|bad|😠|😡|🤬)\b/.test(lower)) {
      return 'angry';
    }
    
    // Surprised indicators
    if (/\b(wow|omg|what|really|no way|surprised|shocked|amazing|incredible|unbelievable|😲|😮|🤯)\b/.test(lower) ||
        lower.includes('?!') || lower.includes('!?')) {
      return 'surprised';
    }
    
    // Sleepy indicators
    if (/\b(tired|sleepy|exhausted|yawn|zzz|bed|nap|night|sleep|😴|🥱)\b/.test(lower)) {
      return 'sleepy';
    }
    
    // Confused indicators
    if (/\b(confused|huh|what|why|how|don't understand|puzzled|maybe|perhaps|🤔|😕)\b/.test(lower) ||
        (lower.match(/\?/g) || []).length >= 2) {
      return 'confused';
    }
    
    return 'neutral';
  };

  const updateConversationState = (newState: ConversationState) => {
    const oldState = conversationStateRef.current;
    setConversationState(newState);
    conversationStateRef.current = newState;
    
    // If language needs to change, restart recognition
    const oldLang = oldState === 'AWAITING_PRONUNCIATION' ? 'es-ES' : 'en-US';
    const newLang = newState === 'AWAITING_PRONUNCIATION' ? 'es-ES' : 'en-US';
    
    if (oldLang !== newLang && recognitionRef.current) {
       try {
         recognitionRef.current.stop();
       } catch (e) {}
    }
  };

  const updateIsLoading = (loading: boolean) => {
    setIsLoading(loading);
    isLoadingRef.current = loading;
  };

  useEffect(() => {
    // Workaround for speech synthesis hanging on some browsers (especially iOS Safari)
    const interval = setInterval(() => {
      if (isSpeakingRef.current && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 5000);

    // Global click/touch listener to keep speech synthesis "blessed"
    const resumeSpeech = () => {
      console.log("User interaction detected, attempting to resume speech synthesis...");
      if (window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        // On iOS, sometimes we need to kick it with a silent utterance on every interaction
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      }
    };
    window.addEventListener('click', resumeSpeech);
    window.addEventListener('touchstart', resumeSpeech);

    // Monitor voices
    const handleVoicesChanged = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log(`Speech synthesis voices updated. Total voices: ${voices.length}`);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', resumeSpeech);
      window.removeEventListener('touchstart', resumeSpeech);
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const unlockAudioSystem = () => {
    console.log("Attempting to unlock audio system...");
    if (!window.speechSynthesis) return;

    try {
      // 1. Resume AudioContext immediately
      const audioContext = getAudioContext();
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(console.error);
      }

      // 2. Play a chime using Web Audio (more reliable than SpeechSynthesis for initial unlock)
      if (audioContext) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5);
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + 0.5);
      }

      // 3. Force SpeechSynthesis out of any stuck state
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      // 4. Speak a real word to truly "bless" the engine
      // On iOS, we sometimes need to speak an empty string first
      const silent = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(silent);

      const prime = new SpeechSynthesisUtterance('Hello Bella, I am ready!');
      prime.volume = 1.0;
      prime.rate = 1.0;
      window.speechSynthesis.speak(prime);
      
      console.log("Audio system unlock commands sent");
    } catch (e) {
      console.error("Failed to unlock audio:", e);
    }
  };

  const speak = (text: string, forceIdle = false) => {
    console.log("Sarah is preparing to speak:", text.substring(0, 50) + "...");
    
    // iOS Safari workaround: resume the audio context before canceling
    if (window.speechSynthesis) {
      console.log("SpeechSynthesis state:", {
        speaking: window.speechSynthesis.speaking,
        pending: window.speechSynthesis.pending,
        paused: window.speechSynthesis.paused
      });
      window.speechSynthesis.resume();
    }
    
    // Only cancel if already speaking to avoid unnecessary state resets on iOS
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    
    isSpeakingRef.current = true; // Start speaking
    setIsTalking(true);
    currentSpeakingTextRef.current = text;

    // Detect emotion
    const emotion = detectEmotionFromText(text);
    setCurrentEmotion(emotion);

    const parts = text.split(/(<spanish>.*?<\/spanish>)/g).filter(Boolean);
    const utterances: SpeechSynthesisUtterance[] = [];
    const spanishPhrasesSeen = new Set<string>();

    parts.forEach(part => {
      const isSpanish = part.startsWith('<spanish>');
      let textToSpeak = isSpanish ? part.replace(/<\/?spanish>/g, '') : part;
      
      // Remove action text like *giggles* or *smiles* for speech synthesis
      textToSpeak = textToSpeak.replace(/\*.*?\*/g, '').trim();

      if (textToSpeak) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = isSpanish ? 'es-ES' : 'en-US';
        
        // Slow down the second time a Spanish phrase is spoken
        if (isSpanish) {
          if (spanishPhrasesSeen.has(textToSpeak)) {
            utterance.rate = 0.6; // Slow speed
          } else {
            utterance.rate = 1.0; // Natural speed
            spanishPhrasesSeen.add(textToSpeak);
          }
        }
        
        // Try to find a high-quality female voice
        const voices = window.speechSynthesis.getVoices();
        if (isSpanish) {
          const preferredSpanishVoice = voices.find(v => 
            v.lang.startsWith('es') && 
            (v.name.includes('Google') || v.name.includes('Monica') || v.name.includes('Lucia') || v.name.includes('Helena') || v.name.includes('Female'))
          ) || voices.find(v => v.lang.startsWith('es'));
          
          if (preferredSpanishVoice) utterance.voice = preferredSpanishVoice;
        } else {
          const preferredEnglishVoice = voices.find(v => 
            v.lang.startsWith('en') && 
            (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Female'))
          ) || voices.find(v => v.lang.startsWith('en'));
          
          if (preferredEnglishVoice) utterance.voice = preferredEnglishVoice;
        }
        
        utterances.push(utterance);
      }
    });

    if (forceIdle) {
      updateConversationState('IDLE');
    } else if (text.toLowerCase().includes('now, you try!') && text.includes('<spanish>')) {
      const lastSpanish = parts.filter(p => p.startsWith('<spanish>')).pop()?.replace(/<\/?spanish>/g, '') || '';
      updateSpanishPhrase(lastSpanish);
      updateConversationState('AWAITING_PRONUNCIATION');
    } else {
      updateConversationState('LISTENING_FOR_REPLY');
    }

    utterancesRef.current = utterances;

    let utteranceIndex = 0;
  const speakNext = () => {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

      if (!isSpeakingRef.current) {
        console.log("Speak aborted: isSpeakingRef is false");
        utterancesRef.current = [];
        return;
      }

      if (utteranceIndex < utterancesRef.current.length) {
        const utterance = utterancesRef.current[utteranceIndex++];
        console.log(`Speaking segment ${utteranceIndex}/${utterancesRef.current.length}: "${utterance.text.substring(0, 30)}..." [${utterance.lang}]`);
        
        const handleNext = () => {
          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
          setTimeout(() => {
            if (isSpeakingRef.current) speakNext();
          }, 50);
        };

        utterance.onend = handleNext;
        utterance.onerror = (e) => {
          console.error("Speech synthesis utterance error:", e);
          handleNext();
        };

        // Safety timeout for this specific utterance
        safetyTimeoutRef.current = setTimeout(() => {
          console.warn("Speech synthesis safety timeout reached for utterance index:", utteranceIndex - 1);
          handleNext();
        }, 10000); // 10 seconds per segment

        window.speechSynthesis.speak(utterance);
      } else {
        // All parts spoken
        setTimeout(() => {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsTalking(false);
            setCurrentEmotion('neutral');
            lastSpeakEndTimeRef.current = Date.now();
            resetSleepTimer();
            utterancesRef.current = [];
            if (recognitionRef.current) {
              try { recognitionRef.current.stop(); } catch (e) {}
            }
          }
        }, 500);
      }
    };
    
    if (utterances.length > 0) {
      speakNext();
    } else {
      // Nothing to speak, reset state after a delay
      setTimeout(() => {
        if (isSpeakingRef.current) {
          isSpeakingRef.current = false;
          setIsTalking(false);
          setCurrentEmotion('neutral');
          lastSpeakEndTimeRef.current = Date.now();
          resetSleepTimer();
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) {}
          }
        }
      }, 1000);
    }
  };

  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handlePronunciation = async (attempt: string) => {
    updateIsLoading(true);
    const userMessage: Message = { sender: 'user', text: attempt };
    setMessages((prev) => [...prev, userMessage]);

    const feedback = await getPronunciationFeedback(spanishPhraseRef.current, attempt);
    speak(feedback);
    const botMessage: Message = { sender: 'bot', text: feedback };
    setMessages((prev) => [...prev, botMessage]);
    
    updateSpanishPhrase('');
    updateIsLoading(false);
  };

  const handleSubmit = async (command: string) => {
    if (!command.trim() || isLoadingRef.current) return;
    updateIsLoading(true);
    const userMessage: Message = { sender: 'user', text: command };
    setMessages((prev) => [...prev, userMessage]);
    
    const botResponseText = await getSarahResponse(command);
    speak(botResponseText);
    const botMessage: Message = { sender: 'bot', text: botResponseText };
    setMessages((prev) => [...prev, botMessage]);
    updateIsLoading(false);
  };

  const processTranscript = (transcript: string) => {
    if (!transcript || isLoadingRef.current) return;

    const lowerTranscript = transcript.toLowerCase();

    // 1. Check for goodbye commands
    if (/\b(bye|goodbye|bye bye|see you|see ya)\b/i.test(lowerTranscript) && lowerTranscript.split(/\s+/).length <= 6) {
      updateConversationState('IDLE');
      const pauseMsg = "Thank you for talking with me, Bella! I had so much fun. I'll be waiting right here for you to come back. Bye bye!";
      setMessages((prev) => [...prev, { sender: 'user', text: transcript }, { sender: 'bot', text: pauseMsg }]);
      speak(pauseMsg, true);
      return;
    }

    // 2. If IDLE, only listen for wake word
    if (conversationStateRef.current === 'IDLE') {
      if (/(hi|hello|hey|wake up)\b/i.test(lowerTranscript)) {
        updateConversationState('LISTENING_FOR_REPLY');
        const match = lowerTranscript.match(/(hi|hello|hey|wake up)(\s+sarah)?\s*(.*)/i);
        const command = match && match[3] ? match[3].trim() : '';
        
        if (command) {
          handleSubmit(command);
        } else {
          const wakeMsg = "Hi Bella! I'm awake. What would you like to talk about?";
          setMessages((prev) => [...prev, { sender: 'user', text: transcript }, { sender: 'bot', text: wakeMsg }]);
          speak(wakeMsg);
        }
      }
      return;
    }

    // 3. Normal processing
    if (conversationStateRef.current === 'AWAITING_PRONUNCIATION') {
      handlePronunciation(transcript);
    } else {
      handleSubmit(transcript);
    }
  };

  const handleStartListening = async () => {
    console.log("Starting conversation...");
    setMicError(null);
    
    // 1. CRITICAL: Synchronous audio unlock for both Web Audio and SpeechSynthesis
    // This MUST happen directly in the click handler to be "blessed" by the user gesture.
    unlockAudioSystem();

    // 2. Proactively check for microphone support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError("Your browser doesn't support microphone access. Please try a different browser like Chrome or Safari!");
      return;
    }

    // 3. Immediately start Sarah's greeting
    const initialMessage = "Hi Bella! It's nice talking to you! What are you doing?";
    setMessages([{ sender: 'bot', text: initialMessage }]);
    speak(initialMessage);

    // 4. Request microphone access
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      startMicVisualization(stream);
      console.log("Microphone access granted");
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError("Microphone access is blocked! Please click the microphone icon in your browser's address bar to 'Allow' access, then try again.");
      } else {
        setMicError("I can't access your microphone. Please check your settings and try again!");
      }
      return;
    }

    // 5. Attempt to go fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}

    // 6. Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      console.log("Initializing speech recognition...");
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log("Speech recognition service has started. Language:", recognition.lang);
        setIsListening(true);
        isListeningRef.current = true;
      };

      recognition.onaudiostart = () => {
        console.log("Audio capturing started by SpeechRecognition");
      };

      recognition.onresult = (event: any) => {
        resetSleepTimer();

        if (speechStartTimeRef.current === 0 && event.results.length > event.resultIndex) {
          speechStartTimeRef.current = Date.now();
        }

        const isSarahSpeaking = isSpeakingRef.current;
        const timeSinceSpeakEnd = Date.now() - lastSpeakEndTimeRef.current;
        const isJustFinished = lastSpeakEndTimeRef.current > 0 && timeSinceSpeakEnd < 500; // Reduced further
        
        let interimTranscript = '';
        let hasFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcript = result[0].transcript.trim();
          if (!transcript) continue;

          const isEcho = isLikelyEcho(transcript, currentSpeakingTextRef.current);

          // If Sarah is speaking or just finished, we need to be careful about echos
          if (isSarahSpeaking || isJustFinished) {
            if (isEcho) {
              console.log("Ignoring likely echo:", transcript);
              if (result.isFinal) speechStartTimeRef.current = 0;
              continue;
            }

            // Check for interruption commands
            const cleanT = transcript.toLowerCase().replace(/[^\w\s]/g, '').trim();
            const commandWords = ['stop', 'wait', 'pause', 'quiet', 'shut up', 'enough'];
            const tWords = cleanT.split(/\s+/);
            const hasCommandWord = commandWords.some(w => tWords.includes(w));
            
            if (hasCommandWord && tWords.length <= 3) {
              console.log("Interruption command detected:", transcript);
              if (isSarahSpeaking) {
                window.speechSynthesis.cancel();
                isSpeakingRef.current = false;
                setIsTalking(false);
                setCurrentEmotion('neutral');
              }
              // Allow the command itself to be processed
            } else if (isSarahSpeaking) {
              console.log("Ignoring speech while Sarah is talking (not an echo/command):", transcript);
              if (result.isFinal) speechStartTimeRef.current = 0;
              continue;
            }
          }

          if (result.isFinal) {
            console.log("Final transcript received:", transcript);
            hasFinal = true;
            speechStartTimeRef.current = 0;
            if (ignoreNextFinalRef.current) {
               ignoreNextFinalRef.current = false;
               continue;
            }
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            lastInterimTranscriptRef.current = '';
            processTranscript(transcript);
          } else {
            console.log("Interim transcript:", transcript);
            interimTranscript += transcript + ' ';
          }
        }

        if (!hasFinal && interimTranscript.trim()) {
           const currentInterim = interimTranscript.trim();

           if (speechStartTimeRef.current > 0 && Date.now() - speechStartTimeRef.current > 15000) {
              if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
              ignoreNextFinalRef.current = true;
              const finalTranscriptToProcess = currentInterim;
              lastInterimTranscriptRef.current = '';
              speechStartTimeRef.current = 0;
              processTranscript(finalTranscriptToProcess);
              
              if (recognitionRef.current) {
                 try { recognitionRef.current.stop(); } catch (e) {}
              }
              return;
           }

           if (currentInterim !== lastInterimTranscriptRef.current) {
              lastInterimTranscriptRef.current = currentInterim;
              if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
              
              silenceTimeoutRef.current = setTimeout(() => {
                 if (lastInterimTranscriptRef.current) {
                    ignoreNextFinalRef.current = true;
                    const finalTranscriptToProcess = lastInterimTranscriptRef.current;
                    lastInterimTranscriptRef.current = '';
                    speechStartTimeRef.current = 0;
                    processTranscript(finalTranscriptToProcess);
                    
                    if (recognitionRef.current) {
                       try { recognitionRef.current.stop(); } catch (e) {}
                    }
                 }
              }, 2000);
           }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicError("I can't hear you! It looks like microphone access is blocked. Please check your browser settings.");
          setIsListening(false);
          isListeningRef.current = false;
          stopMicVisualization();
        }
      };

      recognition.onend = () => {
        console.log("Speech recognition service ended. isListeningRef:", isListeningRef.current);
        speechStartTimeRef.current = 0;
        
        if (isListeningRef.current) { 
          const restartDelay = 300;
          console.log(`Attempting to restart speech recognition in ${restartDelay}ms...`);
          setTimeout(() => {
            try {
              if (isListeningRef.current && recognitionRef.current) {
                const targetLang = conversationStateRef.current === 'AWAITING_PRONUNCIATION' ? 'es-ES' : 'en-US';
                recognitionRef.current.lang = targetLang;
                recognitionRef.current.start();
                console.log("Speech recognition restarted successfully");
              }
            } catch (e) {
              console.warn("Failed to restart speech recognition (might already be running):", e);
            }
          }, restartDelay); 
        } else {
          console.log("Speech recognition stopped permanently");
          setIsListening(false);
          isListeningRef.current = false;
          stopMicVisualization();
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        console.log("Initial speech recognition start called");
      } catch (e) {
        console.error("Failed to start initial speech recognition:", e);
      }
    } else {
      console.warn('Speech recognition not supported.');
    }
  };
  
  const getPlaceholder = () => {
    switch(conversationState) {
      case 'IDLE': return 'Paused. Say "Hi Sarah" to wake me up.';
      case 'LISTENING_FOR_REPLY': return 'Listening... Go ahead and speak.';
      case 'AWAITING_PRONUNCIATION': return 'Listening... Repeat the Spanish phrase.';
      default: return 'Listening...';
    }
  }

  if (!isListening) {
    return (
      <div className="flex flex-col h-screen font-sans bg-black items-center justify-center text-center p-6">
        <div className="scale-125 md:scale-150 mb-12">
          <SarahFace emotion="happy" isTalking={false} />
        </div>
        <h1 className="text-5xl font-serif text-white font-bold mt-8">Hi, I'm Sarah!</h1>
        <p className="text-xl text-gray-300 mt-4 mb-6 max-w-md">I'm so excited to talk to you! Click the button below to start.</p>
        
        <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10 max-w-md">
          <p className="text-sm text-red-400 mb-2 font-bold uppercase tracking-widest">CRITICAL iPad/iPhone Tip:</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            If you can't hear Sarah, your <span className="text-white font-bold">Silent/Mute switch</span> (on the side of your phone) is likely ON. Please flip it OFF and turn your volume UP!
          </p>
        </div>

        {micError && (
          <div className="mb-8 p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-xl max-w-md animate-bounce">
            {micError}
          </div>
        )}

        <button 
          onClick={handleStartListening}
          className="px-12 py-6 bg-white/10 text-white border border-white/20 rounded-full font-bold text-2xl flex items-center gap-4 hover:bg-white/20 transition-all duration-300 shadow-xl active:scale-95 mb-4"
        >
          <Mic size={32}/>
          Start Talking
        </button>
        <p className="text-sm text-gray-400 font-medium">Make sure you're in a quiet room for the best experience!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-black overflow-hidden">
      {/* Immersive Sarah Display Area - 2/3 of the screen */}
      <div className="h-[60vh] md:h-[66vh] bg-black backdrop-blur-2xl shadow-lg border-b border-white/10 flex flex-col items-center justify-center relative transition-all duration-500 overflow-hidden">
        {/* Audio Visualizer Ring */}
        <div 
          className={`absolute w-48 h-48 md:w-64 md:h-64 rounded-full border-4 transition-all duration-75 ${isTalking ? 'border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.5)]' : 'border-white/20'}`}
          style={{ 
            transform: `scale(${1 + (micLevel / 255) * 0.5 + (isTalking ? 0.1 : 0)})`,
            opacity: (micLevel > 10 || isTalking) ? 0.8 : 0.1
          }}
        ></div>
        <div className={`scale-[1.4] md:scale-[2.0] transition-transform duration-500 relative z-10 ${isTalking ? 'animate-pulse' : ''}`}>
          <SarahFace emotion={currentEmotion} isTalking={isTalking} />
        </div>
        <div className="absolute bottom-8 text-center">
          {/* Text and status indicators removed so the face stands alone */}
        </div>
        <div className="absolute top-4 right-6 flex items-center gap-2 md:gap-4">
           {isIOS && (
             <button 
               onClick={unlockAudioSystem}
               className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-[12px] font-bold transition-all shadow-lg border-2 border-white/30 flex items-center gap-2 animate-pulse"
             >
               <Mic size={14}/> FIX SOUND (IPAD)
             </button>
           )}
           {!isIOS && (
             <button 
               onClick={unlockAudioSystem}
               className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md text-[10px] font-bold transition-colors border border-white/20 flex items-center gap-1"
             >
               <Mic size={10}/> FIX SOUND
             </button>
           )}
           <button 
             onClick={() => {
               setMessages([]);
               updateConversationState('LISTENING_FOR_REPLY');
               setCurrentEmotion('neutral');
               window.location.reload(); 
             }}
             className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md text-[10px] font-bold transition-colors"
           >
             RESET SESSION
           </button>
           <span className="text-[10px] text-gray-400 font-mono font-bold">7" IMMERSIVE MODE</span>
        </div>
      </div>

      {/* Conversation Area - 1/3 of the screen - ONLY Spanish text */}
      <main ref={chatContainerRef} className="h-[34vh] overflow-y-auto p-8 space-y-6 bg-black relative">
        {conversationState === 'AWAITING_PRONUNCIATION' && (
          <div className="sticky top-0 z-10 flex justify-center mb-4">
            <button 
              onClick={() => {
                updateConversationState('LISTENING_FOR_REPLY');
                setMessages(prev => [...prev, { sender: 'bot', text: "Okay, let's just talk in English then! What's on your mind?" }]);
                speak("Okay, let's just talk in English then! What's on your mind?");
              }}
              className="px-6 py-2 bg-white/10 border-2 border-white/20 text-white rounded-full text-sm font-bold shadow-md hover:bg-white/20 transition-all"
            >
              Skip Lesson & Talk in English
            </button>
          </div>
        )}
        {messages.map((msg, index) => {
          // Extract Spanish sentences from the message
          const spanishMatches = msg.text.match(/<spanish>(.*?)<\/spanish>/g);
          if (!spanishMatches && msg.sender === 'bot') return null; // Hide bot messages with no Spanish
          
          const displayText = msg.sender === 'user' 
            ? msg.text 
            : spanishMatches?.map(m => m.replace(/<\/?spanish>/g, '')).join(' ');

          if (!displayText) return null;

          return (
            <div key={index} className={`flex items-end gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] px-10 py-6 rounded-[3rem] text-3xl shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-white/20 text-white rounded-br-none shadow-xl' 
                  : 'bg-white/10 text-white rounded-bl-none border-2 border-white/10 font-bold italic'
              }`}>
                <div className="prose prose-2xl max-w-none prose-p:my-0 leading-relaxed text-white">
                  {displayText}
                </div>
              </div>
            </div>
          );
        })}
         {isLoading && (
            <div className="flex items-end gap-4 justify-start">
                <div className="max-w-lg px-8 py-5 rounded-[2.5rem] bg-white/10 text-white rounded-bl-none shadow-sm border border-white/10">
                    <div className="flex items-center justify-center space-x-3">
                        <div className="w-4 h-4 bg-white/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-4 h-4 bg-white/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-4 h-4 bg-white/50 rounded-full animate-bounce"></div>
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Status Footer - Minimal */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
        {micLevel > 10 && !isTalking && (
          <div className="px-4 py-1 bg-green-500 text-white text-[10px] font-bold rounded-full animate-pulse uppercase tracking-widest">
            Voice Detected
          </div>
        )}
        <div className="px-6 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center gap-3">
           <div className={`w-3 h-3 rounded-full ${conversationState === 'IDLE' ? 'bg-yellow-500' : (micLevel > 10 ? 'bg-green-500 animate-ping' : 'bg-green-500 animate-pulse')}`}></div>
           <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{getPlaceholder()}</span>
        </div>
      </div>
    </div>
  );
}
