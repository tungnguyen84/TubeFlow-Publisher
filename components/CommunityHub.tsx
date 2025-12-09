
import React, { useState } from 'react';
import { MessageCircle, Heart, Trash2, ShieldAlert, Sparkles, Send } from 'lucide-react';
import { UnifiedComment } from '../types';
import { analyzeCommentSentiment } from '../services/geminiService';

const CommunityHub: React.FC = () => {
    const [comments, setComments] = useState<UnifiedComment[]>([]); 
    // Mock comments for demo since we need live data logic from other components
    const [analysisResult, setAnalysisResult] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleAnalyze = async () => {
        // Mock data input
        const demoComments = [
            "Great video! Loved it.",
            "This is trash, unsubscribe.",
            "Check out my channel for free money http://spam.com",
            "Can you explain the last part again?",
            "Amazing content as always."
        ];
        
        setIsLoading(true);
        const sentiments = await analyzeCommentSentiment(demoComments);
        
        const result: Record<string, string> = {};
        demoComments.forEach((c, i) => {
            result[c] = sentiments[i];
        });
        setAnalysisResult(result);
        setIsLoading(false);
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-6 h-6 text-pink-500" />
                Community Hub
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sentiment Analysis */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-400"/> Phân tích Cảm xúc (Demo)
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">Sử dụng AI để phân loại bình luận: Tích cực, Tiêu cực, Spam.</p>
                    
                    <button onClick={handleAnalyze} disabled={isLoading} className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded font-bold w-full mb-4">
                        {isLoading ? 'Đang phân tích...' : 'Chạy thử nghiệm trên mẫu'}
                    </button>

                    <div className="space-y-2">
                        {Object.entries(analysisResult).map(([comment, sentiment], idx) => (
                            <div key={idx} className="bg-gray-900 p-3 rounded flex justify-between items-center border border-gray-700">
                                <span className="text-gray-300 text-sm truncate max-w-[200px]">{comment}</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded 
                                    ${sentiment === 'POSITIVE' ? 'bg-green-900 text-green-400' : 
                                      sentiment === 'NEGATIVE' ? 'bg-red-900 text-red-400' : 
                                      sentiment === 'SPAM' ? 'bg-orange-900 text-orange-400' : 'bg-gray-700 text-gray-400'}`}>
                                    {sentiment}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Community Post Scheduler */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Send className="w-5 h-5 text-blue-400"/> Đăng bài Cộng đồng
                    </h3>
                    <div className="space-y-4">
                        <textarea className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white h-32" placeholder="Bạn đang nghĩ gì? (Tạo Poll, Ảnh...)" />
                        <div className="flex gap-2">
                            <input type="datetime-local" className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm flex-1"/>
                            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold">Lên Lịch</button>
                        </div>
                        <p className="text-xs text-gray-500 italic">Tính năng này yêu cầu quyền API 'posts' đặc biệt từ Google (thường chỉ cấp cho Partner).</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityHub;
