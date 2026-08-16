import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Music, Video, Loader2, Mic, MicOff, Volume2, VolumeX, Download, Sparkles, MessageSquare, Upload, RefreshCw, X, Film, Box, Play, Pause, Copy, ThumbsUp, ThumbsDown, Check, Menu, Search, UserCircle, LogOut } from 'lucide-react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface Message {
  id: string;
  sender: 'user' | 'locarno';
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  originalUploadedUrl?: string;
  feedback?: 'like' | 'dislike' | null;
}

const LOCARNO_LOGO_URL = 'https://i.postimg.cc/HsWgzXv2/1784995369037-(1).png';
const FENIX_URL = 'https://i.postimg.cc/ZRrMjmRp/1000069702-removebg-preview.png';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'studio' | 'motion' | 'editor' | 'cine' | 'musica' | 'partitura' | 'voz'>('chat');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string>(() => {
    try { return localStorage.getItem('locarno_profile_photo') || ''; } catch { return ''; }
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('locarno_chat_history');
      if (saved) return JSON.parse(saved);
      const savedAssistant = localStorage.getItem('locarno_assistant') || 'Anthony';
      const greeting = savedAssistant === 'Yalena'
        ? 'Hola, soy Yalena, tu asistente virtual. ¿En qué puedo ayudarte?'
        : 'Hola, soy Anthony, tu asistente virtual. ¿En qué puedo ayudarte?';
      return [{ id: 'greeting', sender: 'locarno', text: greeting }];
    } catch {
      return [{ id: 'greeting', sender: 'locarno', text: 'Hola, soy Anthony, tu asistente virtual. ¿En qué puedo ayudarte?' }];
    }
  });
  const [input, setInput] = useState('');
  const [chatImageFile, setChatImageFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Estados de Estudio y Estilos
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [editedGallery, setEditedGallery] = useState<{ id: string; original: string | null; prompt: string; resultUrl: string; style: string }[]>([]);
  const [isProcessingImg, setIsProcessingImg] = useState(false);

  // Estados de Movimiento / Video
  const [motionImage, setMotionImage] = useState<string | null>(null);
  const [motionPrompt, setMotionPrompt] = useState('');
  const [motionResult, setMotionResult] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationType, setAnimationType] = useState<'spin-cw' | 'spin-ccw' | 'pulse'>('spin-cw');
  const [isPlayingMotion, setIsPlayingMotion] = useState(true);

  // Estados del Editor de Video
  const [videoClips, setVideoClips] = useState<{ id: string; file: File; url: string; start: number; end: number; duration: number }[]>([]);
  const [overlayText, setOverlayText] = useState('');
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const fileInputVideoRef = useRef<HTMLInputElement>(null);
  const fileInputMusicRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estados de Cine IA (generación de video con Kling vía aimlapi.com)
  const [aimlApiKey, setAimlApiKey] = useState('');
  const [cineImageUrl, setCineImageUrl] = useState('');
  const [cinePrompt, setCinePrompt] = useState('');
  const [cineDuration, setCineDuration] = useState<'5' | '10'>('5');
  const [isCineGenerating, setIsCineGenerating] = useState(false);
  const [cineStatusMsg, setCineStatusMsg] = useState('');
  const [cineResultUrl, setCineResultUrl] = useState<string | null>(null);
  const [cineError, setCineError] = useState('');

  // Estados de Música IA (composición de canciones vía Suno en aimlapi.com)
  const [musicDescription, setMusicDescription] = useState('');
  const [musicLyrics, setMusicLyrics] = useState('');
  const [musicTags, setMusicTags] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [isMusicGenerating, setIsMusicGenerating] = useState(false);
  const [musicStatusMsg, setMusicStatusMsg] = useState('');
  const [musicResultUrl, setMusicResultUrl] = useState<string | null>(null);
  const [musicError, setMusicError] = useState('');

  // Estados de Partituras (transcripción de audio a partitura vía Klangio)
  const [klangioApiKey, setKlangioApiKey] = useState('');
  const [sheetAudioFile, setSheetAudioFile] = useState<File | null>(null);
  const [sheetTitle, setSheetTitle] = useState('');
  const [sheetComposer, setSheetComposer] = useState('');
  const [isSheetGenerating, setIsSheetGenerating] = useState(false);
  const [sheetStatusMsg, setSheetStatusMsg] = useState('');
  const [sheetPdfUrl, setSheetPdfUrl] = useState<string | null>(null);
  const [sheetMidiUrl, setSheetMidiUrl] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState('');
  const fileInputSheetRef = useRef<HTMLInputElement>(null);

  // Estados de Voz IA (conversión de voz vía Kits.ai)
  const [kitsApiKey, setKitsApiKey] = useState('');
  const [voiceModelId, setVoiceModelId] = useState('');
  const [voiceSoundFile, setVoiceSoundFile] = useState<File | null>(null);
  const [isVoiceGenerating, setIsVoiceGenerating] = useState(false);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState('');
  const [voiceResultUrl, setVoiceResultUrl] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const fileInputVoiceRef = useRef<HTMLInputElement>(null);

  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem('locarno_user_name') || ''; } catch { return ''; }
  });
  const [speechStyle, setSpeechStyle] = useState(() => {
    try { return localStorage.getItem('locarno_speech_style') || 'neutro'; } catch { return 'neutro'; }
  });
  const [appLanguage, setAppLanguage] = useState(() => {
    try { return localStorage.getItem('locarno_app_language') || 'es'; } catch { return 'es'; }
  });

  const TRANSLATIONS: Record<string, Record<string, string>> = {
    es: {
      langName: 'Español',
      greetingAnthony: 'Hola, soy Anthony, tu asistente virtual. ¿En qué puedo ayudarte?',
      greetingYalena: 'Hola, soy Yalena, tu asistente virtual. ¿En qué puedo ayudarte?',
      chatPlaceholder: 'Pide estilo 3D, anime o cambios en ropa/fondos...',
      searchPlaceholder: 'Buscar en el historial...',
      menuAssistant: 'Asistente',
      menuVoiceCloud: 'Voz en la nube (ElevenLabs) para Anthony',
      menuVoiceAccent: 'Acento de voz',
      menuLanguage: 'Idioma de la app',
      menuClearHistory: 'Borrar historial del chat',
      speechLangCode: 'es-CO'
    },
    en: {
      langName: 'English',
      greetingAnthony: 'Hi, I\'m Anthony, your virtual assistant. How can I help you?',
      greetingYalena: 'Hi, I\'m Yalena, your virtual assistant. How can I help you?',
      chatPlaceholder: 'Ask for 3D style, anime, or clothing/background changes...',
      searchPlaceholder: 'Search chat history...',
      menuAssistant: 'Assistant',
      menuVoiceCloud: 'Cloud voice (ElevenLabs) for Anthony',
      menuVoiceAccent: 'Voice accent',
      menuLanguage: 'App language',
      menuClearHistory: 'Clear chat history',
      speechLangCode: 'en-US'
    },
    zh: {
      langName: '中文',
      greetingAnthony: '你好，我是Anthony，你的虚拟助手。我能帮你什么？',
      greetingYalena: '你好，我是Yalena，你的虚拟助手。我能帮你什么？',
      chatPlaceholder: '请求3D风格、动漫或服装/背景更改...',
      searchPlaceholder: '搜索聊天记录...',
      menuAssistant: '助手',
      menuVoiceCloud: 'Anthony的云端语音 (ElevenLabs)',
      menuVoiceAccent: '语音口音',
      menuLanguage: '应用语言',
      menuClearHistory: '清除聊天记录',
      speechLangCode: 'zh-CN'
    },
    ja: {
      langName: '日本語',
      greetingAnthony: 'こんにちは、私はロジャー、あなたのバーチャルアシスタントです。何かお手伝いできますか？',
      greetingYalena: 'こんにちは、私はヤレナ、あなたのバーチャルアシスタントです。何かお手伝いできますか？',
      chatPlaceholder: '3Dスタイル、アニメ、服装/背景の変更をリクエスト...',
      searchPlaceholder: '履歴を検索...',
      menuAssistant: 'アシスタント',
      menuVoiceCloud: 'Anthony用クラウド音声 (ElevenLabs)',
      menuVoiceAccent: '音声アクセント',
      menuLanguage: 'アプリの言語',
      menuClearHistory: 'チャット履歴を削除',
      speechLangCode: 'ja-JP'
    },
    ru: {
      langName: 'Русский',
      greetingAnthony: 'Привет, я Роджер, твой виртуальный помощник. Чем могу помочь?',
      greetingYalena: 'Привет, я Ялена, твой виртуальный помощник. Чем могу помочь?',
      chatPlaceholder: 'Запроси 3D стиль, аниме или смену одежды/фона...',
      searchPlaceholder: 'Поиск в истории чата...',
      menuAssistant: 'Ассистент',
      menuVoiceCloud: 'Голос в облаке (ElevenLabs) для Роджера',
      menuVoiceAccent: 'Акцент голоса',
      menuLanguage: 'Язык приложения',
      menuClearHistory: 'Очистить историю чата',
      speechLangCode: 'ru-RU'
    },
    pt: {
      langName: 'Português',
      greetingAnthony: 'Olá, sou o Anthony, seu assistente virtual. Como posso ajudar?',
      greetingYalena: 'Olá, sou a Yalena, sua assistente virtual. Como posso ajudar?',
      chatPlaceholder: 'Peça estilo 3D, anime ou mudanças de roupa/fundo...',
      searchPlaceholder: 'Buscar no histórico...',
      menuAssistant: 'Assistente',
      menuVoiceCloud: 'Voz na nuvem (ElevenLabs) para o Anthony',
      menuVoiceAccent: 'Sotaque de voz',
      menuLanguage: 'Idioma do app',
      menuClearHistory: 'Limpar histórico do chat',
      speechLangCode: 'pt-BR'
    },
    fr: {
      langName: 'Français',
      greetingAnthony: 'Bonjour, je suis Anthony, votre assistant virtuel. Comment puis-je vous aider ?',
      greetingYalena: 'Bonjour, je suis Yalena, votre assistante virtuelle. Comment puis-je vous aider ?',
      chatPlaceholder: 'Demandez un style 3D, anime ou des changements de vêtements/fond...',
      searchPlaceholder: 'Rechercher dans l\'historique...',
      menuAssistant: 'Assistant',
      menuVoiceCloud: 'Voix cloud (ElevenLabs) pour Anthony',
      menuVoiceAccent: 'Accent de la voix',
      menuLanguage: 'Langue de l\'app',
      menuClearHistory: 'Effacer l\'historique du chat',
      speechLangCode: 'fr-FR'
    }
  };
  const t = TRANSLATIONS[appLanguage] || TRANSLATIONS.es;

  const [assistantName, setAssistantName] = useState<'Anthony' | 'Yalena'>(() => {
    try { return (localStorage.getItem('locarno_assistant') as 'Anthony' | 'Yalena') || 'Anthony'; } catch { return 'Anthony'; }
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => {
    try { return localStorage.getItem('locarno_elevenlabs_key') || ''; } catch { return ''; }
  });
  const ROGER_ELEVEN_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // "Adam" - voz masculina clásica, disponible en el plan gratuito
  const [isSpeakingCloud, setIsSpeakingCloud] = useState(false);
  const [cloudVoiceError, setCloudVoiceError] = useState('');
  const [rogerPitch, setAnthonyPitch] = useState(() => {
    try { return parseFloat(localStorage.getItem('locarno_roger_pitch') || '0.85'); } catch { return 0.85; }
  });
  const [yalenaPitch, setYalenaPitch] = useState(() => {
    try { return parseFloat(localStorage.getItem('locarno_yalena_pitch') || '1.15'); } catch { return 1.15; }
  });
  const [rogerVoiceURI, setAnthonyVoiceURI] = useState(() => {
    try { return localStorage.getItem('locarno_roger_voice') || ''; } catch { return ''; }
  });
  const [yalenaVoiceURI, setYalenaVoiceURI] = useState(() => {
    try { return localStorage.getItem('locarno_yalena_voice') || ''; } catch { return ''; }
  });
  const [voiceLang, setVoiceLang] = useState(() => {
    try { return localStorage.getItem('locarno_voice_lang') || 'es-CO'; } catch { return 'es-CO'; }
  });
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => m.text.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : messages;

  const copyMessageText = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 2000);
    });
  };

  const setMessageFeedback = (id: string, feedback: 'like' | 'dislike') => {
    setMessages((prev) => prev.map((m) => (
      m.id === id ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
    )));
  };

  const downloadMessageText = (text: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'locarno_texto.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputChatRef = useRef<HTMLInputElement>(null);
  const fileInputStudioRef = useRef<HTMLInputElement>(null);
  const fileInputMotionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem('locarno_chat_history', JSON.stringify(messages));
    } catch {
      // Si el navegador se queda sin espacio, simplemente no se guarda esta vez
    }
  }, [messages]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    try { localStorage.setItem('locarno_roger_voice', rogerVoiceURI); } catch {}
  }, [rogerVoiceURI]);

  useEffect(() => {
    try { localStorage.setItem('locarno_yalena_voice', yalenaVoiceURI); } catch {}
  }, [yalenaVoiceURI]);

  useEffect(() => {
    try { localStorage.setItem('locarno_roger_pitch', String(rogerPitch)); } catch {}
  }, [rogerPitch]);

  useEffect(() => {
    try { localStorage.setItem('locarno_elevenlabs_key', elevenLabsApiKey); } catch {}
  }, [elevenLabsApiKey]);

  useEffect(() => {
    try { localStorage.setItem('locarno_yalena_pitch', String(yalenaPitch)); } catch {}
  }, [yalenaPitch]);

  useEffect(() => {
    try { localStorage.setItem('locarno_assistant', assistantName); } catch {}
  }, [assistantName]);

  useEffect(() => {
    try { localStorage.setItem('locarno_app_language', appLanguage); } catch {}
  }, [appLanguage]);

  useEffect(() => {
    try { localStorage.setItem('locarno_user_name', userName); } catch {}
  }, [userName]);

  useEffect(() => {
    try { localStorage.setItem('locarno_speech_style', speechStyle); } catch {}
  }, [speechStyle]);

  useEffect(() => {
    try { localStorage.setItem('locarno_voice_lang', voiceLang); } catch {}
  }, [voiceLang]);

  useEffect(() => {
    try { localStorage.setItem('locarno_profile_photo', profilePhoto); } catch {}
  }, [profilePhoto]);

  // Detecta si hay una sesión de cuenta activa y, si la hay, trae los datos guardados en la nube
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'usuarios', u.uid));
          if (snap.exists()) {
            const data = snap.data() as { userName?: string; assistantName?: 'Anthony' | 'Yalena'; messages?: Message[]; photoBase64?: string };
            if (data.userName) setUserName(data.userName);
            if (data.assistantName) setAssistantName(data.assistantName);
            if (data.messages && data.messages.length > 0) setMessages(data.messages);
            if (data.photoBase64) setProfilePhoto(data.photoBase64);
          }
        } catch {
          setAccountError('No se pudieron traer tus datos guardados. Revisa tu conexión.');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Mientras haya sesión activa, guarda el nombre, el asistente elegido, la foto y el historial de chat en la nube
  useEffect(() => {
    if (!authUser) return;
    const timeout = setTimeout(() => {
      setDoc(doc(db, 'usuarios', authUser.uid), { userName, assistantName, messages, photoBase64: profilePhoto }, { merge: true }).catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [authUser, userName, assistantName, messages, profilePhoto]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfilePhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSignup = async () => {
    setAccountError('');
    if (!accountEmail.trim() || !accountPassword.trim()) {
      setAccountError('Escribe tu correo y una contraseña.');
      return;
    }
    if (accountPassword.length < 6) {
      setAccountError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setAccountLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, accountEmail.trim(), accountPassword);
      await setDoc(doc(db, 'usuarios', cred.user.uid), { userName, assistantName, messages }, { merge: true });
      setAccountEmail('');
      setAccountPassword('');
    } catch (e: any) {
      setAccountError(e?.message?.includes('email-already-in-use') ? 'Ese correo ya tiene una cuenta creada. Prueba con "Iniciar sesión".' : 'No se pudo crear la cuenta: ' + (e?.message || 'error desconocido'));
    } finally {
      setAccountLoading(false);
    }
  };

  const handleLogin = async () => {
    setAccountError('');
    if (!accountEmail.trim() || !accountPassword.trim()) {
      setAccountError('Escribe tu correo y tu contraseña.');
      return;
    }
    setAccountLoading(true);
    try {
      await signInWithEmailAndPassword(auth, accountEmail.trim(), accountPassword);
      setAccountEmail('');
      setAccountPassword('');
    } catch (e: any) {
      setAccountError('No se pudo iniciar sesión: correo o contraseña incorrectos.');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowMenu(false);
  };

  const speakWithElevenLabs = async (text: string, voiceId: string): Promise<boolean> => {
    try {
      setIsSpeakingCloud(true);
      setCloudVoiceError('');
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey.trim(),
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });
      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try {
          const errData = await res.json();
          detail = errData?.detail?.message || errData?.detail?.status || JSON.stringify(errData?.detail) || detail;
        } catch {}
        setCloudVoiceError(detail);
        setIsSpeakingCloud(false);
        return false;
      }
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsSpeakingCloud(false);
      audio.onerror = () => setIsSpeakingCloud(false);
      await audio.play();
      return true;
    } catch (err: any) {
      setCloudVoiceError(err?.message || 'No se pudo conectar con ElevenLabs.');
      setIsSpeakingCloud(false);
      return false;
    }
  };

  const speakBrowser = (text: string, forcedAssistant?: 'Anthony' | 'Yalena') => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const activeAssistant = forcedAssistant || assistantName;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = appLanguage === 'es' ? voiceLang : t.speechLangCode;
    const voices = window.speechSynthesis.getVoices();
    const spanishVoices = voices.filter((v) => v.lang.startsWith('es') && !v.lang.startsWith('es-ES'));
    const manualChoice = activeAssistant === 'Yalena' ? yalenaVoiceURI : rogerVoiceURI;

    let chosenVoice: SpeechSynthesisVoice | undefined;
    if (manualChoice === '__male__') {
      chosenVoice = spanishVoices.find((v) => /male|hombre|masculin/i.test(v.name));
    } else if (manualChoice === '__female__') {
      chosenVoice = spanishVoices.find((v) => /female|mujer|femenin/i.test(v.name));
    }

    if (!chosenVoice) {
      chosenVoice = spanishVoices.find((v) => v.lang === voiceLang) || spanishVoices[0] || voices[0];
      if (activeAssistant === 'Yalena') {
        chosenVoice = spanishVoices.find((v) => /female|mujer|femenin/i.test(v.name)) || chosenVoice;
      } else {
        chosenVoice = spanishVoices.find((v) => /male|hombre|masculin/i.test(v.name)) || chosenVoice;
      }
    }

    if (activeAssistant === 'Yalena') {
      utterance.pitch = yalenaPitch;
      utterance.rate = 0.95;
    } else {
      utterance.pitch = rogerPitch;
      utterance.rate = 1;
    }

    if (chosenVoice) utterance.voice = chosenVoice;
    window.speechSynthesis.speak(utterance);
  };

  const speakTextForced = async (text: string, forcedAssistant?: 'Anthony' | 'Yalena') => {
    const activeAssistant = forcedAssistant || assistantName;
    if (activeAssistant === 'Anthony' && elevenLabsApiKey.trim()) {
      const success = await speakWithElevenLabs(text, ROGER_ELEVEN_VOICE_ID);
      if (success) return;
      // Si la nube falla, seguimos con la voz del teléfono como respaldo
    }
    speakBrowser(text, forcedAssistant);
  };

  const speakText = (text: string, forcedAssistant?: 'Anthony' | 'Yalena') => {
    if (isMuted) return;
    speakTextForced(text, forcedAssistant);
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta el reconocimiento de voz.');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (activeTab === 'chat') setInput(transcript);
      else if (activeTab === 'studio') setEditPrompt(transcript);
      else setMotionPrompt(transcript);
    };
    recognition.start();
  };

  const generateStyledImageUrl = (prompt: string, style: string, baseImgUrl?: string | null) => {
    let styleModifier = prompt;
    if (style === '3d') styleModifier += ', Pixar 3D disney style, unreal engine 5 render, volumetric lighting, highly detailed claymation';
    if (style === 'anime') styleModifier += ', anime masterpiece, studio ghibli style, vibrant manga aesthetics, detailed lineart';
    if (style === 'cartoon') styleModifier += ', funny cartoon caricature style, bold outlines, vibrant flat colors, humorous expression';
    if (style === 'modern') styleModifier += ', super sports car luxury vehicle modern hypercar sleek metallic finish';
    if (style === 'photo') styleModifier += ', ultra realistic 8k photograph, professional cinematic lighting';

    const encoded = encodeURIComponent(styleModifier);
    const seed = Math.floor(Math.random() * 100000);
    
    if (baseImgUrl) {
      return `https://image.pollinations.ai/prompt/modify%20photo%20with%20style%3A%20${encoded}?width=800&height=800&seed=${seed}&nologo=true`;
    }
    return `https://image.pollinations.ai/prompt/${encoded}?width=800&height=800&seed=${seed}&nologo=true`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'chat' | 'studio' | 'motion') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'chat') setChatImageFile(reader.result as string);
        if (target === 'studio') setSourceImage(reader.result as string);
        if (target === 'motion') {
          setMotionImage(reader.result as string);
          setMotionResult(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const IMAGE_KEYWORDS = ['dibuja', 'genera una imagen', 'imagen de', 'ilustra', 'ilustración', 'foto de', 'crea una imagen', 'créame una imagen', 'diseña una imagen'];

  const callClaudeChat = async (conversation: Message[]) => {
    const systemPrompt = (assistantName === 'Yalena'
      ? 'Eres Yalena, la asistente de IA dentro de la app Locarno, creada por Anthony Locarno. Tu tono es muy cálido, empático y cariñoso — hablas como alguien que realmente se preocupa por la persona, con cercanía y calidez, sin sonar falsa ni exagerada. Sigues siendo honesta: si algo no se puede hacer, lo dices con delicadeza pero con claridad, sin dar falsas expectativas. Cuando te pidan componer una canción, escribe la letra completa (versos, coro, estructura) lista para copiar y pegar en herramientas de generación musical. Si te piden acordes sobre la letra, colócalos alineados sobre las sílabas usando texto de ancho fijo.'
      : 'Eres Anthony, el asistente de IA dentro de la app Locarno, creada por Anthony Locarno. Respondes de forma directa, concisa y sincera, sin adulaciones ni rodeos. Si algo no se puede hacer, lo dices claramente explicando por qué, sin dar falsas expectativas. Cuando te pidan componer una canción, escribe la letra completa (versos, coro, estructura) lista para copiar y pegar en herramientas de generación musical. Si te piden acordes sobre la letra, colócalos alineados sobre las sílabas usando texto de ancho fijo.'
    ) + (appLanguage === 'es'
      ? ' Responde siempre en español latinoamericano (acento y vocabulario cercano a Colombia/México), nunca en español de España — evita "vosotros", "vale", "coger" y expresiones peninsulares.'
      : ` Responde siempre en el idioma: ${t.langName}, sin importar en qué idioma esté escrito el mensaje del usuario.`)
    + (appLanguage === 'es' && speechStyle === 'costeno' ? ' Habla con estilo costeño/caribeño colombiano: usa expresiones como "ve", "erda", "qué molleja", tono relajado y cercano, sin exagerar ni sonar forzado.' : '')
    + (appLanguage === 'es' && speechStyle === 'paisa' ? ' Habla con estilo paisa (Antioquia, Colombia): usa "parce", "pues", "listo", tono cordial y cercano, sin exagerar ni sonar forzado.' : '')
    + (userName ? ` El usuario se llama ${userName}. Dirígete a él/ella por su nombre de vez en cuando, de forma natural, no en cada mensaje.` : '');

    const res = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: systemPrompt,
        messages: conversation.map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Error al conectar con la IA.');
    }
    return data.content.map((block: any) => (block.type === 'text' ? block.text : '')).join('\n');
  };

  const sendLyricsToMusica = (text: string) => {
    setMusicLyrics(text);
    setMusicStatusMsg('✓ Letra cargada desde el chat. Completa el estilo/género y genera la canción.');
    setActiveTab('musica');
    setShowMenu(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !chatImageFile) || isLoading) return;

    const userText = input.trim() || 'Edita esta foto.';
    const uploadedPic = chatImageFile;
    const isImageRequest = !!uploadedPic || IMAGE_KEYWORDS.some((k) => userText.toLowerCase().includes(k));

    if (!userName) {
      const nameMatch = userText.match(/(?:me llamo|mi nombre es)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i);
      if (nameMatch) {
        const detected = nameMatch[1];
        setUserName(detected.charAt(0).toUpperCase() + detected.slice(1).toLowerCase());
      }
    }

    const userMsg: Message = { 
      id: Date.now().toString(), 
      sender: 'user', 
      text: userText,
      originalUploadedUrl: uploadedPic || undefined
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setChatImageFile(null);
    setIsLoading(true);

    if (isImageRequest) {
      setTimeout(() => {
        const resultImg = generateStyledImageUrl(userText, 'none', uploadedPic);
        const responseText = uploadedPic 
          ? `He procesado tu foto en base a tus instrucciones: "${userText}".`
          : `He generado la imagen solicitada: "${userText}".`;

        const locarnoMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'locarno',
          text: responseText,
          imageUrl: resultImg
        };
        setMessages((prev) => [...prev, locarnoMsg]);
        speakText(responseText);
        setIsLoading(false);
      }, 1500);
      return;
    }

    try {
      const replyText = await callClaudeChat(newMessages);
      const locarnoMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'locarno',
        text: replyText || 'No obtuve respuesta.'
      };
      setMessages((prev) => [...prev, locarnoMsg]);
      speakText(replyText);
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'locarno',
        text: `Hubo un error: ${err.message || 'no se pudo conectar con la IA.'}`
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudioEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPrompt.trim() || isProcessingImg) return;

    setIsProcessingImg(true);
    const resultUrl = generateStyledImageUrl(editPrompt, selectedStyle, sourceImage);

    setTimeout(() => {
      setEditedGallery((prev) => [{
        id: Date.now().toString(),
        original: sourceImage,
        prompt: editPrompt,
        resultUrl: resultUrl,
        style: selectedStyle
      }, ...prev]);
      setIsProcessingImg(false);
      speakText('Transformación completada con éxito en el estudio.');
    }, 1800);
  };

  const generateVoiceConversion = async () => {
    if (!kitsApiKey.trim() || !voiceModelId.trim() || !voiceSoundFile || isVoiceGenerating) return;
    setIsVoiceGenerating(true);
    setVoiceError('');
    setVoiceResultUrl(null);
    setVoiceStatusMsg('Subiendo audio...');

    try {
      const formData = new FormData();
      formData.append('voiceModelId', voiceModelId.trim());
      formData.append('soundFile', voiceSoundFile);

      const createRes = await fetch('https://arpeggi.io/api/kits/v1/voice-conversions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${kitsApiKey.trim()}` },
        body: formData
      });
      const createData = await createRes.json();
      const jobId = createData?.id;
      if (!createRes.ok || !jobId) {
        setVoiceError(createData?.message || 'No se pudo iniciar la conversión. Revisa tu clave y el ID de la voz.');
        setIsVoiceGenerating(false);
        return;
      }

      const startTime = Date.now();
      const timeoutMs = 10 * 60 * 1000;

      const poll = async (): Promise<void> => {
        if (Date.now() - startTime > timeoutMs) {
          setVoiceError('Se agotó el tiempo de espera. Intenta de nuevo.');
          setIsVoiceGenerating(false);
          return;
        }
        const statusRes = await fetch(`https://arpeggi.io/api/kits/v1/voice-conversions/${jobId}`, {
          headers: { 'Authorization': `Bearer ${kitsApiKey.trim()}` }
        });
        const statusData = await statusRes.json();
        const status = statusData?.status;
        const resultUrl = statusData?.fileUrl || statusData?.outputFileUrl || statusData?.downloadUrl || statusData?.resultUrl;

        if ((status === 'success' || status === 'completed' || status === 'done') && resultUrl) {
          setVoiceResultUrl(resultUrl);
          setVoiceStatusMsg('¡Listo!');
          setIsVoiceGenerating(false);
        } else if (status === 'failed' || status === 'error') {
          setVoiceError('Error convirtiendo el audio.');
          setIsVoiceGenerating(false);
        } else {
          setVoiceStatusMsg(`Convirtiendo voz... (${status || 'procesando'})`);
          setTimeout(poll, 8000);
        }
      };
      poll();
    } catch (err) {
      setVoiceError('Hubo un error de conexión. Intenta de nuevo.');
      setIsVoiceGenerating(false);
    }
  };

  const generateSheetMusic = async () => {
    if (!klangioApiKey.trim() || !sheetAudioFile || isSheetGenerating) return;
    setIsSheetGenerating(true);
    setSheetError('');
    setSheetPdfUrl(null);
    setSheetMidiUrl(null);
    setSheetStatusMsg('Subiendo audio...');

    try {
      const url = new URL('https://api.klang.io/transcription');
      url.searchParams.set('model', 'universal');
      if (sheetTitle.trim()) url.searchParams.set('title', sheetTitle.trim());
      if (sheetComposer.trim()) url.searchParams.set('composer', sheetComposer.trim());

      const formData = new FormData();
      formData.append('outputs', 'pdf');
      formData.append('outputs', 'midi');
      formData.append('file', sheetAudioFile);

      const createRes = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'kl-api-key': klangioApiKey.trim() },
        body: formData
      });
      const createData = await createRes.json();
      const jobId = createData?.job_id;
      if (!createRes.ok || !jobId) {
        setSheetError(createData?.message || 'No se pudo iniciar la transcripción. Revisa tu clave de API.');
        setIsSheetGenerating(false);
        return;
      }

      const startTime = Date.now();
      const timeoutMs = 10 * 60 * 1000;

      const poll = async (): Promise<void> => {
        if (Date.now() - startTime > timeoutMs) {
          setSheetError('Se agotó el tiempo de espera. Intenta de nuevo.');
          setIsSheetGenerating(false);
          return;
        }
        const statusRes = await fetch(`https://api.klang.io/job/${jobId}/status`, {
          headers: { 'kl-api-key': klangioApiKey.trim() }
        });
        const statusData = await statusRes.json();
        const status = statusData?.status;

        if (status === 'COMPLETED') {
          setSheetStatusMsg('Descargando resultados...');
          const [pdfRes, midiRes] = await Promise.all([
            fetch(`https://api.klang.io/job/${jobId}/pdf`, { headers: { 'kl-api-key': klangioApiKey.trim() } }),
            fetch(`https://api.klang.io/job/${jobId}/midi`, { headers: { 'kl-api-key': klangioApiKey.trim() } })
          ]);
          const pdfBlob = await pdfRes.blob();
          const midiBlob = await midiRes.blob();
          setSheetPdfUrl(URL.createObjectURL(pdfBlob));
          setSheetMidiUrl(URL.createObjectURL(midiBlob));
          setSheetStatusMsg('¡Listo!');
          setIsSheetGenerating(false);
        } else if (status === 'FAILED') {
          setSheetError('Error transcribiendo el audio.');
          setIsSheetGenerating(false);
        } else {
          setSheetStatusMsg(`Transcribiendo... (${status || 'procesando'})`);
          setTimeout(poll, 8000);
        }
      };
      poll();
    } catch (err) {
      setSheetError('Hubo un error de conexión. Intenta de nuevo.');
      setIsSheetGenerating(false);
    }
  };

  const generateSong = async () => {
    if (!aimlApiKey.trim() || isMusicGenerating) return;
    if (!musicLyrics.trim()) return;
    setIsMusicGenerating(true);
    setMusicError('');
    setMusicResultUrl(null);
    setMusicStatusMsg('Enviando solicitud...');

    try {
      const styleDescription = [musicTags.trim(), musicDescription.trim()].filter(Boolean).join(', ') || 'canción original, buena producción';

      const createRes = await fetch('https://api.aimlapi.com/v2/generate/audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aimlApiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'minimax/music-2.0',
          prompt: styleDescription,
          lyrics: musicLyrics.trim()
        })
      });
      const createData = await createRes.json();
      const genId = createData?.id || createData?.generation_id;
      if (!createRes.ok || !genId) {
        setMusicError(createData?.error?.message || createData?.message || 'No se pudo iniciar la composición. Revisa tu clave de API.');
        setIsMusicGenerating(false);
        return;
      }

      const startTime = Date.now();
      const timeoutMs = 10 * 60 * 1000;

      const poll = async (): Promise<void> => {
        if (Date.now() - startTime > timeoutMs) {
          setMusicError('Se agotó el tiempo de espera. Intenta de nuevo.');
          setIsMusicGenerating(false);
          return;
        }
        const statusRes = await fetch(`https://api.aimlapi.com/v2/generate/audio?generation_id=${genId}`, {
          headers: { 'Authorization': `Bearer ${aimlApiKey.trim()}` }
        });
        const statusData = await statusRes.json();
        const status = statusData?.status;
        const audioUrl = statusData?.audio_file?.url || statusData?.audio?.url || statusData?.url;

        if (status === 'completed' && audioUrl) {
          setMusicResultUrl(audioUrl);
          setMusicStatusMsg('¡Listo!');
          setIsMusicGenerating(false);
        } else if (status === 'error' || status === 'failed') {
          setMusicError(statusData?.error || 'Error generando la canción.');
          setIsMusicGenerating(false);
        } else {
          setMusicStatusMsg(`Componiendo canción... (${status || 'procesando'})`);
          setTimeout(poll, 10000);
        }
      };
      poll();
    } catch (err) {
      setMusicError('Hubo un error de conexión. Intenta de nuevo.');
      setIsMusicGenerating(false);
    }
  };

  const generateCineClip = async () => {
    if (!aimlApiKey.trim() || !cineImageUrl.trim() || isCineGenerating) return;
    setIsCineGenerating(true);
    setCineError('');
    setCineResultUrl(null);
    setCineStatusMsg('Enviando solicitud...');

    try {
      const createRes = await fetch('https://api.aimlapi.com/v2/video/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aimlApiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'kling-video/v1.6/pro/image-to-video',
          image_url: cineImageUrl.trim(),
          prompt: cinePrompt.trim() || 'cinematic slow camera movement, dramatic lighting',
          duration: cineDuration
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.id) {
        setCineError(createData?.error?.message || 'No se pudo iniciar la generación. Revisa tu clave de API.');
        setIsCineGenerating(false);
        return;
      }

      const genId = createData.id;
      const startTime = Date.now();
      const timeoutMs = 10 * 60 * 1000; // 10 minutos

      const poll = async (): Promise<void> => {
        if (Date.now() - startTime > timeoutMs) {
          setCineError('Se agotó el tiempo de espera. Intenta de nuevo.');
          setIsCineGenerating(false);
          return;
        }
        const statusRes = await fetch(`https://api.aimlapi.com/v2/video/generations?generation_id=${genId}`, {
          headers: { 'Authorization': `Bearer ${aimlApiKey.trim()}` }
        });
        const statusData = await statusRes.json();

        if (statusData.status === 'completed' && statusData.video?.url) {
          setCineResultUrl(statusData.video.url);
          setCineStatusMsg('¡Listo!');
          setIsCineGenerating(false);
        } else if (statusData.status === 'error') {
          setCineError(statusData?.error?.message || 'Error generando el video.');
          setIsCineGenerating(false);
        } else {
          setCineStatusMsg(`Generando video... (${statusData.status || 'procesando'})`);
          setTimeout(poll, 15000);
        }
      };
      poll();
    } catch (err) {
      setCineError('Hubo un error de conexión. Intenta de nuevo.');
      setIsCineGenerating(false);
    }
  };

  const handleAddVideoClip = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        setVideoClips((prev) => [...prev, {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          file,
          url,
          start: 0,
          end: tempVideo.duration,
          duration: tempVideo.duration
        }]);
      };
    });
    e.target.value = '';
  };

  const removeClip = (id: string) => {
    setVideoClips((prev) => prev.filter((c) => c.id !== id));
  };

  const updateClipTrim = (id: string, field: 'start' | 'end', value: number) => {
    setVideoClips((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMusicUrl(URL.createObjectURL(file));
  };

  const generateFinalVideo = async () => {
    if (videoClips.length === 0 || isRendering) return;
    setIsRendering(true);
    setRenderedVideoUrl(null);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) { setIsRendering(false); return; }
    canvas.width = 960;
    canvas.height = 540;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const destination = audioCtx.createMediaStreamDestination();

    let musicEl: HTMLAudioElement | null = null;
    if (musicUrl) {
      musicEl = new Audio(musicUrl);
      musicEl.loop = true;
      const musicSource = audioCtx.createMediaElementSource(musicEl);
      const musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.5;
      musicSource.connect(musicGain);
      musicGain.connect(destination);
    }

    const canvasStream = (canvas as any).captureStream(30);
    const finalStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks()
    ]);

    const recordedChunks: Blob[] = [];
    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      setRenderedVideoUrl(URL.createObjectURL(blob));
      setIsRendering(false);
      audioCtx.close();
    };

    recorder.start();
    if (musicEl) await musicEl.play().catch(() => {});

    const drawTextOverlay = () => {
      if (!overlayText.trim()) return;
      ctx.font = 'bold 26px system-ui';
      ctx.textAlign = 'center';
      const textWidth = ctx.measureText(overlayText).width;
      ctx.fillStyle = 'rgba(15,23,42,0.65)';
      ctx.fillRect(canvas.width / 2 - textWidth / 2 - 16, canvas.height - 70, textWidth + 32, 44);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(overlayText, canvas.width / 2, canvas.height - 40);
    };

    for (const clip of videoClips) {
      const videoEl = document.createElement('video');
      videoEl.src = clip.url;
      videoEl.muted = muteOriginalAudio;
      videoEl.playsInline = true;
      await new Promise((resolve) => { videoEl.onloadedmetadata = resolve; });

      if (!muteOriginalAudio) {
        const source = audioCtx.createMediaElementSource(videoEl);
        source.connect(destination);
      }

      videoEl.currentTime = clip.start;
      await new Promise((resolve) => { videoEl.onseeked = resolve; });
      await videoEl.play();

      await new Promise<void>((resolve) => {
        const drawFrame = () => {
          if (videoEl.currentTime >= clip.end || videoEl.ended) {
            videoEl.pause();
            resolve();
            return;
          }
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(canvas.width / videoEl.videoWidth, canvas.height / videoEl.videoHeight);
          const w = videoEl.videoWidth * scale;
          const h = videoEl.videoHeight * scale;
          ctx.drawImage(videoEl, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
          drawTextOverlay();
          requestAnimationFrame(drawFrame);
        };
        drawFrame();
      });
    }

    if (musicEl) musicEl.pause();
    recorder.stop();
  };

  const handleAnimateImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motionImage || isAnimating) return;

    setIsAnimating(true);

    const lowerPrompt = motionPrompt.toLowerCase();
    if (lowerPrompt.includes('antihorario') || lowerPrompt.includes('izquierda') || lowerPrompt.includes('reverse')) {
      setAnimationType('spin-ccw');
    } else if (lowerPrompt.includes('pulso') || lowerPrompt.includes('latido') || lowerPrompt.includes('zoom')) {
      setAnimationType('pulse');
    } else {
      setAnimationType('spin-cw');
    }

    setTimeout(() => {
      setMotionResult(motionImage);
      setIsPlayingMotion(true);
      setIsAnimating(false);
      speakText('Animación generada. Tu imagen ahora tiene movimiento circular fluido.');
    }, 1500);
  };

  return (
    <div style={styles.container}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
        
        @keyframes spinClockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spinCounterClockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes pulseMotion {
          0% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(245,158,11,0.4)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 20px rgba(245,158,11,0.8)); }
          100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(245,158,11,0.4)); }
        }
        @keyframes phoenixFly {
          0% { transform: translateY(0px) scale(1.15); filter: drop-shadow(0 0 5px rgba(245,158,11,0.3)); }
          50% { transform: translateY(-8px) scale(1.2); filter: drop-shadow(0 0 15px rgba(239,68,68,0.5)); }
          100% { transform: translateY(0px) scale(1.15); filter: drop-shadow(0 0 5px rgba(245,158,11,0.3)); }
        }

        .motion-spin-cw { animation: spinClockwise 6s linear infinite; }
        .motion-spin-ccw { animation: spinCounterClockwise 6s linear infinite; }
        .motion-pulse { animation: pulseMotion 2.5s ease-in-out infinite; }
        .animate-phoenix-fly { animation: phoenixFly 2s ease-in-out infinite; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d1527; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
      `}</style>

      {/* HEADER CON LOGO CIRCULAR MEJORADO */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerLogoBadge}>
            <img src={LOCARNO_LOGO_URL} alt="Locarno Ai" style={styles.logoImg} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={styles.headerTitle}>LOCARNO IA</h1>
            <span style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.5px' }}>{userName ? userName.toUpperCase() : 'INVITADO'}</span>
          </div>
        </div>

        <div style={styles.headerRight}>
          {activeTab === 'chat' && (
            <button onClick={() => setShowSearch(!showSearch)} style={styles.iconBtnHeader} title="Buscar en el historial">
              <Search size={18} color={showSearch ? '#f59e0b' : '#94a3b8'} />
            </button>
          )}
          <button onClick={() => { window.speechSynthesis.cancel(); setIsMuted(!isMuted); }} style={styles.iconBtnHeader} title="Silenciar / Activar Voz">
            {isMuted ? <VolumeX size={18} color="#94a3b8" /> : <Volume2 size={18} color="#f59e0b" />}
          </button>
          <button onClick={() => setShowMenu(!showMenu)} style={styles.iconBtnHeader} title="Menú">
            <Menu size={18} color="#f59e0b" />
          </button>
        </div>
      </header>


      {showMenu && (
        <div style={styles.hamburgerMenu}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ cursor: 'pointer', position: 'relative' }}>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Foto de perfil" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f59e0b' }} />
                ) : (
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1527' }}>
                    <UserCircle size={26} color="#94a3b8" />
                  </div>
                )}
              </label>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>{userName || 'Invitado'}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{authUser ? authUser.email : 'Sin cuenta creada'}</div>
              </div>
            </div>

            {authUser ? (
              <button onClick={handleLogout} style={{ ...styles.primaryBtn, background: '#7f1d1d', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px' }}>
                <LogOut size={13} /> Cerrar sesión
              </button>
            ) : (
              <div style={{ marginTop: '10px' }}>
                {accountError && <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '6px' }}>{accountError}</p>}
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{ ...styles.modalInput, marginBottom: '6px', padding: '8px', fontSize: '12px' }}
                />
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  style={{ ...styles.modalInput, marginBottom: '6px', padding: '8px', fontSize: '12px' }}
                />
                <input
                  type="password"
                  placeholder="Contraseña (mínimo 6 caracteres)"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  style={{ ...styles.modalInput, marginBottom: '6px', padding: '8px', fontSize: '12px' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSignup} disabled={accountLoading} style={{ ...styles.primaryBtn, marginTop: 0, flex: 1, padding: '8px', fontSize: '12px' }}>
                    {accountLoading ? '...' : 'Crear cuenta'}
                  </button>
                  <button onClick={handleLogin} disabled={accountLoading} style={{ ...styles.primaryBtn, marginTop: 0, flex: 1, padding: '8px', fontSize: '12px', background: '#1e293b', color: '#f8fafc' }}>
                    {accountLoading ? '...' : 'Ya tengo cuenta'}
                  </button>
                </div>
                <p style={{ fontSize: '10px', color: '#5E7188', marginTop: '6px' }}>
                  Crear cuenta guarda tu nombre, foto e historial en la nube para recuperarlos si pierdes el celular.
                </p>
              </div>
            )}
          </div>

          {[
            { id: 'chat', label: 'Chat', icon: <MessageSquare size={16} /> },
            { id: 'studio', label: 'Estudio', icon: <Sparkles size={16} /> },
            { id: 'motion', label: 'Movimiento', icon: <Film size={16} /> },
            { id: 'editor', label: 'Editor Video', icon: <Video size={16} /> },
            { id: 'cine', label: 'Cine IA', icon: <Sparkles size={16} /> },
            { id: 'musica', label: 'Música IA', icon: <Music size={16} /> },
            { id: 'partitura', label: 'Partituras', icon: <Music size={16} /> },
            { id: 'voz', label: 'Voz IA', icon: <Mic size={16} /> }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as any); setShowMenu(false); }}
              style={{ ...styles.hamburgerItem, color: activeTab === item.id ? '#f59e0b' : '#f8fafc' }}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #1e293b', margin: '6px 0' }} />
          <div style={{ padding: '6px 12px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>{t.menuAssistant}</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAssistantName('Anthony');
                  setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'locarno', text: t.greetingAnthony }]);
                  setTimeout(() => speakText(t.greetingAnthony, 'Anthony'), 100);
                }}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: assistantName === 'Anthony' ? '1px solid #f59e0b' : '1px solid #1e293b', background: assistantName === 'Anthony' ? '#1c2d4a' : '#0d1527', color: assistantName === 'Anthony' ? '#f59e0b' : '#cbd5e1', fontSize: '12px', cursor: 'pointer' }}
              >
                Anthony (directo)
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAssistantName('Yalena');
                  setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'locarno', text: t.greetingYalena }]);
                  setTimeout(() => speakText(t.greetingYalena, 'Yalena'), 100);
                }}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: assistantName === 'Yalena' ? '1px solid #f59e0b' : '1px solid #1e293b', background: assistantName === 'Yalena' ? '#1c2d4a' : '#0d1527', color: assistantName === 'Yalena' ? '#f59e0b' : '#cbd5e1', fontSize: '12px', cursor: 'pointer' }}
              >
                Yalena (cálida)
              </button>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #1e293b', margin: '6px 0' }} />
          <div style={{ padding: '6px 12px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>{t.menuVoiceCloud}</label>
            <input
              type="password"
              value={elevenLabsApiKey}
              onChange={(e) => setElevenLabsApiKey(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Pega tu clave de ElevenLabs"
              style={{ width: '100%', marginTop: '4px', background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); speakWithElevenLabs('Hola, soy Anthony, tu asistente virtual.', ROGER_ELEVEN_VOICE_ID); }}
              disabled={!elevenLabsApiKey.trim() || isSpeakingCloud}
              style={{ width: '100%', marginTop: '4px', padding: '6px', borderRadius: '6px', border: '1px solid #1e293b', background: '#1c2d4a', color: '#f59e0b', fontSize: '11px', cursor: 'pointer' }}
            >
              {isSpeakingCloud ? 'Reproduciendo...' : 'Probar voz en la nube'}
            </button>
            {cloudVoiceError && (
              <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>⚠ {cloudVoiceError}</p>
            )}
            <p style={{ fontSize: '10px', color: '#5E7188', marginTop: '4px' }}>
              Si pones tu clave aquí, Anthony usará esta voz real en la nube en vez de la de tu celular. Si falla, vuelve automáticamente a la voz del teléfono. Yalena sigue usando la voz del teléfono por ahora.
            </p>

            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginTop: '10px' }}>Voz de Anthony (respaldo del teléfono)</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <select
                value={rogerVoiceURI}
                onChange={(e) => setAnthonyVoiceURI(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ flex: 1, background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
              >
                <option value="">Automático</option>
                <option value="__male__">Hombre</option>
              </select>
              <button
                onClick={(e) => { e.stopPropagation(); const u = new SpeechSynthesisUtterance('Hola, soy Anthony.'); u.lang = voiceLang; u.pitch = rogerPitch; const v = availableVoices.find(v => /male|hombre|masculin/i.test(v.name) && v.lang.startsWith('es')); if (v) u.voice = v; window.speechSynthesis.speak(u); }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #1e293b', background: '#1c2d4a', color: '#f59e0b', fontSize: '11px', cursor: 'pointer' }}
              >
                Probar
              </button>
            </div>
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Tono (grave/agudo)</span>
                <span style={{ fontSize: '10px', color: '#f59e0b' }}>{rogerPitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={rogerPitch}
                onChange={(e) => setAnthonyPitch(parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%' }}
              />
            </div>

            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginTop: '10px' }}>Voz de Yalena</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <select
                value={yalenaVoiceURI}
                onChange={(e) => setYalenaVoiceURI(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ flex: 1, background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
              >
                <option value="">Automático</option>
                <option value="__female__">Mujer</option>
              </select>
              <button
                onClick={(e) => { e.stopPropagation(); const u = new SpeechSynthesisUtterance('Hola, soy Yalena.'); u.lang = voiceLang; u.pitch = yalenaPitch; u.rate = 0.95; const v = availableVoices.find(v => /female|mujer|femenin/i.test(v.name) && v.lang.startsWith('es')); if (v) u.voice = v; window.speechSynthesis.speak(u); }}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #1e293b', background: '#1c2d4a', color: '#f59e0b', fontSize: '11px', cursor: 'pointer' }}
              >
                Probar
              </button>
            </div>
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Tono (grave/agudo)</span>
                <span style={{ fontSize: '10px', color: '#f59e0b' }}>{yalenaPitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={yalenaPitch}
                onChange={(e) => setYalenaPitch(parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%' }}
              />
            </div>
            <p style={{ fontSize: '10px', color: '#5E7188', marginTop: '6px' }}>
              "Automático" deja que el sistema elija; "Hombre"/"Mujer" fuerza ese tipo de voz si tu celular tiene una disponible. Usa la barra para ajustar qué tan grave o agudo suena cada voz.
            </p>
          </div>
          <div style={{ borderTop: '1px solid #1e293b', margin: '6px 0' }} />
          <div style={{ padding: '6px 12px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>{t.menuLanguage}</label>
            <select
              value={appLanguage}
              onChange={(e) => setAppLanguage(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', marginTop: '4px', background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
            >
              {Object.keys(TRANSLATIONS).map((code) => (
                <option key={code} value={code}>{TRANSLATIONS[code].langName}</option>
              ))}
            </select>
          </div>
          <div style={{ borderTop: '1px solid #1e293b', margin: '6px 0' }} />
          <div style={{ padding: '6px 12px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Tu nombre</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Se detecta solo cuando lo mencionas, o escríbelo aquí"
              style={{ width: '100%', marginTop: '4px', background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
            />

            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginTop: '10px' }}>Estilo de habla (chat en español)</label>
            <select
              value={speechStyle}
              onChange={(e) => setSpeechStyle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', marginTop: '4px', background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
            >
              <option value="neutro">Neutro</option>
              <option value="costeno">Costeño / Caribeño (Colombia)</option>
              <option value="paisa">Paisa (Antioquia)</option>
            </select>
            <p style={{ fontSize: '10px', color: '#5E7188', marginTop: '4px' }}>
              El nombre lo detecta solo cuando dices "me llamo..." o "mi nombre es..." — y lo va a usar naturalmente en la conversación, no en cada mensaje.
            </p>
          </div>
          <div style={{ borderTop: '1px solid #1e293b', margin: '6px 0' }} />
          <div style={{ padding: '6px 12px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>{t.menuVoiceAccent}</label>
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', marginTop: '4px', background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px', fontSize: '12px' }}
            >
              <option value="es-CO">Español (Colombia)</option>
              <option value="es-MX">Español (México)</option>
              <option value="es-US">Español (Latino neutro)</option>
            </select>
            <p style={{ fontSize: '10px', color: '#5E7188', marginTop: '4px' }}>
              Esto solo aplica cuando el idioma de la app está en Español.
            </p>
          </div>
          <div style={{ borderTop: '1px solid #1e293b', margin: '6px 0' }} />
          <button
            onClick={() => {
              if (confirm('¿Borrar todo el historial del chat? Esta acción no se puede deshacer.')) {
                setMessages([]);
              }
              setShowMenu(false);
            }}
            style={{ ...styles.hamburgerItem, color: '#ef4444' }}
          >
            <X size={16} /> {t.menuClearHistory}
          </button>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main style={styles.main}>
        {activeTab === 'chat' ? (
          messages.length === 0 ? (
            <div style={styles.welcomeContainer}>
              <div style={styles.welcomeLogoWrapper}>
                <img src={LOCARNO_LOGO_URL} alt="Fénix Locarno" style={styles.welcomeLogoImg} />
              </div>
              <h2 style={styles.welcomeTitle}>Locarno Studio Activo</h2>
              <p style={styles.welcomeSub}>Edita fotos, cambia atuendos, aplica estilos 3D, anime o dales movimiento fluido.</p>
              
              <div style={styles.cardsGrid}>
                <div style={styles.activeCard} onClick={() => setActiveTab('studio')}>
                  <Box size={16} color="#f59e0b"/> ✨ Estilos 3D, Caricatura, Ropa y Fondos
                </div>
                <div style={styles.activeCard} onClick={() => setActiveTab('motion')}>
                  <Film size={16} color="#f59e0b"/> 🎬 Dar Movimiento a Fotos
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.messageList}>
              {showSearch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#152238', border: '1px solid #1e293b', borderRadius: '10px', padding: '8px 12px', marginBottom: '4px' }}>
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '13px' }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
              {searchQuery.trim() && filteredMessages.length === 0 && (
                <p style={{ textAlign: 'center', color: '#5E7188', fontSize: '12px', padding: '20px' }}>Sin resultados para "{searchQuery}"</p>
              )}
              {filteredMessages.map((msg) => (
                <div key={msg.id} style={msg.sender === 'user' ? styles.msgUserRow : styles.msgLocarnoRow}>
                  {msg.sender === 'locarno' && (
                    <div style={styles.avatarMini}>
                      <img src={LOCARNO_LOGO_URL} alt="R" style={styles.avatarImg} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%' }}>
                    <div style={msg.sender === 'user' ? { ...styles.msgUserBubble, maxWidth: '100%' } : { ...styles.msgLocarnoBubble, maxWidth: '100%' }}>
                      {msg.originalUploadedUrl && (
                        <div style={{ marginBottom: '8px' }}>
                          <p style={{ fontSize: '11px', color: '#0f172a', fontWeight: 'bold' }}>Foto base subida:</p>
                          <img src={msg.originalUploadedUrl} alt="Subida" style={styles.uploadedMiniPreview} />
                        </div>
                      )}
                      <p style={msg.sender === 'locarno' ? { fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', whiteSpace: 'pre-wrap' } : undefined}>{msg.text}</p>
                      {msg.imageUrl && (
                        <div style={styles.imageCardContainer}>
                          <img src={msg.imageUrl} alt="Resultado IA" style={styles.chatGeneratedImg} />
                          <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" download="locarno_edit.jpg" style={styles.downloadBtn}>
                            <Download size={14} /> Descargar Imagen
                          </a>
                        </div>
                      )}
                    </div>
                    {msg.sender === 'locarno' ? (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px', paddingLeft: '4px' }}>
                        <button onClick={() => copyMessageText(msg.id, msg.text)} style={styles.msgActionBtn} title="Copiar">
                          {copiedMsgId === msg.id ? <Check size={13} color="#f59e0b" /> : <Copy size={13} />}
                        </button>
                        <button onClick={() => speakTextForced(msg.text)} style={styles.msgActionBtn} title="Leer en voz alta">
                          <Volume2 size={13} />
                        </button>
                        <button onClick={() => downloadMessageText(msg.text)} style={styles.msgActionBtn} title="Descargar como texto">
                          <Download size={13} />
                        </button>
                        <button onClick={() => setMessageFeedback(msg.id, 'like')} style={styles.msgActionBtn} title="Me gusta">
                          <ThumbsUp size={13} color={msg.feedback === 'like' ? '#f59e0b' : '#94a3b8'} />
                        </button>
                        <button onClick={() => setMessageFeedback(msg.id, 'dislike')} style={styles.msgActionBtn} title="No me gusta">
                          <ThumbsDown size={13} color={msg.feedback === 'dislike' ? '#ef4444' : '#94a3b8'} />
                        </button>
                        <button onClick={() => sendLyricsToMusica(msg.text)} style={styles.msgActionBtn} title="Usar como letra de canción en Música IA">
                          <Music size={13} color="#f59e0b" />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', paddingRight: '4px' }}>
                        <button onClick={() => copyMessageText(msg.id, msg.text)} style={styles.msgActionBtn} title="Copiar">
                          {copiedMsgId === msg.id ? <Check size={13} color="#f59e0b" /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
                  <img
                    src={FENIX_URL}
                    alt="Fénix pensando"
                    className="animate-phoenix-fly"
                    style={{ width: '80px', height: '80px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Anthony procesando cambios gráficos...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )
        ) : activeTab === 'studio' ? (
          <div style={styles.studioContainer}>
            <div style={styles.studioHeader}>
              <h2 style={{ fontSize: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Sparkles size={22} /> Estudio de Estilos y Edición Avanzada
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                Sube tu foto y selecciona el estilo visual o describe transformaciones de ropa, fondos o vehículos.
              </p>
            </div>

            <div style={styles.uploadBox}>
              <input type="file" accept="image/*" ref={fileInputStudioRef} onChange={(e) => handleFileUpload(e, 'studio')} style={{ display: 'none' }} />
              {sourceImage ? (
                <div style={styles.previewContainer}>
                  <img src={sourceImage} alt="Base" style={styles.previewImg} />
                  <button onClick={() => setSourceImage(null)} style={styles.removeImgBtn}><X size={16}/></button>
                  <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>✓ Foto cargada</p>
                </div>
              ) : (
                <div onClick={() => fileInputStudioRef.current?.click()} style={styles.dropZone}>
                  <Upload size={28} color="#f59e0b" />
                  <p style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px', marginTop: '6px' }}>Sube tu foto aquí</p>
                </div>
              )}
            </div>

            <div style={styles.stylesSelectorContainer}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Estilo visual:</span>
              <div style={styles.chipsRow}>
                <button type="button" onClick={() => setSelectedStyle('modern')} style={{ ...styles.styleChip, borderColor: selectedStyle === 'modern' ? '#f59e0b' : '#1e293b' }}>🏎️ Moderno</button>
                <button type="button" onClick={() => setSelectedStyle('3d')} style={{ ...styles.styleChip, borderColor: selectedStyle === '3d' ? '#f59e0b' : '#1e293b' }}>🧊 3D Pixar</button>
                <button type="button" onClick={() => setSelectedStyle('anime')} style={{ ...styles.styleChip, borderColor: selectedStyle === 'anime' ? '#f59e0b' : '#1e293b' }}>🌸 Anime</button>
                <button type="button" onClick={() => setSelectedStyle('cartoon')} style={{ ...styles.styleChip, borderColor: selectedStyle === 'cartoon' ? '#f59e0b' : '#1e293b' }}>🎨 Caricatura</button>
                <button type="button" onClick={() => setSelectedStyle('photo')} style={{ ...styles.styleChip, borderColor: selectedStyle === 'photo' ? '#f59e0b' : '#1e293b' }}>📸 Fotorrealista</button>
              </div>
            </div>

            <form onSubmit={handleStudioEdit} style={styles.studioForm}>
              <div style={styles.inputGroup}>
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Ej: Cámbiame la ropa, ponme encima de un carro moderno..."
                  style={styles.studioInput}
                />
                <button type="button" onClick={toggleListening} style={{ ...styles.btnMicStudio, backgroundColor: isListening ? '#ef4444' : '#152238' }}>
                  {isListening ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#f59e0b" />}
                </button>
              </div>

              <button type="submit" disabled={isProcessingImg || !editPrompt.trim()} style={styles.btnStudioGenerate}>
                {isProcessingImg ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isProcessingImg ? 'Procesando Transformación...' : 'Aplicar Transformación'}
              </button>
            </form>

            <div style={styles.galleryGrid}>
              {editedGallery.map((item) => (
                <div key={item.id} style={styles.galleryCard}>
                  <div style={styles.compareWrapper}>
                    {item.original && (
                      <div style={styles.compareHalf}>
                        <span style={styles.compareLabel}>Original</span>
                        <img src={item.original} alt="Orig" style={styles.compareImg} />
                      </div>
                    )}
                    <div style={styles.compareHalf}>
                      <span style={{ ...styles.compareLabel, backgroundColor: '#f59e0b', color: '#0f172a' }}>{item.style.toUpperCase()}</span>
                      <img src={item.resultUrl} alt="Res" style={styles.compareImg} />
                    </div>
                  </div>
                  <div style={styles.galleryInfo}>
                    <p style={styles.galleryPrompt}>"{item.prompt}"</p>
                    <a href={item.resultUrl} target="_blank" rel="noopener noreferrer" download="locarno_style.jpg" style={styles.downloadBtn}>
                      <Download size={13} /> Descargar Imagen
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'motion' ? (
          <div style={styles.studioContainer}>
            <div style={styles.studioHeader}>
              <h2 style={{ fontSize: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Film size={22} /> Animación de Fotos & Logos (Movimiento Real)
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                Sube tu logo o imagen y genera un movimiento circular o dinámico en tiempo real.
              </p>
            </div>

            <div style={styles.uploadBox}>
              <input type="file" accept="image/*" ref={fileInputMotionRef} onChange={(e) => handleFileUpload(e, 'motion')} style={{ display: 'none' }} />
              {motionImage ? (
                <div style={styles.previewContainer}>
                  <img src={motionImage} alt="Motion Base" style={styles.previewImg} />
                  <button onClick={() => { setMotionImage(null); setMotionResult(null); }} style={styles.removeImgBtn}><X size={16}/></button>
                  <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>✓ Foto cargada</p>
                </div>
              ) : (
                <div onClick={() => fileInputMotionRef.current?.click()} style={styles.dropZone}>
                  <Upload size={28} color="#f59e0b" />
                  <p style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px', marginTop: '6px' }}>Subir foto o logo para animar</p>
                </div>
              )}
            </div>

            <form onSubmit={handleAnimateImage} style={styles.studioForm}>
              <input
                type="text"
                value={motionPrompt}
                onChange={(e) => setMotionPrompt(e.target.value)}
                placeholder="Ej: Dar movimiento circular en dirección a las líneas..."
                style={styles.studioInput}
              />
              <button type="submit" disabled={isAnimating || !motionImage} style={styles.btnStudioGenerate}>
                {isAnimating ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
                {isAnimating ? 'Generando Movimiento...' : 'Generar Movimiento Circular'}
              </button>
            </form>

            {motionResult && (
              <div style={styles.galleryCard}>
                <div style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <p style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 'bold' }}>✓ Resultado con movimiento activo:</p>

                  <div style={styles.motionStage}>
                    <img 
                      src={motionResult} 
                      alt="Logo Animado" 
                      className={isPlayingMotion ? (animationType === 'spin-ccw' ? 'motion-spin-ccw' : animationType === 'pulse' ? 'motion-pulse' : 'motion-spin-cw') : ''}
                      style={{ width: '220px', height: '220px', borderRadius: '50%', objectFit: 'contain', border: '2px solid #f59e0b' }} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={() => setIsPlayingMotion(!isPlayingMotion)} 
                      style={{ ...styles.downloadBtn, backgroundColor: '#f59e0b', color: '#0f172a', fontWeight: 'bold' }}
                    >
                      {isPlayingMotion ? <Pause size={14} /> : <Play size={14} />}
                      {isPlayingMotion ? 'Pausar Movimiento' : 'Reanudar Movimiento'}
                    </button>

                    <button 
                      onClick={() => setAnimationType(animationType === 'spin-cw' ? 'spin-ccw' : 'spin-cw')} 
                      style={styles.downloadBtn}
                    >
                      <RefreshCw size={14} /> Cambiar Dirección
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'editor' ? (
          <div style={styles.studioContainer}>
            <div style={styles.studioHeader}>
              <h2 style={{ fontSize: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Video size={22} /> Editor de Video
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                Sube tus clips, recórtalos, agrega texto y música, y genera un solo video final.
              </p>
            </div>

            <div style={styles.uploadBox}>
              <input type="file" accept="video/*" multiple ref={fileInputVideoRef} onChange={handleAddVideoClip} style={{ display: 'none' }} />
              <div onClick={() => fileInputVideoRef.current?.click()} style={styles.dropZone}>
                <Upload size={28} color="#f59e0b" />
                <p style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px', marginTop: '6px' }}>Agregar clip(s) de video</p>
              </div>
            </div>

            {videoClips.map((clip, idx) => (
              <div key={clip.id} style={{ background: '#152238', borderRadius: '12px', padding: '12px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 'bold' }}>Clip {idx + 1} ({clip.duration.toFixed(1)}s)</span>
                  <button onClick={() => removeClip(clip.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16} /></button>
                </div>
                <video src={clip.url} controls style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#94a3b8' }}>
                  <label style={{ flex: 1 }}>
                    Inicio (s)
                    <input
                      type="number"
                      min={0}
                      max={clip.duration}
                      step={0.1}
                      value={clip.start}
                      onChange={(e) => updateClipTrim(clip.id, 'start', Math.max(0, Math.min(Number(e.target.value), clip.end)))}
                      style={{ width: '100%', marginTop: '4px', background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px' }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    Fin (s)
                    <input
                      type="number"
                      min={0}
                      max={clip.duration}
                      step={0.1}
                      value={clip.end}
                      onChange={(e) => updateClipTrim(clip.id, 'end', Math.max(clip.start, Math.min(Number(e.target.value), clip.duration)))}
                      style={{ width: '100%', marginTop: '4px', background: '#0d1527', border: '1px solid #1e293b', color: '#fff', borderRadius: '6px', padding: '6px' }}
                    />
                  </label>
                </div>
              </div>
            ))}

            <div style={styles.studioForm}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Texto sobre el video (opcional)</label>
              <input
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                placeholder="Ej: Locarno presenta..."
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Música de fondo (opcional)</label>
              <input type="file" accept="audio/*" ref={fileInputMusicRef} onChange={handleMusicUpload} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputMusicRef.current?.click()} style={{ ...styles.btnStudioGenerate, backgroundColor: '#1c2d4a', color: '#f59e0b' }}>
                <Music size={16} /> {musicUrl ? 'Música cargada ✓' : 'Subir música'}
              </button>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                <input type="checkbox" checked={muteOriginalAudio} onChange={(e) => setMuteOriginalAudio(e.target.checked)} />
                Silenciar el audio original de los clips
              </label>

              <button
                type="button"
                onClick={generateFinalVideo}
                disabled={videoClips.length === 0 || isRendering}
                style={styles.btnStudioGenerate}
              >
                {isRendering ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                {isRendering ? 'Generando video final...' : 'Generar Video Final'}
              </button>

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {renderedVideoUrl && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '6px' }}>✓ Video final listo:</p>
                  <video src={renderedVideoUrl} controls style={{ width: '100%', borderRadius: '10px', border: '1px solid #1e293b' }} />
                  <a href={renderedVideoUrl} download="locarno_video.webm" style={{ ...styles.downloadBtn, marginTop: '8px' }}>
                    <Download size={14} /> Descargar Video
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'cine' ? (
          <div style={styles.studioContainer}>
            <div style={styles.studioHeader}>
              <h2 style={{ fontSize: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Sparkles size={22} /> Cine IA (Foto a Video)
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                Convierte una foto en un clip de video cinematográfico usando IA de pago (aimlapi.com / Kling).
              </p>
            </div>

            <div style={styles.studioForm}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Tu clave de API (aimlapi.com)</label>
              <input
                type="password"
                value={aimlApiKey}
                onChange={(e) => setAimlApiKey(e.target.value)}
                placeholder="Pega aquí tu clave de API"
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Enlace directo de tu foto</label>
              <input
                type="text"
                value={cineImageUrl}
                onChange={(e) => setCineImageUrl(e.target.value)}
                placeholder="https://i.postimg.cc/..."
                style={styles.studioInput}
              />
              <p style={{ fontSize: '11px', color: '#5E7188' }}>Sube tu foto a postimg.cc primero y pega aquí el "Direct link".</p>

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Describe la escena que quieres ver</label>
              <input
                type="text"
                value={cinePrompt}
                onChange={(e) => setCinePrompt(e.target.value)}
                placeholder="Ej: movimiento de cámara lento y cinematográfico, luz dorada de atardecer"
                style={styles.studioInput}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCineDuration('5')} style={{ ...styles.styleChip, flex: 1, borderColor: cineDuration === '5' ? '#f59e0b' : '#1e293b' }}>5 segundos</button>
                <button type="button" onClick={() => setCineDuration('10')} style={{ ...styles.styleChip, flex: 1, borderColor: cineDuration === '10' ? '#f59e0b' : '#1e293b' }}>10 segundos</button>
              </div>

              <button
                type="button"
                onClick={generateCineClip}
                disabled={!aimlApiKey.trim() || !cineImageUrl.trim() || isCineGenerating}
                style={styles.btnStudioGenerate}
              >
                {isCineGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isCineGenerating ? 'Generando...' : 'Generar Clip Cinematográfico'}
              </button>

              {cineStatusMsg && !cineError && <p style={{ fontSize: '12px', color: '#94a3b8' }}>{cineStatusMsg}</p>}
              {cineError && <p style={{ fontSize: '12px', color: '#ef4444' }}>{cineError}</p>}

              {cineResultUrl && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '6px' }}>✓ Clip generado:</p>
                  <video src={cineResultUrl} controls style={{ width: '100%', borderRadius: '10px', border: '1px solid #1e293b' }} />
                  <a href={cineResultUrl} download="locarno_cine.mp4" style={{ ...styles.downloadBtn, marginTop: '8px' }}>
                    <Download size={14} /> Descargar Clip
                  </a>
                  <p style={{ fontSize: '11px', color: '#5E7188', marginTop: '6px' }}>
                    Repite este proceso con cada foto, descarga cada clip, y únelos con tu canción en la pestaña "Editor Video".
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'musica' ? (
          <div style={styles.studioContainer}>
            <div style={styles.studioHeader}>
              <h2 style={{ fontSize: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Music size={22} /> Música IA (Composición)
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                Compón una canción nueva con IA a partir de una descripción o tu propia letra.
              </p>
            </div>

            <div style={styles.studioForm}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Tu clave de API (aimlapi.com)</label>
              <input
                type="password"
                value={aimlApiKey}
                onChange={(e) => setAimlApiKey(e.target.value)}
                placeholder="Pega aquí tu clave de API"
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Título de la canción (opcional)</label>
              <input
                type="text"
                value={musicTitle}
                onChange={(e) => setMusicTitle(e.target.value)}
                placeholder="Ej: Corazón Palmarino"
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Estilo / género (tags)</label>
              <input
                type="text"
                value={musicTags}
                onChange={(e) => setMusicTags(e.target.value)}
                placeholder="Ej: vallenato romántico, acordeón, 90bpm"
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Describe el estilo/ambiente de la canción</label>
              <input
                type="text"
                value={musicDescription}
                onChange={(e) => setMusicDescription(e.target.value)}
                placeholder="Ej: alegre, con acordeón, ritmo bailable"
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Letra de tu canción (obligatoria)</label>
              <textarea
                value={musicLyrics}
                onChange={(e) => setMusicLyrics(e.target.value)}
                placeholder={'[Verso]\nEscribe aquí tu letra...\n\n[Coro]\n...'}
                rows={5}
                style={{ ...styles.studioInput, resize: 'vertical' as const }}
              />
              <p style={{ fontSize: '11px', color: '#5E7188' }}>
                Este modelo necesita la letra completa — ya no la inventa por ti a partir de una descripción.
              </p>

              <button
                type="button"
                onClick={generateSong}
                disabled={!aimlApiKey.trim() || !musicLyrics.trim() || isMusicGenerating}
                style={styles.btnStudioGenerate}
              >
                {isMusicGenerating ? <Loader2 size={16} className="animate-spin" /> : <Music size={16} />}
                {isMusicGenerating ? 'Componiendo...' : 'Componer Canción'}
              </button>

              {musicStatusMsg && !musicError && <p style={{ fontSize: '12px', color: '#94a3b8' }}>{musicStatusMsg}</p>}
              {musicError && <p style={{ fontSize: '12px', color: '#ef4444' }}>{musicError}</p>}

              {musicResultUrl && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '6px' }}>✓ Canción lista:</p>
                  <audio src={musicResultUrl} controls style={{ width: '100%' }} />
                  <a href={musicResultUrl} download="locarno_cancion.mp3" style={{ ...styles.downloadBtn, marginTop: '8px' }}>
                    <Download size={14} /> Descargar Canción
                  </a>
                  <p style={{ fontSize: '11px', color: '#5E7188', marginTop: '6px' }}>
                    Usa esta canción como música de fondo en la pestaña "Editor Video" para tu video cinematográfico.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'partitura' ? (
          <div style={styles.studioContainer}>
            <div style={styles.studioHeader}>
              <h2 style={{ fontSize: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Music size={22} /> Partituras (Audio a Notación)
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                Sube una canción y obtén su partitura en PDF y archivo MIDI.
              </p>
            </div>

            <div style={styles.studioForm}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Tu clave de API (klang.io)</label>
              <input
                type="password"
                value={klangioApiKey}
                onChange={(e) => setKlangioApiKey(e.target.value)}
                placeholder="Pega aquí tu clave de API"
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Archivo de audio (MP3, WAV)</label>
              <input type="file" accept="audio/*" ref={fileInputSheetRef} onChange={(e) => setSheetAudioFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputSheetRef.current?.click()} style={{ ...styles.btnStudioGenerate, backgroundColor: '#1c2d4a', color: '#f59e0b' }}>
                <Upload size={16} /> {sheetAudioFile ? `✓ ${sheetAudioFile.name}` : 'Subir canción'}
              </button>

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Título (opcional)</label>
              <input type="text" value={sheetTitle} onChange={(e) => setSheetTitle(e.target.value)} placeholder="Ej: La Musa Universal" style={styles.studioInput} />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Compositor (opcional)</label>
              <input type="text" value={sheetComposer} onChange={(e) => setSheetComposer(e.target.value)} placeholder="Ej: Anthony Locarno" style={styles.studioInput} />

              <button
                type="button"
                onClick={generateSheetMusic}
                disabled={!klangioApiKey.trim() || !sheetAudioFile || isSheetGenerating}
                style={styles.btnStudioGenerate}
              >
                {isSheetGenerating ? <Loader2 size={16} className="animate-spin" /> : <Music size={16} />}
                {isSheetGenerating ? 'Transcribiendo...' : 'Generar Partitura'}
              </button>

              {sheetStatusMsg && !sheetError && <p style={{ fontSize: '12px', color: '#94a3b8' }}>{sheetStatusMsg}</p>}
              {sheetError && <p style={{ fontSize: '12px', color: '#ef4444' }}>{sheetError}</p>}

              {sheetPdfUrl && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '12px', color: '#f59e0b' }}>✓ Partitura lista:</p>
                  <a href={sheetPdfUrl} download="locarno_partitura.pdf" style={styles.downloadBtn}>
                    <Download size={14} /> Descargar Partitura (PDF)
                  </a>
                  {sheetMidiUrl && (
                    <a href={sheetMidiUrl} download="locarno_partitura.midi" style={styles.downloadBtn}>
                      <Download size={14} /> Descargar Archivo MIDI
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.studioContainer}>
            <div style={styles.studioHeader}>
              <h2 style={{ fontSize: '20px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Mic size={22} /> Voz IA (Conversión de Voz)
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                Canta tu canción y conviértela a una voz profesional (la tuya clonada u otra de la librería).
              </p>
            </div>

            <div style={styles.studioForm}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Tu clave de API (kits.ai)</label>
              <input
                type="password"
                value={kitsApiKey}
                onChange={(e) => setKitsApiKey(e.target.value)}
                placeholder="Pega aquí tu clave de API"
                style={styles.studioInput}
              />

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>ID de la voz (voiceModelId)</label>
              <input
                type="text"
                value={voiceModelId}
                onChange={(e) => setVoiceModelId(e.target.value)}
                placeholder="Ej: 1014961"
                style={styles.studioInput}
              />
              <p style={{ fontSize: '11px', color: '#5E7188' }}>
                Búscalo en app.kits.ai/voices (o el ID de tu propia voz clonada, si ya la entrenaste ahí).
              </p>

              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Tu grabación cantando (WAV, MP3 o FLAC)</label>
              <input type="file" accept="audio/*" ref={fileInputVoiceRef} onChange={(e) => setVoiceSoundFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputVoiceRef.current?.click()} style={{ ...styles.btnStudioGenerate, backgroundColor: '#1c2d4a', color: '#f59e0b' }}>
                <Upload size={16} /> {voiceSoundFile ? `✓ ${voiceSoundFile.name}` : 'Subir mi grabación'}
              </button>

              <button
                type="button"
                onClick={generateVoiceConversion}
                disabled={!kitsApiKey.trim() || !voiceModelId.trim() || !voiceSoundFile || isVoiceGenerating}
                style={styles.btnStudioGenerate}
              >
                {isVoiceGenerating ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                {isVoiceGenerating ? 'Convirtiendo...' : 'Convertir mi Voz'}
              </button>

              {voiceStatusMsg && !voiceError && <p style={{ fontSize: '12px', color: '#94a3b8' }}>{voiceStatusMsg}</p>}
              {voiceError && <p style={{ fontSize: '12px', color: '#ef4444' }}>{voiceError}</p>}

              {voiceResultUrl && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '6px' }}>✓ Voz convertida:</p>
                  <audio src={voiceResultUrl} controls style={{ width: '100%' }} />
                  <a href={voiceResultUrl} download="locarno_voz.wav" style={{ ...styles.downloadBtn, marginTop: '8px' }}>
                    <Download size={14} /> Descargar Audio
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER CHAT */}
      {activeTab === 'chat' && (
        <footer style={styles.footer}>
          {chatImageFile && (
            <div style={styles.chatImagePreviewBar}>
              <img src={chatImageFile} alt="Preview" style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
              <span style={{ fontSize: '11px', color: '#f59e0b' }}>Foto lista para modificar</span>
              <button onClick={() => setChatImageFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={15}/></button>
            </div>
          )}
          <form onSubmit={handleSend} style={styles.form}>
            <input type="file" accept="image/*" ref={fileInputChatRef} onChange={(e) => handleFileUpload(e, 'chat')} style={{ display: 'none' }} />
            <button type="button" onClick={() => fileInputChatRef.current?.click()} style={styles.btnMic} title="Adjuntar foto">
              <ImageIcon size={18} color="#cbd5e1" />
            </button>
            <button type="button" onClick={toggleListening} style={{ ...styles.btnMic, backgroundColor: isListening ? '#ef4444' : '#152238' }}>
              {isListening ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#f59e0b" />}
            </button>
            <div style={styles.inputWrapper}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder={t.chatPlaceholder}
                style={styles.input}
              />
              <button type="submit" disabled={isLoading || (!input.trim() && !chatImageFile)} style={styles.btnSend}>
                <Send size={16} color="#0f172a" />
              </button>
            </div>
          </form>
        </footer>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' },
  modalBox: { background: '#152238', border: '1px solid #1e293b', borderRadius: '14px', padding: '18px', width: '100%', maxWidth: '360px' },
  modalInput: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b', background: '#0d1527', color: '#f8fafc', fontSize: '13px', marginBottom: '10px' },
  primaryBtn: { width: '100%', padding: '11px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: '#0d1527', fontWeight: '700' as const, fontSize: '13px', cursor: 'pointer', marginTop: '4px' },
  container: { display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#0d1527', color: '#f8fafc', position: 'relative' as const, overflow: 'hidden' },
  
  // ESTILOS DE BARRA SUPERIOR CON LOGO CIRCULAR AMPLIADO
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#152238', borderBottom: '1px solid #1e293b', height: '64px', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  hamburgerBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', marginRight: '4px', display: 'flex', alignItems: 'center' },
  hamburgerMenu: { position: 'absolute', top: '64px', right: 0, zIndex: 50, background: '#152238', border: '1px solid #1e293b', borderRadius: '12px 0 12px 12px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', width: '240px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '-4px 4px 20px rgba(0,0,0,0.4)' },
  hamburgerItem: { display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', textAlign: 'left' as const },
  headerLogoBadge: { 
    width: '44px', 
    height: '44px', 
    borderRadius: '50%', 
    border: '2px solid #f59e0b', 
    backgroundColor: '#0d1527', 
    padding: '3px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    overflow: 'hidden',
    boxShadow: '0 0 10px rgba(245,158,11,0.3)'
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' },
  headerTitle: { fontSize: '15px', fontWeight: '800', color: '#f59e0b', letterSpacing: '1px', lineHeight: '1.1' },
  
  tabNav: { display: 'flex', gap: '8px', backgroundColor: '#0d1527', padding: '4px', borderRadius: '12px', border: '1px solid #1e293b', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', maxWidth: '100%' },
  tabBtn: { display: 'flex', alignItems: 'center', gap: '6px', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0, whiteSpace: 'nowrap' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  iconBtnHeader: { background: '#0d1527', border: '1px solid #1e293b', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  main: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px', WebkitOverflowScrolling: 'touch', minHeight: 0 },
  welcomeContainer: { display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '80%' },
  welcomeLogoWrapper: { width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #f59e0b', backgroundColor: '#0d1527', marginBottom: '14px', boxShadow: '0 0 20px rgba(245,158,11,0.2)' },
  welcomeLogoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  welcomeTitle: { fontSize: '22px', fontWeight: 700, marginBottom: '6px', color: '#f8fafc' },
  welcomeSub: { fontSize: '13px', color: '#94a3b8', marginBottom: '20px', maxWidth: '320px' },
  cardsGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' },
  activeCard: { display: 'flex', alignItems: 'center', gap: '6px', background: '#1c2d4a', border: '1px solid #f59e0b', padding: '10px 14px', borderRadius: '12px', fontSize: '12px', color: '#f59e0b', fontWeight: 600, cursor: 'pointer' },
  messageList: { display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '750px', margin: '0 auto', width: '100%' },
  msgUserRow: { display: 'flex', justifyContent: 'flex-end' },
  msgLocarnoRow: { display: 'flex', justifyContent: 'flex-start', gap: '8px', alignItems: 'flex-start' },
  avatarMini: { width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #f59e0b', backgroundColor: '#0d1527', flexShrink: 0 },
  avatarMiniFly: { width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #ef4444', backgroundColor: '#0d1527', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  msgUserBubble: { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0f172a', fontWeight: 600, padding: '10px 14px', borderRadius: '16px 16px 2px 16px', maxWidth: '85%', fontSize: '13px' },
  msgLocarnoBubble: { background: '#152238', color: '#f1f5f9', padding: '10px 14px', borderRadius: '16px 16px 16px 2px', maxWidth: '85%', fontSize: '13px', border: '1px solid #1e293b' },
  uploadedMiniPreview: { width: '70px', height: '70px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #0f172a', marginTop: '4px' },
  typingIndicator: { display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '12px' },
  imageCardContainer: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' },
  chatGeneratedImg: { width: '100%', maxWidth: '280px', borderRadius: '10px', border: '1px solid #1e293b' },
  downloadBtn: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#1c2d4a', color: '#f59e0b', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', textDecoration: 'none', border: '1px solid #f59e0b40', width: 'fit-content', cursor: 'pointer' },
  msgActionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: '#94a3b8' },
  
  studioContainer: { maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' },
  studioHeader: { textAlign: 'center', padding: '4px 0' },
  uploadBox: { background: '#152238', border: '2px dashed #1e293b', borderRadius: '14px', padding: '16px', textAlign: 'center' },
  dropZone: { cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  previewContainer: { position: 'relative', display: 'inline-block' },
  previewImg: { width: '140px', height: '140px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #f59e0b' },
  removeImgBtn: { position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stylesSelectorContainer: { display: 'flex', flexDirection: 'column', gap: '6px', background: '#152238', padding: '10px 14px', borderRadius: '12px', border: '1px solid #1e293b' },
  chipsRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  styleChip: { background: '#0d1527', border: '1px solid #1e293b', color: '#cbd5e1', padding: '5px 10px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer' },
  studioForm: { display: 'flex', flexDirection: 'column', gap: '12px', background: '#152238', padding: '14px', borderRadius: '14px', border: '1px solid #1e293b' },
  inputGroup: { display: 'flex', gap: '8px' },
  studioInput: { flex: 1, backgroundColor: '#0d1527', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '10px', outline: 'none', fontSize: '13px' },
  btnMicStudio: { border: '1px solid #1e293b', padding: '0 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnStudioGenerate: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#f59e0b', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' },
  galleryGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  galleryCard: { background: '#152238', borderRadius: '12px', overflow: 'hidden', border: '1px solid #1e293b' },
  motionStage: { padding: '30px', background: '#0d1527', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', border: '1px solid #1e293b' },
  compareWrapper: { display: 'flex', gap: '2px', backgroundColor: '#0d1527' },
  compareHalf: { flex: 1, position: 'relative' },
  compareLabel: { position: 'absolute', top: '6px', left: '6px', backgroundColor: '#0d1527aa', color: '#fff', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  compareImg: { width: '100%', height: '180px', objectFit: 'cover' },
  galleryInfo: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  galleryPrompt: { fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' },

  footer: { padding: '10px 16px', backgroundColor: '#0d1527', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 },
  chatImagePreviewBar: { display: 'flex', alignItems: 'center', gap: '8px', background: '#152238', padding: '4px 10px', borderRadius: '8px', maxWidth: '750px', margin: '0 auto', width: '100%' },
  form: { display: 'flex', gap: '8px', alignItems: 'center', maxWidth: '750px', margin: '0 auto', width: '100%' },
  btnMic: { border: '1px solid #1e293b', padding: '10px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  inputWrapper: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#152238', border: '1px solid #1e293b', color: '#f8fafc', padding: '12px 45px 12px 14px', borderRadius: '12px', fontSize: '13px', outline: 'none' },
  btnSend: { position: 'absolute', right: '6px', backgroundColor: '#f59e0b', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}:
