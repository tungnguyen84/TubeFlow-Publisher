
import React, { useState } from 'react';
import { Mic, Scissors, Play, Download, Film, FileCode, FolderOpen, Video } from 'lucide-react';

const ContentStudio: React.FC = () => {
    // TTS State
    const [text, setText] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Repurpose State
    const [ffmpegPath, setFfmpegPath] = useState('ffmpeg'); // Default command if in PATH
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [workingFolder, setWorkingFolder] = useState('C:\\Downloads');
    const [startTime, setStartTime] = useState('00:00:00');
    const [duration, setDuration] = useState('60');

    // TTS Handler
    const handleSpeak = () => {
        if (!text) return;
        setIsSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN'; // Vietnamese default
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    // Script Gen Handler
    const handleDownloadScript = () => {
        if (!videoFile) return alert("Vui lòng chọn file video gốc.");
        
        // Windows Batch Script
        const scriptContent = `
@echo off
chcp 65001 >nul
title TubeFlow Auto-Cut
echo ==================================================
echo      TUBEFLOW VIDEO REPURPOSE (LOCAL FFMPEG)
echo ==================================================
echo.

:: Cấu hình đường dẫn
set FFMPEG="${ffmpegPath}"
set INPUT_DIR="${workingFolder}"
set INPUT_FILE="${videoFile.name}"
set OUTPUT_FILE="Short_${videoFile.name}"

set FULL_INPUT="%INPUT_DIR%\%INPUT_FILE%"
set FULL_OUTPUT="%INPUT_DIR%\%OUTPUT_FILE%"

echo [*] FFmpeg Path: %FFMPEG%
echo [*] Input File:  %FULL_INPUT%
echo [*] Time Range:  Start ${startTime} | Duration ${duration}s
echo.

if not exist %FULL_INPUT% (
    echo [!] LOI: Khong tim thay file video dau vao!
    echo     Kiem tra lai folder: %INPUT_DIR%
    goto :End
)

echo [1/1] Processing video...
:: Lenh cat video (Re-encode de dam bao chinh xac frame)
%FFMPEG% -y -i %FULL_INPUT% -ss ${startTime} -t ${duration} -c:v libx264 -crf 23 -c:a aac %FULL_OUTPUT%

if %errorlevel% neq 0 (
    echo.
    echo [!] ERROR: Co loi xay ra khi chay FFmpeg.
    echo     Dam bao duong dan FFmpeg dung hoac da cai dat Environment Variable.
) else (
    echo.
    echo [+] SUCCESS: Da tao file %FULL_OUTPUT%
)

:End
echo.
pause
        `.trim();

        const blob = new Blob([scriptContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cut_script_${videoFile.name.replace(/\.[^/.]+$/, "")}.bat`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Film className="w-6 h-6 text-purple-500" />
                Content Studio
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Voiceover (Browser Native) */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Mic className="w-5 h-5 text-blue-400"/> AI Voiceover (Basic)
                    </h3>
                    <textarea 
                        className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white h-32 mb-4 text-sm" 
                        placeholder="Nhập nội dung cần đọc..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button onClick={handleSpeak} disabled={isSpeaking} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold flex items-center gap-2 text-sm">
                            <Play className="w-4 h-4"/> {isSpeaking ? 'Đang đọc...' : 'Nghe Thử'}
                        </button>
                        <p className="text-xs text-gray-500 mt-2 ml-2">Sử dụng Browser TTS Engine (Miễn phí).</p>
                    </div>
                </div>

                {/* Video Repurpose (Script Gen) */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-pink-400"/> Video Repurpose (Local Script)
                    </h3>
                    
                    <div className="space-y-3 flex-1">
                        <div>
                            <label className="text-xs text-gray-400 font-bold mb-1 block">1. Đường dẫn file FFmpeg.exe</label>
                            <div className="flex gap-2">
                                <input 
                                    value={ffmpegPath} 
                                    onChange={e => setFfmpegPath(e.target.value)}
                                    className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs font-mono" 
                                    placeholder="C:\ffmpeg\bin\ffmpeg.exe" 
                                />
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">Để mặc định là 'ffmpeg' nếu đã cài biến môi trường.</p>
                        </div>

                        <div>
                            <label className="text-xs text-gray-400 font-bold mb-1 block">2. Video Gốc & Thư mục chứa</label>
                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="file" 
                                    accept="video/*"
                                    onChange={e => setVideoFile(e.target.files?.[0] || null)}
                                    className="block w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-pink-900/20 file:text-pink-400 hover:file:bg-pink-900/40"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-gray-600">
                                <FolderOpen className="w-4 h-4 text-gray-500"/>
                                <input 
                                    value={workingFolder}
                                    onChange={e => setWorkingFolder(e.target.value)}
                                    className="flex-1 bg-transparent border-none text-white text-xs outline-none"
                                    placeholder="Thư mục chứa video (VD: C:\Videos)"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-1 block">Bắt đầu (HH:MM:SS)</label>
                                <input 
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs text-center"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold mb-1 block">Thời lượng (Giây)</label>
                                <input 
                                    type="number"
                                    value={duration}
                                    onChange={e => setDuration(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleDownloadScript}
                        disabled={!videoFile}
                        className="mt-4 w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded font-bold text-sm flex items-center justify-center gap-2 transition"
                    >
                        <FileCode className="w-4 h-4" />
                        Tải Script Xử Lý (.bat)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContentStudio;
