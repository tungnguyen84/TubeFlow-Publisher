import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, UploadCloud, AlertCircle, CheckCircle2 } from 'lucide-react';

const data = [
  { name: 'Mon', uploads: 4, views: 2400 },
  { name: 'Tue', uploads: 3, views: 1398 },
  { name: 'Wed', uploads: 9, views: 9800 },
  { name: 'Thu', uploads: 2, views: 3908 },
  { name: 'Fri', uploads: 6, views: 4800 },
  { name: 'Sat', uploads: 10, views: 6800 },
  { name: 'Sun', uploads: 5, views: 4300 },
];

const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) => (
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
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          Sync Analytics
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Uploads (Today)" value="12" icon={UploadCloud} color="text-blue-500" />
        <StatCard title="Active Queue" value="8" icon={Activity} color="text-yellow-500" />
        <StatCard title="Failed Jobs" value="1" icon={AlertCircle} color="text-red-500" />
        <StatCard title="Channels Active" value="24" icon={CheckCircle2} color="text-green-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Weekly Upload Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} 
                  itemStyle={{ color: '#E5E7EB' }}
                />
                <Bar dataKey="uploads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Aggregate Views Estimate</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} 
                  itemStyle={{ color: '#E5E7EB' }}
                />
                <Line type="monotone" dataKey="views" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;