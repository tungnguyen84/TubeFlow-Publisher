import React, { useState, useEffect } from 'react';
import { Job } from '../types';
import { Play, Pause, XCircle, RotateCw, CheckCircle2, Clock, UploadCloud, RefreshCw } from 'lucide-react';
import { fetchJobs, deleteJob } from '../services/supabaseService';

const UploadQueue: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadJobs = async () => {
    setIsLoading(true);
    const data = await fetchJobs();
    setJobs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadJobs();
    // Auto refresh every 10s
    const interval = setInterval(loadJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Giả lập process (vì client-side không upload thật được nếu không mở tab)
  useEffect(() => {
    let interval: any;
    if (isProcessing && jobs.length > 0) {
      interval = setInterval(() => {
        setJobs(prevJobs => prevJobs.map(job => {
          if (job.status === 'QUEUED' && Math.random() > 0.8) {
             return { ...job, status: 'UPLOADING', progress: 5 };
          }
          if (job.status === 'UPLOADING') {
            const newProgress = job.progress + Math.floor(Math.random() * 10);
            if (newProgress >= 100) {
              return { ...job, progress: 100, status: 'COMPLETED' };
            }
            return { ...job, progress: newProgress };
          }
          return job;
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing, jobs.length]);

  const handlePauseResume = () => {
    setIsProcessing(!isProcessing);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Xóa job này khỏi hàng đợi?')) {
        await deleteJob(id);
        loadJobs();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UPLOADING': return 'text-blue-400 border-blue-900/50 bg-blue-900/20';
      case 'COMPLETED': return 'text-green-400 border-green-900/50 bg-green-900/20';
      case 'FAILED': return 'text-red-400 border-red-900/50 bg-red-900/20';
      case 'QUEUED': return 'text-yellow-400 border-yellow-900/50 bg-yellow-900/20';
      default: return 'text-gray-400 border-gray-800 bg-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <UploadCloud className="w-7 h-7" />
             Hàng Đợi Upload
           </h2>
           <p className="text-gray-400 text-sm mt-1">
             {jobs.filter(j => j.status === 'QUEUED' || j.status === 'UPLOADING').length} Job đang chạy
           </p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={loadJobs} className="p-2 bg-gray-800 rounded text-gray-400 hover:text-white">
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handlePauseResume}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${isProcessing ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
          >
            {isProcessing ? <><Pause className="w-4 h-4"/> Tạm dừng</> : <><Play className="w-4 h-4"/> Tiếp tục</>}
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="divide-y divide-gray-700">
           {jobs.length === 0 && (
             <div className="p-12 text-center text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Hàng đợi trống. Hãy tạo lịch đăng mới.</p>
             </div>
           )}

           {jobs.map(job => (
             <div key={job.id} className="p-5 hover:bg-gray-750 transition flex items-center gap-4">
                {/* Status Icon */}
                <div className="shrink-0">
                  {job.status === 'UPLOADING' && <RotateCw className="w-6 h-6 text-blue-500 animate-spin" />}
                  {job.status === 'QUEUED' && <Clock className="w-6 h-6 text-yellow-500" />}
                  {job.status === 'COMPLETED' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                  {job.status === 'FAILED' && <XCircle className="w-6 h-6 text-red-500" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-white font-medium truncate">{job.videoTitle}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">Kênh: <span className="text-gray-300">{job.channelName}</span> • Lịch: {job.scheduledTime}</p>
                  
                  {/* Progress Bar */}
                  {job.status === 'UPLOADING' && (
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${job.progress}%` }}></div>
                    </div>
                  )}

                  {/* Error Msg */}
                  {job.status === 'FAILED' && (
                    <p className="text-xs text-red-400 mt-1">Lỗi: {job.errorMessage}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="shrink-0 flex gap-2">
                   <button onClick={() => handleDelete(job.id)} className="p-2 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400" title="Hủy Job">
                     <XCircle className="w-4 h-4" />
                   </button>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

export default UploadQueue;