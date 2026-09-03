import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { format } from 'date-fns';
import { Users, Search, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this log?")) return;
    
    const { error } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setLogs(logs.filter(log => log.id !== id));
    }
  };

  const filteredLogs = logs.filter(log => 
    log.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users size={24} className="text-blue-600" />
          Admin Dashboard
        </h2>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading logs...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="p-3 font-medium">Time (Submitted)</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Slot</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Photo</th>
                <th className="p-3 font-medium">GPS</th>
                <th className="p-3 font-medium">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-gray-500">No attendance logs found.</td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">
                      {format(new Date(log.timestamp), 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-gray-800">{log.name}</div>
                      <div className="text-xs text-gray-500">{log.email}</div>
                    </td>
                    <td className="p-3 text-sm">
                      {log.slot_day} <br/> <span className="text-gray-500">{log.slot_time}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        log.action_type === 'START' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="p-3">
                      <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-medium">
                        View Photo
                      </a>
                    </td>
                    <td className="p-3 text-sm">
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                      </a>
                    </td>
                    <td className="p-3">
                      <button 
                        onClick={() => handleDelete(log.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete log"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
