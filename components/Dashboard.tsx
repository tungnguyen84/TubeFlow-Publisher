
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, UploadCloud, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fetchDashboardStats } from '../services/supabaseService';
import { DashboardStats } from '../types';

const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) => (
  <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-center justify-between">
    <div>
      <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</p>
      <h3 className="text-3xl font-bold mt-2 text-white">{value}</h3>
    </div>
    <div className={`p-3 rounded-full bg-opacity-20 ${color.replace('text', 'bg')}`}>
      <Icon className={`w-8 h-8 ${color}`} />
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
      fetchDashboardStats().then(setStats);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Tổng quan Hệ thống</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Upload Hôm Nay" value={stats?.totalUploadsToday || 0} icon={UploadCloud} color="text-blue-500" />
        <StatCard title="Đang Chờ (Queued)" value={stats?.queuedJobs || 0} icon={Activity} color="text-yellow-500" />
        <StatCard title="Lỗi / Limit" value={stats?.failedJobs || 0} icon={AlertCircle} color="text-red-500" />
        <StatCard title="Kênh Hoạt Động" value={stats?.totalChannels || 0} icon={CheckCircle2} color="text-green-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Hoạt động Upload (7 ngày qua)</h3>
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
    </div>
  );
};

export default Dashboard;
