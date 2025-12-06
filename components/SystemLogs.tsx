import React, { useState, useEffect } from 'react';
import { Job } from '../types';
import { fetchErrorLogs, updateJobStatus, deleteJob } from '../services/supabaseService';
import { AlertTriangle, ShieldAlert, XCircle, RefreshCw, Trash2, RotateCw, AlertCircle, FileWarning, CheckCircle2 } from 'lucide-react';

const SystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await fetchErrorLogs();
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const handleRetry = async (id: string) => {
        try {
            await updateJobStatus(id, 'QUEUED', ''); // Reset error log
            setLogs(prev => prev.filter(job => job.id !== id));
        } catch (e) {
            alert("Lỗi retry: " + e);
        }
    };

    const handleRetryAll = async () => {
        if (!confirm(`Bạn có chắc muốn Retry ${logs.length} jobs bị lỗi không?`)) return;
        setIsRetrying(true);
        try {
            for (const job of logs) {
                await updateJobStatus(job.id, 'QUEUED', '');
            }
            await loadLogs();
            alert("Đã đẩy tất cả job về hàng đợi (QUEUED)!");
        } catch (e) {
            alert("Lỗi bulk retry: " + e);
        } finally {
            setIsRetrying(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Xóa job này vĩnh viễn?")) return;
        await deleteJob(id);
        setLogs(prev => prev.filter(job => job.id !== id));
    };

    const countQuota = logs.filter(j => j.status === 'QUOTA_LIMIT').length;
    const countFailed = logs.filter(j => j.status === 'FAILED').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                        Nhật ký Lỗi & Hệ thống
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Quản lý các sự cố upload, limit và lỗi kỹ thuật.</p>
                </div>
                <div className="flex gap-3">
                     <button onClick={loadLogs} className="p-2 bg-gray-800 rounded hover:bg-gray-700 text-white border border-gray-700">
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                     </button>
                     {logs.length > 0 && (
                         <button 
                            onClick={handleRetryAll} 
                            disabled={isRetrying}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2 disabled:opacity-50"
                         >
                             <RotateCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                             Retry All ({logs.length})
                         </button>
                     )}
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-red-500" />
                    <div>
                        <h4 className="text-red-400 font-bold text-lg">{countFailed}</h4>
                        <p className="text-xs text-red-300">Lỗi Upload (FAILED)</p>
                    </div>
                </div>
                <div className="bg-orange-900/20 border border-orange-800 p-4 rounded-lg flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-orange-500" />
                    <div>
                        <h4 className="text-orange-400 font-bold text-lg">{countQuota}</h4>
                        <p className="text-xs text-orange-300">Giới hạn Quota YouTube</p>
                    </div>
                </div>
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg flex items-center gap-3">
                    <FileWarning className="w-8 h-8 text-gray-500" />
                    <div>
                         <h4 className="text-white font-bold text-lg">{logs.length}</h4>
                         <p className="text-xs text-gray-400">Tổng sự cố cần xử lý</p>
                    </div>
                </div>
            </div>

            {/* Error Table */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                {logs.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                         <div className="bg-green-900/20 p-4 rounded-full mb-3">
                             <CheckCircle2 className="w-8 h-8 text-green-500" />
                         </div>
                         <p className="text-gray-400">Hệ thống hoạt động ổn định. Không có lỗi nào.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-950 text-gray-400 uppercase text-xs border-b border-gray-800">
                                <tr>
                                    <th className="p-4 w-40">Thời gian</th>
                                    <th className="p-4 w-48">Kênh</th>
                                    <th className="p-4 w-64">Video</th>
                                    <th className="p-4 w-32">Loại Lỗi</th>
                                    <th className="p-4">Chi tiết Lỗi (Log)</th>
                                    <th className="p-4 text-right w-32">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {logs.map(job => (
                                    <tr key={job.id} className="hover:bg-gray-800 transition">
                                        <td className="p-4 text-gray-400 font-mono text-xs">{job.scheduledTime}</td>
                                        <td className="p-4 font-medium text-blue-300">{job.channelName}</td>
                                        <td className="p-4 text-white truncate max-w-[200px]" title={job.videoTitle}>{job.videoTitle}</td>
                                        <td className="p-4">
                                            {job.status === 'QUOTA_LIMIT' ? (
                                                <span className="inline-flex items-center gap-1 bg-orange-900/30 text-orange-400 px-2 py-1 rounded text-xs border border-orange-900">
                                                    <ShieldAlert className="w-3 h-3" /> Quota Limit
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-red-900/30 text-red-400 px-2 py-1 rounded text-xs border border-red-900">
                                                    <XCircle className="w-3 h-3" /> Upload Failed
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="bg-black/30 p-2 rounded border border-gray-700 text-red-300 font-mono text-xs max-h-[80px] overflow-y-auto whitespace-pre-wrap">
                                                {job.errorMessage || "Không có chi tiết lỗi."}
                                                {!job.refreshToken && <div className="text-yellow-500 mt-1">Hint: Có thể mất kết nối Token.</div>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleRetry(job.id)} className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded" title="Thử lại ngay">
                                                    <RotateCw className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(job.id)} className="p-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded" title="Xóa bỏ">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemLogs;