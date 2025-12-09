
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, UploadCloud, AlertCircle, CheckCircle2, Filter, Calendar, X, AlertTriangle } from 'lucide-react';
import { fetchDashboardStats, fetchChannels } from '../services/supabaseService';
import { DashboardStats, Channel } from '../types';

interface DashboardProps {
    selectedGroupId?: string;
}

const StatCard = ({ title, value, icon: Icon, color, onClick, clickable }: { title: string; value: string | number; icon: any; color: string, onClick?: () => void, clickable?: boolean }) => (
  <div 
    onClick={onClick}
    className={`bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-center justify-between transition-all ${clickable ? 'cursor-pointer hover:bg-gray-750 hover:border-gray-600 shadow-lg hover:shadow-xl' : ''}`}
  >
    <div>
      <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</p>
      <h3 className="text-3xl font-bold mt-2 text-white">{value}</h3>
    </div>
    <div className={`p-3 rounded-full bg-opacity-20 ${color.replace('text', 'bg')}`}>
      <Icon className={`w-8 h-8 ${color}`} />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ selectedGroupId }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filterChannelId, setFilterChannelId] = useState<string>('');
  const [dateMode, setDateMode] = useState<'TODAY' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Modal State
  const [showErrorModal, setShowErrorModal] = useState(false);

  const loadData = async () => {
      setIsLoading(true);
      try {
          // If TODAY, reset date range to today strict in local time or simple logic
          let effectiveStart = startDate;
          let effectiveEnd = endDate;

          if (dateMode === 'TODAY') {
              const today = new Date().toISOString().split('T')[0];
              effectiveStart = today;
              effectiveEnd = today;
          }

          const [s, c] = await Promise.all([
              fetchDashboardStats(effectiveStart, effectiveEnd, filterChannelId || undefined, selectedGroupId || undefined),
              fetchChannels(selectedGroupId)
          ]);
          setStats(s);
          setChannels(c);
      } catch(e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, [filterChannelId, dateMode, startDate, endDate, selectedGroupId]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Tổng quan Hệ thống</h2>
        
        {/* FILTER BAR */}
        <div className="flex flex-wrap gap-3 bg-gray-800 p-2 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 px-2 border-r border-gray-600">
                <Filter className="w-4 h-4 text-gray-400" />
                <select 
                    value={filterChannelId}
                    onChange={e => setFilterChannelId(e.target.value)}
                    className="bg-gray-900 border border-gray-600 rounded text-white text-sm outline-none px-2 py-1 min-w-[150px]"
                >
                    <option value="">-- Tất cả kênh --</option>
                    {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <select 
                    value={dateMode}
                    onChange={e => setDateMode(e.target.value as any)}
                    className="bg-gray-900 border border-gray-600 rounded text-white text-sm outline-none px-2 py-1 mr-2"
                >
                    <option value="TODAY">Hôm Nay</option>
                    <option value="CUSTOM">Tùy Chọn</option>
                </select>
                
                {dateMode === 'CUSTOM' && (
                    <div className="flex items-center gap-1 text-sm">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-xs"/>
                        <span className="text-gray-500">-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-xs"/>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Thành Công (Period)" 
            value={stats?.uploadsInPeriod || 0} 
            icon={UploadCloud} 
            color="text-blue-500" 
        />
        <StatCard 
            title="Đang Chờ (Queue)" 
            value={stats?.queuedJobs || 0} 
            icon={Activity} 
            color="text-yellow-500" 
        />
        <StatCard 
            title="Lỗi / Limit (Click Detail)" 
            value={stats?.failedInPeriod || 0} 
            icon={AlertCircle} 
            color="text-red-500" 
            clickable={true}
            onClick={() => setShowErrorModal(true)}
        />
        <StatCard 
            title="Kênh Hoạt Động (Period)" 
            value={stats?.activeChannelsInPeriod || 0} 
            icon={CheckCircle2} 
            color="text-green-500" 
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Biểu đồ Upload ({dateMode === 'TODAY' ? 'Hôm nay' : `${startDate} - ${endDate}`})</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.recentActivity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} 
                  itemStyle={{ color: '#E5E7EB' }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Video Uploaded" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ERROR DETAIL MODAL */}
      {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 rounded-t-2xl">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <AlertTriangle className="w-6 h-6 text-red-500" />
                          Báo cáo Lỗi Chi Tiết
                      </h3>
                      <button onClick={() => setShowErrorModal(false)} className="text-gray-400 hover:text-white p-2">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      <div className="flex gap-4 mb-6">
                          <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg flex-1 text-center">
                              <p className="text-gray-400 text-xs uppercase">Tổng số lỗi</p>
                              <p className="text-3xl font-bold text-red-500">{stats?.failedInPeriod}</p>
                          </div>
                          <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg flex-1 text-center">
                              <p className="text-gray-400 text-xs uppercase">Tỉ lệ lỗi / Tổng Upload</p>
                              <p className="text-3xl font-bold text-blue-400">
                                  {stats && (stats.uploadsInPeriod + stats.failedInPeriod) > 0 
                                    ? ((stats.failedInPeriod / (stats.uploadsInPeriod + stats.failedInPeriod)) * 100).toFixed(1) + '%' 
                                    : '0%'}
                              </p>
                          </div>
                      </div>

                      {(!stats?.errorBreakdown || stats.errorBreakdown.length === 0) ? (
                          <div className="text-center text-gray-500 py-8">Không có lỗi nào trong khoảng thời gian này.</div>
                      ) : (
                          <div className="space-y-4">
                              {stats.errorBreakdown.map((err, idx) => (
                                  <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                                      <div className="p-3 bg-gray-750 flex justify-between items-center border-b border-gray-700">
                                          <span className="font-bold text-white flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                              {err.type}
                                          </span>
                                          <span className="bg-red-900 text-red-100 px-2 py-1 rounded text-xs font-bold">{err.count}</span>
                                      </div>
                                      <div className="p-3 bg-black/20 text-xs font-mono text-gray-400 space-y-1">
                                          {err.details.slice(0, 3).map((detail, dIdx) => (
                                              <div key={dIdx} className="truncate border-l-2 border-gray-600 pl-2 opacity-80 hover:opacity-100" title={detail}>
                                                  {detail}
                                              </div>
                                          ))}
                                          {err.details.length > 3 && (
                                              <div className="text-blue-400 italic pl-2">... và {err.details.length - 3} chi tiết khác</div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <div className="p-4 border-t border-gray-700 bg-gray-800/50 rounded-b-2xl text-right">
                      <button onClick={() => setShowErrorModal(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium">
                          Đóng
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
