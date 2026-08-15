import React, { useState, useEffect } from 'react';
import { X, Sliders } from 'lucide-react';

interface SidebarSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SidebarSettings: React.FC<SidebarSettingsProps> = ({ isOpen, onClose }) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [pitch, setPitch] = useState<number>(0.9);
  const [rate, setRate] = useState<number>(1.0);

  useEffect(() => {
    const updateVoices = () => {
      if ('speechSynthesis' in window) {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
      }
    };

    updateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    const savedConfig = localStorage.getItem('locarno_assistant_config');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setPitch(config.pitch ?? 0.9);
      setRate(config.rate ?? 1.0);
      setSelectedVoice(config.selectedVoiceURI ?? '');
    }
  }, []);

  const handleSave = () => {
    const config = { pitch, rate, selectedVoiceURI: selectedVoice };
    localStorage.setItem('locarno_assistant_config', JSON.stringify(config));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-[#d4af37] font-semibold text-lg">
              <Sliders className="w-5 h-5" />
              <span>Configuración de Voz (Anthony)</span>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Voz del Sistema
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#d4af37]"
              >
                <option value="">Voz por defecto (Español)</option>
                {voices
                  .filter((v) => v.lang.startsWith('es'))
                  .map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium text-slate-300 mb-1">
                <span>Tono (Pitch)</span>
                <span className="text-[#d4af37]">{pitch}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-[#d4af37]"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium text-slate-300 mb-1">
                <span>Velocidad (Rate)</span>
                <span className="text-[#d4af37]">{rate}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-[#d4af37]"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-sm transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-[#d4af37] hover:bg-[#b8952b] text-slate-950 font-bold rounded-lg text-sm transition"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};                                          
