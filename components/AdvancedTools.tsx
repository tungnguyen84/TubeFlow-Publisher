import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Sparkles, TrendingUp, Edit3, Scissors, 
  RefreshCw, Search, Image as ImageIcon, CheckCircle2, 
  Send, Users, Copy, ExternalLink, ThumbsUp, Eye, Calendar, Bot, Zap, Filter, AlertTriangle, XCircle, Power
} from 'lucide-react';
import { Channel, UnifiedComment, CompetitorVideo, VideoItem, VideoStatus } from '../types';
import { fetchChannels, fetchSystemSettings, fetchVideos, bulkUpdateVideos, saveVideo, updateChannelAccessTokenOnly } from '../services/supabaseService';
import { fetchRecentComments, replyToComment, fetchCompetitorVideos, refreshAccessToken } from '../services/youtubeService';
import { generateCommentReply, analyzeThumbnail, findTrends } from '../services/geminiService';

const TabButton = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition
      ${active ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const AdvancedTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'COMMUNITY' | 'VISION' | 'COMPETITOR' | 'BULK' | 'REPURPOSE'>('COMMUNITY');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  
  useEffect(() => {
    const init = async () => {
       const [c, s] = await Promise.all([fetchChannels(), fetchSystemSettings()]);
       setChannels(c);
       setSystemSettings(s);
    };
    init();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          Advanced Creator Tools
        </h2>
        <p className="text-gray-400 text-sm mt-1">Bộ công cụ AI & Automation nâng cao dành cho nhà sáng tạo chuyên nghiệp</p>
      </div>

      <div className="border-b border-gray-700 flex gap-2 overflow-x-auto">
        <TabButton icon={MessageCircle} label="Unified Community" active={activeTab === 'COMMUNITY'} onClick={() => setActiveTab('COMMUNITY')} />
        <TabButton icon={ImageIcon} label="Thumbnail Vision" active={activeTab === 'VISION'} onClick={() => setActiveTab('VISION')} />
        <TabButton icon={TrendingUp} label="Trend & Competitors" active={activeTab === 'COMPETITOR'} onClick={() => setActiveTab('COMPETITOR')} />
        <TabButton icon={Edit3} label="Bulk Editor" active={activeTab === 'BULK'} onClick={() => setActiveTab('BULK')} />
        <TabButton icon={Scissors} label="Video Repurpose" active={activeTab === 'REPURPOSE'} onClick={() => setActiveTab('REPURPOSE')} />
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'COMMUNITY' && <CommunityManager channels={channels} settings={systemSettings} />}
        {activeTab === 'VISION' && <ThumbnailVision />}
        {activeTab === 'COMPETITOR' && <CompetitorTracker settings={systemSettings} />}
        {activeTab === 'BULK' && <BulkEditor />}
        {activeTab === 'REPURPOSE' && <RepurposeTool channels={channels} />}
      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

// 1. Unified Community
const CommunityManager = ({ channels, settings }: { channels: Channel[], settings: any }) => {
  const [comments, setComments] = useState<UnifiedComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(''); 
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<{name: string, status: string, color: string}[]>([]); // New: Log
  
  // FILTER MODE
  const [filterMode, setFilterMode] = useState<'UNREPLIED' | 'ALL'>('UNREPLIED');

  // AUTO REPLY STATE
  const [isAutoReplyActive, setIsAutoReplyActive] = useState(false);
  const [autoLog, setAutoLog] = useState<string>('');
  const isAutoReplyRunningRef = useRef(false);

  // Helper: Get Valid Token (Refresh if needed)
  const getValidToken = async (ch: Channel) => {
      let tokenToUse = ch.accessToken;
      if (ch.tokenExpiresAt && Date.now() > (ch.tokenExpiresAt - 60 * 1000)) {
          if (ch.refreshToken && ch.clientSecret) {
               try {
                   const clientId = ch.clientId || settings?.googleClientId;
                   if (clientId) {
                       const newToken = await refreshAccessToken(ch.refreshToken, clientId, ch.clientSecret);
                       tokenToUse = newToken.access_token;
                       await updateChannelAccessTokenOnly(ch.id, tokenToUse, newToken.expires_in);
                   }
               } catch (err) {
                   console.warn(`Failed to refresh token for ${ch.name}:`, err);
                   return tokenToUse; // Return old token, let it fail in main loop to show error
               }
          }
      }
      return tokenToUse;
  }

  const loadComments = async () => {
    if (channels.length === 0) return;
    setIsLoading(true);
    setComments([]); 
    setScanResults([]); // Reset Logs
    
    const BATCH_SIZE = 3; 
    let processedCount = 0;

    // Helper process single channel
    const processChannel = async (ch: Channel) => {
        if (!ch.accessToken || !ch.youtubeId) {
            setScanResults(prev => [...prev, { name: ch.name, status: "Chưa kết nối (Token/ID thiếu)", color: "text-red-500" }]);
            return [];
        }
        
        let token = await getValidToken(ch);
        if (!token) {
            setScanResults(prev => [...prev, { name: ch.name, status: "Token không hợp lệ", color: "text-red-500" }]);
            return [];
        }

        try {
            // DEEP SCAN 500
            const res = await fetchRecentComments(token, ch.youtubeId, 500); 
            
            let filtered = res;
            if (filterMode === 'UNREPLIED') {
                filtered = res.filter(c => {
                    // SMART FILTER:
                    const ownerReplied = c.replies?.some((r: any) => r.authorChannelId === ch.youtubeId);
                    if (ownerReplied) return false;
                    const hasAnyReply = (c as any).totalReplyCount > 0 || (c.replies && c.replies.length > 0);
                    return !hasAnyReply;
                });
            }

            if (filtered.length === 0) {
                 const msg = res.length > 0 
                    ? `Quét ${res.length} comments -> Tất cả đã trả lời.` 
                    : "Không tìm thấy comment nào trên kênh.";
                 setScanResults(prev => [...prev, { name: ch.name, status: msg, color: "text-yellow-500" }]);
            } else {
                 setScanResults(prev => [...prev, { name: ch.name, status: `Tìm thấy ${filtered.length} comment chưa trả lời.`, color: "text-green-500" }]);
            }
            
            return filtered.map(c => ({ ...c, channelName: ch.name }));

        } catch (e: any) {
            // Error Handling Log
            let errMsg = e.message;
            if (e.message.includes('401') || e.message.includes('403')) errMsg = "Lỗi xác thực (401/403). Cần kết nối lại.";
            if (e.message.includes('insufficient authentication scopes')) {
                errMsg = "Thiếu quyền Comment. Vui lòng kết nối lại kênh.";
            }

            setScanResults(prev => [...prev, { name: ch.name, status: errMsg, color: "text-red-500" }]);
            console.warn(`Error fetching comments for ${ch.name}:`, e);
            return [];
        }
    };

    try {
        for (let i = 0; i < channels.length; i += BATCH_SIZE) {
            const batch = channels.slice(i, i + BATCH_SIZE);
            setLoadingStatus(`Quét sâu 500 comment... (${Math.min(i + BATCH_SIZE, channels.length)}/${channels.length} kênh)`);
            
            const results = await Promise.all(batch.map(ch => processChannel(ch)));
            
            const newComments: UnifiedComment[] = [];
            results.forEach(arr => newComments.push(...arr));
            
            setComments(prev => {
                const combined = [...prev, ...newComments];
                return combined.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
            });

            await new Promise(r => setTimeout(r, 1000)); 
            processedCount += batch.length;
        }
    } finally {
        setIsLoading(false);
        setLoadingStatus('');
    }
  };

  const handleAiReply = async (commentId: string, text: string, tone: string) => {
      setAiLoading(commentId);
      const suggestions = await generateCommentReply(text, tone);
      if (suggestions.length > 0) {
          setReplyText(prev => ({ ...prev, [commentId]: suggestions[0] }));
      }
      setAiLoading(null);
  };

  const sendReply = async (comment: UnifiedComment, customText?: string) => {
      const text = customText || replyText[comment.id];
      if (!text) return;
      
      const channel = channels.find(c => c.name === comment.channelName); 
      if (!channel) return;
      const token = await getValidToken(channel);
      if (!token) return alert("Lost token");

      try {
          await replyToComment(token, comment.id, text);
          
          if (filterMode === 'UNREPLIED') {
              setComments(prev => prev.filter(c => c.id !== comment.id));
          } else {
              alert("Replied!");
          }

          if (!customText && filterMode === 'UNREPLIED') {
              setReplyText(prev => {
                  const newState = {...prev};
                  delete newState[comment.id];
                  return newState;
              });
          }
      } catch (e) {
          console.error(e);
          if (!customText) alert("Error sending reply");
      }
  };

  // --- AUTO REPLY LOGIC ---
  useEffect(() => {
    // Nếu tắt -> dừng loop
    if (!isAutoReplyActive) {
        isAutoReplyRunningRef.current = false;
        setAutoLog('');
        return;
    }

    // Nếu đã chạy -> không chạy chồng
    if (isAutoReplyRunningRef.current) return;

    const runAutoReplyLoop = async () => {
        isAutoReplyRunningRef.current = true;
        
        while (isAutoReplyActive && isAutoReplyRunningRef.current) {
            // Lấy danh sách comment HIỆN TẠI trong state (mới nhất)
            // Lưu ý: Trong React useEffect closure, 'comments' có thể cũ. 
            // Ở đây ta dùng functional update hoặc ref nếu cần.
            // Để đơn giản, ta sẽ chỉ lấy comment đầu tiên trong list chưa có replyText
            
            // Tìm comment chưa trả lời (ưu tiên cái đang hiển thị)
            // Ta cần truy cập state mới nhất, ở đây dùng hack đơn giản:
            // Tạm thời chỉ xử lý từng cái, sau mỗi lần xử lý component re-render -> loop tiếp tục
            // Tuy nhiên vì while loop chặn render, ta phải dùng logic khác.
            // SOLUTION: Dùng Interval hoặc Recursive Timeout.
            break; 
        }
    };
    
    // START INTERVAL LOOP
    const timer = setInterval(async () => {
        if (!isAutoReplyActive) return;
        
        // Find first candidate
        // Chỉ auto-reply những comment chưa có replyText (chưa được AI gen thủ công)
        // và nằm trong danh sách hiển thị
        setComments(prev => {
            if (prev.length === 0) {
                setAutoLog("Hết comment để trả lời. Đang chờ...");
                return prev;
            }

            const target = prev[0]; // Lấy cái đầu tiên
            
            // Xử lý async bên ngoài setter để tránh block
            processAutoReply(target);
            
            // Tạm thời chưa xóa khỏi list ngay, đợi process xong
            return prev;
        });

    }, 15000); // 15 giây 1 comment

    const processAutoReply = async (comment: UnifiedComment) => {
        try {
            setAutoLog(`Đang xử lý: ${comment.authorDisplayName}...`);
            
            // 1. Gen AI Text
            const suggestions = await generateCommentReply(comment.textDisplay, 'Friendly & Professional');
            const aiText = suggestions[0] || "Thank you for watching! ❤️";
            
            // 2. Send Reply
            const channel = channels.find(c => c.name === comment.channelName);
            if (channel) {
                const token = await getValidToken(channel);
                if (token) {
                    await replyToComment(token, comment.id, aiText);
                    
                    // 3. Remove from UI
                    setComments(current => current.filter(c => c.id !== comment.id));
                    setAutoLog(`✅ Đã trả lời: ${comment.authorDisplayName}`);
                }
            }
        } catch (e: any) {
             console.error("Auto Reply Error", e);
             setAutoLog(`❌ Lỗi khi trả lời ${comment.authorDisplayName}: ${e.message}`);
             // Remove to skip error item
             setComments(current => current.filter(c => c.id !== comment.id));
        }
    };

    return () => clearInterval(timer);
  }, [isAutoReplyActive, channels]); // Re-bind when active toggles

  return (
    <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-800 p-4 rounded-lg border border-gray-700 gap-4">
            <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Hộp thư tập trung
                </h3>
                <p className="text-xs text-gray-500 italic mt-1">Deep Scan 500: Quét sâu tìm comment trôi & Lọc thông minh</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                {isLoading && (
                    <span className="text-xs text-blue-400 font-mono animate-pulse">{loadingStatus}</span>
                )}
                
                {/* AUTO REPLY TOGGLE */}
                <button
                    onClick={() => setIsAutoReplyActive(!isAutoReplyActive)}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-bold text-sm transition border ${
                        isAutoReplyActive 
                        ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse' 
                        : 'bg-gray-700 text-gray-300 border-gray-600 hover:text-white'
                    }`}
                >
                    <Zap className={`w-4 h-4 ${isAutoReplyActive ? 'fill-black' : ''}`} />
                    {isAutoReplyActive ? 'Auto Đang Chạy...' : 'Auto Reply (OFF)'}
                </button>

                {/* FILTER TOGGLE */}
                <div className="flex bg-gray-900 rounded p-1 border border-gray-600">
                    <button 
                        onClick={() => setFilterMode('UNREPLIED')}
                        className={`px-3 py-1 text-xs rounded font-bold transition ${filterMode === 'UNREPLIED' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Chưa trả lời
                    </button>
                    <button 
                        onClick={() => setFilterMode('ALL')}
                        className={`px-3 py-1 text-xs rounded font-bold transition ${filterMode === 'ALL' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Tất cả
                    </button>
                </div>

                <button onClick={loadComments} disabled={isLoading} className="bg-blue-600 px-3 py-2 rounded text-white text-sm flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 shadow-lg">
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Quét Ngay
                </button>
            </div>
        </div>
        
        {/* AUTO LOG PANEL */}
        {isAutoReplyActive && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 p-3 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
                 <div className="p-2 bg-yellow-500/10 rounded-full">
                     <Bot className="w-5 h-5 text-yellow-500 animate-bounce" />
                 </div>
                 <div className="flex-1">
                     <p className="text-yellow-200 text-xs font-bold uppercase mb-0.5">AI Auto-Reply Log</p>
                     <p className="text-white text-sm font-mono truncate">{autoLog || "Đang chờ comment..."}</p>
                 </div>
            </div>
        )}

        {/* LOG PANEL (SCAN) */}
        {scanResults.length > 0 && !isAutoReplyActive && (
            <div className="bg-black/30 p-3 rounded-lg border border-gray-700 max-h-32 overflow-y-auto">
                <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Trạng thái quét:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                    {scanResults.map((log, idx) => (
                        <div key={idx} className="flex justify-between text-xs border-b border-gray-800 pb-1">
                            <span className="text-gray-300 truncate pr-2">{log.name}:</span>
                            <span className={`font-mono ${log.color}`}>{log.status}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {comments.length === 0 && !isLoading && (
                <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50"/>
                    <p className="text-gray-400 font-medium">
                        {filterMode === 'UNREPLIED' ? 'Không có việc gì cần làm! Tất cả đã được trả lời.' : 'Không tìm thấy bình luận nào.'}
                    </p>
                    {scanResults.some(r => r.color.includes('red')) && (
                        <p className="text-xs text-red-400 mt-2">Lưu ý: Một số kênh bị lỗi kết nối, hãy kiểm tra bảng trạng thái ở trên.</p>
                    )}
                </div>
            )}
            
            {comments.map(c => (
                <div key={c.id} className="bg-gray-900 p-4 rounded-lg border border-gray-700 flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <img src={c.authorProfileImageUrl} className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-white text-sm">{c.authorDisplayName} <span className="text-gray-500 font-normal">on {c.channelName}</span></h4>
                                <div className="text-[10px] text-blue-400 mt-0.5 truncate">{c.videoTitle}</div>
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(c.publishedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-gray-300 text-sm mt-2">{c.textDisplay}</p>
                        
                        {/* Reply Box */}
                        <div className="mt-3 flex gap-2">
                            <input 
                                value={replyText[c.id] || ''} 
                                onChange={e => setReplyText({...replyText, [c.id]: e.target.value})}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:border-blue-500 outline-none transition"
                                placeholder="Viết câu trả lời..."
                            />
                            <button onClick={() => sendReply(c)} className="bg-green-600 hover:bg-green-700 p-2 rounded text-white"><Send className="w-4 h-4" /></button>
                        </div>
                        
                        {/* AI Tools */}
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => handleAiReply(c.id, c.textDisplay, 'Friendly')} disabled={!!aiLoading} className="text-xs bg-purple-900/30 text-purple-400 px-2 py-1 rounded border border-purple-800 hover:bg-purple-900/50 transition">
                                {aiLoading === c.id ? 'Thinking...' : '✨ AI Friendly'}
                            </button>
                            <button onClick={() => handleAiReply(c.id, c.textDisplay, 'Professional')} disabled={!!aiLoading} className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-800 hover:bg-blue-900/50 transition">
                                ✨ AI Pro
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

// 2. Thumbnail Vision
const ThumbnailVision = () => {
    const [image, setImage] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result as string);
            reader.readAsDataURL(file);
            setAnalysis(null);
        }
    };

    const analyze = async () => {
        if (!image) return;
        setIsLoading(true);
        const res = await analyzeThumbnail(image);
        setAnalysis(res);
        setIsLoading(false);
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-blue-500 transition">
                    <input type="file" accept="image/*" onChange={handleFile} className="hidden" id="thumb-upload" />
                    <label htmlFor="thumb-upload" className="cursor-pointer">
                        {image ? (
                            <img src={image} className="max-h-60 mx-auto rounded shadow-lg" />
                        ) : (
                            <div className="text-gray-400">
                                <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                                <p>Click để tải ảnh Thumbnail lên</p>
                            </div>
                        )}
                    </label>
                </div>
                <button onClick={analyze} disabled={!image || isLoading} className="w-full bg-purple-600 py-2 rounded text-white font-bold disabled:opacity-50">
                    {isLoading ? 'Đang phân tích...' : '🔍 Phân tích bằng Gemini Vision'}
                </button>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="font-bold text-white mb-4">Kết quả Phân tích</h3>
                {analysis ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className={`text-4xl font-bold ${analysis.score >= 8 ? 'text-green-500' : analysis.score >= 5 ? 'text-yellow-500' : 'text-red-500'}`}>
                                {analysis.score}/10
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm uppercase font-bold">Điểm số</p>
                                <p className="text-white text-sm">{analysis.score >= 8 ? 'Tuyệt vời' : 'Cần cải thiện'}</p>
                            </div>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border border-gray-700">
                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Dự đoán CTR</p>
                            <p className="text-white font-medium">{analysis.ctrPrediction}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border border-gray-700">
                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">Góp ý từ AI</p>
                            <p className="text-white text-sm">{analysis.feedback}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-500 italic">Kết quả sẽ hiện ở đây...</p>
                )}
            </div>
        </div>
    )
};

// 3. Competitor Tracker
const CompetitorTracker = ({ settings }: { settings: any }) => {
    const [channelId, setChannelId] = useState('');
    const [videos, setVideos] = useState<CompetitorVideo[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async () => {
        if (!settings?.youtubeApiKey) return alert("Missing API Key");
        setIsLoading(true);
        try {
            const res = await fetchCompetitorVideos(channelId, settings.youtubeApiKey);
            setVideos(res);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <input 
                    value={channelId} 
                    onChange={e => setChannelId(e.target.value)} 
                    placeholder="Nhập Channel ID đối thủ (UC...)" 
                    className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-white"
                />
                <button onClick={handleSearch} className="bg-blue-600 px-4 rounded text-white font-bold">
                    {isLoading ? <RefreshCw className="animate-spin"/> : 'Soi Kênh'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map(v => (
                    <div key={v.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <img src={v.thumbnailUrl} className="w-full h-40 object-cover" />
                        <div className="p-4">
                            <h4 className="text-white font-bold text-sm truncate" title={v.title}>{v.title}</h4>
                            <div className="flex justify-between mt-2 text-xs text-gray-400">
                                <span><Eye className="w-3 h-3 inline"/> {v.viewCount.toLocaleString()}</span>
                                <span>{v.daysAgo} ngày trước</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <p className="text-xs text-green-400 font-mono">Velocity: ~{v.velocity?.toLocaleString()}/ngày</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 4. Bulk Editor
const BulkEditor = () => {
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchVideos({ status: 'DRAFT', limit: 1000 }).then(setVideos);
    }, []);

    const handleBulkReplace = async () => {
        if (selectedIds.length === 0) return alert("Chọn ít nhất 1 video");
        if (!findText) return alert("Nhập từ cần tìm");
        
        setIsProcessing(true);
        try {
            // Client side transform first to prepare payload
            const updates = videos
                .filter(v => selectedIds.includes(v.id))
                .filter(v => v.metadata.description.includes(findText))
                .map(v => ({
                    id: v.id,
                    desc_template: v.metadata.description.split(findText).join(replaceText)
                }));
            
            // Execute updates one by one or bulk (Supabase bulk update requires specific setup, we do loop for safety here or map)
            // For optimized way, we should have an upsert. For now loop.
            for (const u of updates) {
                await bulkUpdateVideos([u.id], { desc_template: u.desc_template });
            }
            
            alert(`Đã cập nhật ${updates.length} video!`);
            fetchVideos({ status: 'DRAFT', limit: 1000 }).then(setVideos);
        } catch (e: any) {
            alert("Lỗi: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex gap-4 items-end">
                <div className="flex-1">
                    <label className="text-xs text-gray-400">Tìm kiếm (Trong mô tả)</label>
                    <input value={findText} onChange={e => setFindText(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-gray-400">Thay thế bằng</label>
                    <input value={replaceText} onChange={e => setReplaceText(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                </div>
                <button onClick={handleBulkReplace} disabled={isProcessing} className="bg-green-600 px-6 py-2 rounded text-white font-bold">
                    {isProcessing ? 'Processing...' : 'Replace All'}
                </button>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-900 text-gray-400">
                        <tr>
                            <th className="p-3"><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? videos.map(v => v.id) : [])} /></th>
                            <th className="p-3">Video Title</th>
                            <th className="p-3">Mô tả hiện tại</th>
                        </tr>
                    </thead>
                    <tbody>
                        {videos.map(v => (
                            <tr key={v.id} className="border-t border-gray-700">
                                <td className="p-3"><input type="checkbox" checked={selectedIds.includes(v.id)} onChange={() => setSelectedIds(prev => prev.includes(v.id) ? prev.filter(i => i !== v.id) : [...prev, v.id])} /></td>
                                <td className="p-3 text-white truncate max-w-[200px]">{v.metadata.title}</td>
                                <td className="p-3 text-gray-400 truncate max-w-[300px]">{v.metadata.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
};

// 5. Repurpose Tool (Simple Mockup for Metadata)
const RepurposeTool = ({ channels }: { channels: Channel[] }) => {
    const [file, setFile] = useState<File | null>(null);
    const [startTime, setStartTime] = useState("00:00");
    const [endTime, setEndTime] = useState("00:59");
    const [title, setTitle] = useState("");
    
    const handleGenerate = async () => {
        if (!file || !title) return;
        // Logic: Create a new Draft video with Shorts metadata
        // Since we can't cut video in browser easily, we mark it.
        const desc = `Short cut from ${file.name}. Time: ${startTime} - ${endTime}.\n#Shorts #Viral`;
        
        try {
            await saveVideo({
                filename: `SHORT_${file.name}`,
                filePath: "Pending Cut/Render", // Placeholder
                resolution: "9:16",
                status: VideoStatus.DRAFT, // Explicit enum use
                channelId: undefined,
                metadata: {
                    title: title + " #Shorts",
                    description: desc,
                    tags: ["Shorts", "Viral"],
                    visibility: 'private'
                }
            });
            alert("Đã tạo Draft cho Short! Hãy render file video tương ứng và dùng tính năng Import để thay thế file placeholder.");
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    return (
        <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-xl border border-gray-700 space-y-4">
             <h3 className="font-bold text-white text-lg">Tạo Metadata cho Shorts từ Video dài</h3>
             <p className="text-gray-400 text-sm">Tool này sẽ giúp bạn lên kế hoạch cắt Short. Nó tạo ra bản ghi Draft để bạn nhớ render.</p>
             
             <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-blue-900 file:text-blue-400 hover:file:bg-blue-800"/>
             
             <div className="flex gap-4">
                 <div>
                     <label className="text-xs text-gray-400">Start</label>
                     <input value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"/>
                 </div>
                 <div>
                     <label className="text-xs text-gray-400">End</label>
                     <input value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"/>
                 </div>
             </div>

             <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Short Title..." className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"/>

             <button onClick={handleGenerate} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold">
                 Generate Short Draft
             </button>
        </div>
    )
}

export default AdvancedTools;