
import React, { useState } from 'react';
import { Shield, AlertTriangle, EyeOff, Activity, Lock, CheckCircle } from 'lucide-react';
import { fetchChannels } from '../services/supabaseService';

const SafetyCenter: React.FC = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [zombies, setZombies] = useState<any[]>([]);

    const scanDeadChannels = async () => {
        setIsScanning(true);
        const channels = await fetchChannels();
        
        // Mock logic: Find channels with < 100 views total or disconnected
        const dead = channels.filter(c => (c.totalViews || 0) < 100 || !c.refreshToken);
        setZombies(dead);
        
        setIsScanning(false);
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-red-500" />
                Safety & Risk Management
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Copyright Checker */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-orange-400"/> Copyright Pre-Check
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                        Cơ chế: Tự động tải video lên ở chế độ <strong>Private</strong>. Chờ YouTube xử lý (Checks). Nếu phát hiện bản quyền, cảnh báo ngay lập tức.
                    </p>
                    <div className="bg-gray-900 p-4 rounded border border-gray-700 flex items-center justify-center h-32">
                        <div className="text-center">
                            <p className="text-gray-500 text-sm">Chưa có video nào đang chờ check.</p>
                        </div>
                    </div>
                </div>

                {/* Dead Channel Detector */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <EyeOff className="w-5 h-5 text-gray-400"/> Dead Channel Detector
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">Phát hiện kênh "Zombie" (Ít view, mất kết nối, hoặc chết) để ngừng đầu tư tài nguyên.</p>
                    
                    <button onClick={scanDeadChannels} disabled={isScanning} className="w-full bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 py-2 rounded font-bold mb-4">
                        {isScanning ? 'Scanning...' : 'Quét Kênh Chết'}
                    </button>

                    <div className="space-y-2">
                        {zombies.length > 0 ? (
                            zombies.map(c => (
                                <div key={c.id} className="flex justify-between items-center bg-gray-900 p-3 rounded border border-red-900/30">
                                    <span className="text-white font-medium">{c.name}</span>
                                    <span className="text-xs text-red-500 bg-red-900/20 px-2 py-1 rounded">
                                        {!c.refreshToken ? 'Disconnected' : 'Low Views'}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-green-500 flex items-center justify-center gap-2">
                                <CheckCircle className="w-4 h-4"/> Hệ thống khỏe mạnh (hoặc chưa quét)
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SafetyCenter;
