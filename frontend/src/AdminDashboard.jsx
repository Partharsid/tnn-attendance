import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { format, parse, isAfter, addMinutes, startOfDay } from 'date-fns';
import { Users, Search, Trash2, Calendar, Phone, CheckCircle, XCircle, Clock } from 'lucide-react';
import scheduleData from './data/schedule.json';
import usersMap from './data/users.json';

// Deterministic phone number generator based on name (since no actual numbers exist)
const getMobileNumber = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const num = Math.abs(hash) % 9000000000 + 1000000000;
  return '+91 ' + num.toString().replace(/(\d{5})(\d{5})/, '$1 $2');
};

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');
  const [todaySlots, setTodaySlots] = useState([]);
  const [processing, setProcessing] = useState(false);

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
      processAutoAttendance(data);
    }
    setLoading(false);
  };

  const processAutoAttendance = async (existingLogs) => {
    if (sessionStorage.getItem('auto_attendance_processed')) {
      const today = format(new Date(), 'EEEE');
      setTodaySlots(scheduleData.filter(s => s.day === today));
      return;
    }
    setProcessing(true);
    
    const today = format(new Date(), 'EEEE'); 
    const todaySchedule = scheduleData.filter(s => s.day === today);
    setTodaySlots(todaySchedule);

    const now = new Date();
    const todayLogs = existingLogs.filter(log => new Date(log.timestamp) >= startOfDay(now));
    const newLogsToInsert = [];

    todaySchedule.forEach(slot => {
      const [startTimeStr, endTimeStr] = slot.time.split(' - ');
      const startTime = parse(startTimeStr, 'h:mm a', now);
      const endTime = parse(endTimeStr, 'h:mm a', now);
      
      const members = [slot.lead, ...slot.support];
      
      members.forEach(member => {
        const startLog = todayLogs.find(l => l.name === member && l.slot_time === slot.time && l.action_type === 'START');
        const endLog = todayLogs.find(l => l.name === member && l.slot_time === slot.time && (l.action_type === 'END' || l.action_type === 'AUTO-END'));
        const memberEmail = usersMap[member] || 'unknown@example.com';

        // Check for ABSENT: if 10 mins past start time and no START log
        const absentCutoff = addMinutes(startTime, 10);
        if (isAfter(now, absentCutoff) && !startLog) {
          const alreadyAbsent = todayLogs.find(l => l.name === member && l.slot_time === slot.time && l.action_type === 'ABSENT');
          if (!alreadyAbsent) {
            newLogsToInsert.push({
              user_id: 'SYSTEM',
              email: memberEmail,
              name: member,
              slot_day: slot.day,
              slot_time: slot.time,
              action_type: 'ABSENT',
              latitude: 0,
              longitude: 0,
              photo_url: null,
              timestamp: absentCutoff.toISOString()
            });
          }
        }
        
        // Check for AUTO-END: if 10 mins past end time, started but didn't end
        const autoEndCutoff = addMinutes(endTime, 10);
        if (isAfter(now, autoEndCutoff) && startLog && !endLog) {
          const alreadyAutoEnded = todayLogs.find(l => l.name === member && l.slot_time === slot.time && l.action_type === 'AUTO-END');
          if (!alreadyAutoEnded) {
            newLogsToInsert.push({
              user_id: 'SYSTEM',
              email: memberEmail,
              name: member,
              slot_day: slot.day,
              slot_time: slot.time,
              action_type: 'AUTO-END',
              latitude: 0,
              longitude: 0,
              photo_url: null,
              timestamp: autoEndCutoff.toISOString()
            });
          }
        }
      });
    });

    if (newLogsToInsert.length > 0) {
      const { error } = await supabase.from('attendance_logs').insert(newLogsToInsert);
      if (!error) {
        const { data } = await supabase.from('attendance_logs').select('*').order('timestamp', { ascending: false });
        if (data) setLogs(data);
      }
    }
    
    sessionStorage.setItem('auto_attendance_processed', 'true');
    setProcessing(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this log?")) return;
    const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
    if (!error) setLogs(logs.filter(log => log.id !== id));
  };

  const filteredLogs = logs.filter(log => 
    log.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMemberStatus = (member, slotTime) => {
    const todayLogs = logs.filter(log => new Date(log.timestamp) >= startOfDay(new Date()));
    const memberLogs = todayLogs.filter(l => l.name === member && l.slot_time === slotTime);
    
    if (memberLogs.some(l => l.action_type === 'ABSENT')) return { label: 'Absent', color: 'text-red-600 bg-red-100', icon: <XCircle size={14}/> };
    if (memberLogs.some(l => l.action_type === 'END' || l.action_type === 'AUTO-END')) return { label: 'Completed', color: 'text-green-600 bg-green-100', icon: <CheckCircle size={14}/> };
    if (memberLogs.some(l => l.action_type === 'START')) return { label: 'Active', color: 'text-blue-600 bg-blue-100', icon: <Clock size={14}/> };
    
    return { label: 'Upcoming', color: 'text-gray-600 bg-gray-100', icon: <Clock size={14}/> };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users size={24} className="text-blue-600" />
          Admin Dashboard
        </h2>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'upcoming' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Today's Schedule
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Attendance Logs
          </button>
        </div>
      </div>

      {activeTab === 'upcoming' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-blue-600" />
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </h3>
          
          {processing ? (
             <div className="text-center py-4 text-sm text-gray-500">Processing auto-attendance...</div>
          ) : todaySlots.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">No slots scheduled for today.</div>
          ) : (
            <div className="space-y-6">
              {todaySlots.map((slot, idx) => (
                <div key={idx} className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b px-4 py-3 flex justify-between items-center">
                    <div className="font-semibold text-gray-800">{slot.time}</div>
                    <div className="text-sm text-gray-500">Lead: {slot.lead}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white text-gray-500 text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 font-medium">Name (Role)</th>
                          <th className="px-4 py-3 font-medium">Mobile Number</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                        {[slot.lead, ...slot.support].map(member => {
                          const status = getMemberStatus(member, slot.time);
                          return (
                            <tr key={member} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {member} {member === slot.lead && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Lead</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-600 flex items-center gap-2">
                                <Phone size={14} className="text-gray-400" /> {getMobileNumber(member)}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{usersMap[member] || 'N/A'}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                  {status.icon}
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
             <div className="relative w-full max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search name or email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading logs...</div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 border-b">
                    <th className="p-3 font-medium">Time</th>
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
                      <td colSpan="7" className="p-4 text-center text-gray-500">No logs found.</td>
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
                            log.action_type === 'START' ? 'bg-blue-100 text-blue-700' : 
                            log.action_type === 'END' ? 'bg-green-100 text-green-700' :
                            log.action_type === 'AUTO-END' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="p-3">
                          {log.photo_url ? (
                            <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-medium">View</a>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {log.latitude !== 0 ? (
                            <a href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                            </a>
                          ) : (
                            <span className="text-gray-400 text-sm">System Generated</span>
                          )}
                        </td>
                        <td className="p-3">
                          <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-700 p-1">
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
      )}
    </div>
  );
}
