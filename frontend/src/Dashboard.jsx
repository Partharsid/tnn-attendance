import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { LogOut, Camera, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import Webcam from 'react-webcam';
import { format } from 'date-fns';
import scheduleData from './data/schedule.json';
import usersMap from './data/users.json'; 
import AdminDashboard from './AdminDashboard';

export default function Dashboard({ session }) {

  const [userName, setUserName] = useState('');
  const [userSlots, setUserSlots] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const webcamRef = useRef(null);

  useEffect(() => {
    const email = session.user.email;
    const fullName = session.user.user_metadata.full_name;
    
    // Determine the user's registered name in the schedule
    // First check if email is explicitly mapped in users.json
    // users.json has format { "Name in Schedule": "email@vitap..." }
    let matchedName = null;
    for (const [name, mappedEmail] of Object.entries(usersMap)) {
      if (mappedEmail.toLowerCase() === email.toLowerCase()) {
        matchedName = name;
        break;
      }
    }
    
    // Fallback: Check if their Google Name exactly matches a name in users.json keys
    if (!matchedName && usersMap.hasOwnProperty(fullName)) {
      matchedName = fullName;
    }

    setUserName(matchedName || fullName);

    if (matchedName) {
      // Filter slots for this user
      const slots = scheduleData.filter(
        s => s.lead === matchedName || s.support.includes(matchedName)
      );
      setUserSlots(slots);
      
      // Determine if there is a current slot today
      const todayStr = format(new Date(), 'EEEE'); // e.g., 'Tuesday'
      const todaysSlots = slots.filter(s => s.day === todayStr);
      
      // We can get more complex with time checking, but for now just show today's slots
      // and let them mark attendance if they are in one of those slots.
      setCurrentSlot(todaysSlots.length > 0 ? todaysSlots[0] : null);
    }
    
    // Request location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          setLocError(err.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setLocError('Geolocation not supported by this browser.');
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const captureAndMarkAttendance = useCallback(async (type) => {
    if (!location) {
      alert("Waiting for GPS location. Please ensure location permissions are granted.");
      return;
    }
    
    setCapturing(true);
    setUploadStatus('Capturing photo...');
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Could not capture photo.");
      
      // Convert base64 to blob
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      
      const timestamp = new Date();
      const fileName = `${session.user.id}/${format(timestamp, 'yyyy-MM-dd_HH-mm-ss')}_${type}.jpg`;
      
      setUploadStatus('Uploading photo...');
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg'
        });
        
      if (uploadError) throw uploadError;
      
      setUploadStatus('Recording attendance...');
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(fileName);
        
      // Save record to database
      const { error: dbError } = await supabase
        .from('attendance_logs')
        .insert([
          {
            user_id: session.user.id,
            email: session.user.email,
            name: userName,
            slot_day: currentSlot?.day || 'Unknown',
            slot_time: currentSlot?.time || 'Unknown',
            action_type: type, // 'START' or 'END'
            latitude: location.lat,
            longitude: location.lng,
            photo_url: publicUrl,
            timestamp: timestamp.toISOString()
          }
        ]);
        
      if (dbError) throw dbError;
      
      setUploadStatus('Attendance marked successfully!');
      setTimeout(() => setUploadStatus(''), 3000);
      
    } catch (err) {
      console.error(err);
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      setCapturing(false);
    }
  }, [webcamRef, location, session, userName, currentSlot]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">TNN Attendance</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-600">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 mt-6">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-2">Welcome, {userName}</h2>
          
          {userSlots.length === 0 ? (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-md mt-4">
              <AlertCircle size={20} />
              <p>We couldn't find your name in the schedule. Please ask an admin to link your email ({session.user.email}) in the system.</p>
            </div>
          ) : (
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-700 border-b pb-2 mb-4">Your Today's Slot</h3>
              {currentSlot ? (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="font-semibold text-blue-900">{currentSlot.day} • {currentSlot.time}</p>
                  <p className="text-sm text-blue-800 mt-1">Role: {currentSlot.lead === userName ? 'Lead' : 'Support'}</p>
                </div>
              ) : (
                <p className="text-gray-500">You have no slots scheduled for today.</p>
              )}
            </div>
          )}
        </div>

        {userSlots.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
              <Camera size={20} /> Mark Attendance
            </h3>
            
            <div className="mb-4 text-sm flex items-center gap-2">
              <MapPin size={16} className={location ? "text-green-500" : "text-amber-500"} />
              {location ? (
                <span className="text-green-700">GPS Location Acquired</span>
              ) : (
                <span className="text-amber-600">{locError || "Acquiring GPS location..."}</span>
              )}
            </div>

            <div className="rounded-lg overflow-hidden border bg-black mb-6 max-w-md mx-auto aspect-video relative">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover"
              />
            </div>

            {uploadStatus && (
              <div className={`p-3 rounded-md mb-6 text-center text-sm font-medium ${
                uploadStatus.includes('successfully') ? 'bg-green-50 text-green-700' :
                uploadStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {uploadStatus}
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => captureAndMarkAttendance('START')}
                disabled={capturing || !location || !currentSlot}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 max-w-xs"
              >
                Mark Start Slot
              </button>
              <button
                onClick={() => captureAndMarkAttendance('END')}
                disabled={capturing || !location || !currentSlot}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 max-w-xs"
              >
                Mark End Slot
              </button>
            </div>
          </div>
        )}
        
        {session.user.email === 'parth.25bcd7027@vitapstudent.ac.in' && (
          <AdminDashboard />
        )}
      </main>
    </div>
  );
}
