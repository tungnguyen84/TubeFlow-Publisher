
import React, { useState, useEffect } from 'react';
import { Mic, Play, Film, FileText, Sparkles, Copy } from 'lucide-react';
import { generateVideoScript } from '../services/geminiService';

const ContentStudio: React.FC = () => {
    // TTS State
    const [text, setText] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    // AI Script State
    const [topic, setTopic] = useState('');
    const [script, setScript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Load auto topic from Trend Hunter
    useEffect(() => {
        const draftTopic = localStorage.getItem('draft_topic');
        if (draftTopic) {
            setTopic(draftTopic);
            localStorage.removeItem('draft_topic'); // consume it
        }
    }, []);

    // TTS Handler (Browser API)
    const handleSpeak = () => {
        if (!text) return;
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN'; // Vietnamese default
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    // AI Script Gen Handler
    const handleGenerateScript = async () => {
        if (!topic) return alert("Vui lòng nhập chủ đề video.");
        setIsGenerating(true);
        setScript('');
        try {
            const result = await generateVideoScript(topic);
            setScript(result);
        } catch (e: any) {
            setScript("Lỗi: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Film className="w-6 h-6 text-purple-500" />
                Content Studio (Online)
            </h2>
            <p className="text-gray-400 text-sm">Bộ công cụ sáng tạo nội dung trực tuyến sử dụng AI (Không cần phần mềm cài đặt).</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                {/* AI Script Writer */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400"/> AI Script Writer
                    </h3>
                    
                    <div className="mb-4">
                        <label className="text-xs text-gray-400 font-bold mb-1 block">Chủ đề Video / Ý tưởng</label>
                        <div className="flex gap-2">
                            <input 
                                value={topic} 
                                onChange={e => setTopic(e.target.value)}
                                className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" 
                                placeholder="VD: Cách kiếm tiền online 2024..." 
                                onKeyDown={e => e.key === 'Enter' && handleGenerateScript()}
                            />
                            <button 
                                onClick={handleGenerateScript}
                                disabled={isGenerating || !topic}
                                className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-1"
                            >
                                {isGenerating ? <Sparkles className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
                                Viết
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-gray-900 border border-gray-600 rounded p-4 overflow-y-auto relative group">
                        {script ? (
                            <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">
                                {script}
                            </pre>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm italic">
                                <FileText className="w-8 h-8 mb-2 opacity-50" />
                                <p>Nhập chủ đề để AI viết kịch bản chi tiết cho bạn.</p>
                            </div>
                        )}
                        
                        {script && (
                            <button 
                                onClick={() => {navigator.clipboard.writeText(script); alert("Đã copy kịch bản!");}}
                                className="absolute top-2 right-2 p-2 bg-gray-800 text-gray-400 hover:text-white rounded opacity-0 group-hover:opacity-100 transition"
                                title="Copy Script"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* AI Voiceover (Basic TTS) */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Mic className="w-5 h-5 text-blue-400"/> Text-to-Speech (Browser)
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">Chuyển văn bản thành giọng nói tiếng Việt (để kiểm tra kịch bản hoặc làm voice-over đơn giản).</p>
                    
                    <textarea 
                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-white text-sm mb-4 resize-none" 
                        placeholder="Nhập nội dung cần đọc..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />
                    
                    <div className="flex justify-between items-center">
                         <div className="text-xs text-gray-400 flex items-center gap-1">
                             <div className="w-2 h-2 rounded-full bg-green-500"></div> Browser Engine Active
                         </div>
                         <button 
                            onClick={handleSpeak} 
                            disabled={isSpeaking || !text} 
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded font-bold flex items-center gap-2 text-sm"
                        >
                            <Play className="w-4 h-4"/> {isSpeaking ? 'Đang đọc...' : 'Đọc Ngay'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContentStudio;
