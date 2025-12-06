
import React, { useState, useEffect } from 'react';
import { Channel, VideoItem, VideoAnalytics, ChannelAnalytics } from '../types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Eye, ThumbsUp, MessageSquare, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Play, Settings as SettingsIcon } from 'lucide-react';
import { fetchChannels, fetchVideos } from '../services/supabaseService';
import { getVideoStatistics } from '../services/youtubeService';

const Analytics: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentVideos, setRecentVideos] = useState<VideoAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalViews, setTotalViews] = useState(0);
  const [totalSubs, setTotalSubs] = useState(0);

  // A/B Test UI State
  const [abTestVideoId, setAbTestVideoId] = useState('');
  const [abVariantA, setAbVariantA] = useState('');
  const [abVariantB, setAbVariantB] = useState('');

  const loadData = async () => {
      setIsLoading(true);
      try {
          // 1. Fetch Channels for Total Subs
          const chData = await fetchChannels();
          setChannels(chData);
          const subs = chData.reduce((acc, c) => acc + (c.subscriberCount || 0), 0);
          setTotalSubs(subs);

          // 2. Fetch Recent Uploaded Videos (Last 24h - 48h ideally, but let's take last 10 completed)
          // We filter locally for now.
          const allVideos = await fetchVideos({ limit: 50, status: 'PUBLISHED' });
          const uploadedVideos = allVideos.filter(v => v.youtubeVideoId && v.channelId); // Only videos with YouTube ID
          
          if (uploadedVideos.length > 0) {
              // Group videos by Channel to use the correct Access Token
              // Note: Ideally we batch requests per channel token. 
              // Simplification: We iterate channels, find their videos, fetch stats.
              
              let analyticsData: VideoAnalytics[] = [];
              let grandTotalViews = 0;

              for (const channel of chData) {
                  if (!channel.accessToken) continue;
                  
                  const vidsOfChannel = uploadedVideos.filter(v => v.channelId === channel.id);
                  if (vidsOfChannel.length === 0) continue;

                  const videoIds = vidsOfChannel.map(v => v.youtubeVideoId!);
                  const stats = await getVideoStatistics(videoIds, channel.accessToken);
                  
                  // Merge DB data with YouTube Stats
                  const merged = stats.map(s => {
                      grandTotalViews += s.viewCount;
                      // Logic đánh giá performance giả định (VD: view > 100 là HIGH)
                      let performance: 'HIGH'|'AVG'|'LOW' = 'AVG';
                      if (s.viewCount > 1000) performance = 'HIGH';
                      if (s.viewCount < 50) performance = 'LOW';
                      
                      return {
                          id: s.id,
                          title: s.title,
                          channelName: channel.name,
                          publishedAt: new Date(s.publishedAt).toLocaleString('vi-VN'),
                          thumbnailUrl: s.thumbnailUrl,
                          stats: {
                              viewCount: s.viewCount,
                              likeCount: s.likeCount,
                              commentCount: s.commentCount
                          },
                          performance
                      };
                  });
                  analyticsData = [...analyticsData, ...merged];
              }
              setRecentVideos(analyticsData.sort((a,b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()));
              setTotalViews(grandTotalViews);
          }
      } catch (e) {
          console.error("Analytics Load Error", e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <TrendingUp className="w-6 h-6 text-purple-500" />
             Analytics Center
           </h2>
           <p className="text-gray-400 text-sm mt-1">Theo dõi hiệu suất Real-time & A/B Testing</p>
        </div>
        <button onClick={loadData} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg border border-gray-700">
             <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
              <p className="text-gray-400 text-xs font-bold uppercase">Tổng Views (Các video gần đây)</p>
              <div className="flex items-center gap-2 mt-2">
                  <Eye className="w-6 h-6 text-blue-500" />
                  <span className="text-2xl font-bold text-white">{totalViews.toLocaleString()}</span>
              </div>
          </div>
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
              <p className="text-gray-400 text-xs font-bold uppercase">Tổng Subscribers</p>
              <div className="flex items-center gap-2 mt-2">
                  <Play className="w-6 h-6 text-red-500" />
                  <span className="text-2xl font-bold text-white">{totalSubs.toLocaleString()}</span>
              </div>
          </div>
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
              <p className="text-gray-400 text-xs font-bold uppercase">Doanh Thu Ước Tính</p>
              <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-bold text-green-400">$0.00</span>
                  <span className="text-xs bg-gray-700 text-gray-400 px-1 rounded ml-2">Cần API Scope Analytics</span>
              </div>
          </div>
      </div>

      {/* REAL-TIME WATCH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Video Performance List */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      Hiệu suất Video Mới (Real-time Watch)
                  </h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                          <tr>
                              <th className="p-4">Video</th>
                              <th className="p-4">Views</th>
                              <th className="p-4">Engage</th>
                              <th className="p-4">Đánh giá</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700 text-sm">
                          {recentVideos.length === 0 ? (
                              <tr><td colSpan={4} className="p-6 text-center text-gray-500">Chưa có video nào được upload gần đây hoặc chưa có ID.</td></tr>
                          ) : (
                              recentVideos.map(vid => (
                                  <tr key={vid.id} className="hover:bg-gray-750">
                                      <td className="p-4">
                                          <div className="flex gap-3">
                                              <img src={vid.thumbnailUrl} className="w-12 h-8 object-cover rounded" />
                                              <div>
                                                  <p className="font-medium text-white truncate max-w-[150px]" title={vid.title}>{vid.title}</p>
                                                  <p className="text-[10px] text-gray-400">{vid.channelName} • {vid.publishedAt}</p>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="p-4 font-mono text-white">{vid.stats.viewCount.toLocaleString()}</td>
                                      <td className="p-4">
                                          <div className="flex gap-3 text-xs text-gray-400">
                                              <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3"/> {vid.stats.likeCount}</span>
                                              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3"/> {vid.stats.commentCount}</span>
                                          </div>
                                      </td>
                                      <td className="p-4">
                                          {vid.performance === 'HIGH' && <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded flex w-fit items-center gap-1"><TrendingUp className="w-3 h-3"/> Tốt</span>}
                                          {vid.performance === 'LOW' && <span className="text-xs bg-red-900 text-red-400 px-2 py-1 rounded flex w-fit items-center gap-1"><TrendingDown className="w-3 h-3"/> Thấp</span>}
                                          {vid.performance === 'AVG' && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded flex w-fit items-center gap-1"><Minus className="w-3 h-3"/> TB</span>}
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* A/B Testing Tool */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-blue-500" />
                  A/B Testing Metadata
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                  Cấu hình thay đổi Tiêu đề nếu CTR thấp sau 24h. (Tính năng này cần backend worker để tự động chạy).
              </p>
              
              <div className="space-y-3">
                  <div>
                      <label className="text-xs text-gray-500 font-bold uppercase">Chọn Video (ID)</label>
                      <select 
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1"
                        value={abTestVideoId}
                        onChange={e => setAbTestVideoId(e.target.value)}
                      >
                          <option value="">-- Chọn Video --</option>
                          {recentVideos.map(v => <option key={v.id} value={v.id}>{v.title.substring(0, 30)}...</option>)}
                      </select>
                  </div>

                  <div className="p-3 bg-gray-900 rounded border border-gray-600">
                      <span className="text-xs bg-blue-900 text-blue-300 px-1 rounded">Variant A (Hiện tại)</span>
                      <p className="text-sm text-white mt-1 truncate">
                          {recentVideos.find(v => v.id === abTestVideoId)?.title || '(Chưa chọn video)'}
                      </p>
                  </div>

                  <div>
                      <label className="text-xs text-gray-500 font-bold uppercase">Variant B (Dự phòng)</label>
                      <input 
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm mt-1"
                        placeholder="Nhập tiêu đề thay thế hấp dẫn hơn..."
                        value={abVariantB}
                        onChange={e => setAbVariantB(e.target.value)}
                      />
                  </div>

                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-sm">
                      Lưu Cấu Hình A/B
                  </button>
                  <p className="text-[10px] text-yellow-500 italic mt-2">
                      * Lưu ý: Hệ thống sẽ cần module backend để kiểm tra Views sau 24h và tự động gọi API đổi tên nếu Views &lt; Avg.
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Analytics;
