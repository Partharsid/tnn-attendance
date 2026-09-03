import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { LogOut, Camera, MapPin, AlertCircle, RefreshCw, SwitchCamera } from 'lucide-react';
import Webcam from 'react-webcam';
import { format } from 'date-fns';
import scheduleData from './data/schedule.json';
import usersMap from './data/users.json'; 
import AdminDashboard from './AdminDashboard';

export default function Dashboard({ session }) {

  const email = session.user.email;
  const fullName = session.user.user_metadata?.full_name || email;
  
  // Determine the user's registered name in the schedule
  let matchedName = null;
  for (const [name, mappedEmail] of Object.entries(usersMap)) {
    if (mappedEmail.toLowerCase() === email.toLowerCase()) {
      matchedName = name;
      break;
    }
  }
  
  if (!matchedName && usersMap.hasOwnProperty(fullName)) {
    matchedName = fullName;
  }

  const userName = matchedName || fullName;

  const [userSlots, setUserSlots] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [facingMode, setFacingMode] = useState('user');

  const webcamRef = useRef(null);

  const requestLocation = useCallback(() => {
    setLocError('Acquiring GPS location...');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocError('');
        },
        (err) => {
          setLocError(`GPS Error: ${err.message}. Please enable location and try again.`);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      setLocError('Geolocation not supported by this browser.');
    }
  }, []);

  useEffect(() => {
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
    
    // Request location initially
    requestLocation();
  }, [session, matchedName, requestLocation]);

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
      const { error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-800">TNN Attendance</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600 truncate max-w-[120px] sm:max-w-full">{session.user.email}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-1">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 mt-2">
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
                <span className="text-green-700 font-medium">GPS Location Acquired</span>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <span>{locError || "Acquiring GPS location..."}</span>
                  <button onClick={requestLocation} className="p-1 hover:bg-amber-100 rounded-full" title="Retry GPS">
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg overflow-hidden border bg-black mb-6 max-w-sm mx-auto aspect-[3/4] relative">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode }}
                mirrored={facingMode === "user"}
                forceScreenshotSourceSize={true}
                className="w-full h-full object-cover"
              />
              <button 
                onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")}
                className="absolute bottom-4 right-4 bg-gray-900/60 p-3 rounded-full text-white hover:bg-gray-800 transition-colors shadow-lg backdrop-blur-sm border border-gray-600/50 z-10"
                title="Flip Camera"
              >
                <SwitchCamera size={22} />
              </button>
            </div>

            {uploadStatus && (
              <div className={`p-3 rounded-md mb-6 text-center text-sm font-medium ${
                uploadStatus.includes('successfully') ? 'bg-green-50 text-green-700' :
                uploadStatus.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {uploadStatus}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={() => captureAndMarkAttendance('START')}
                disabled={capturing || !location || !currentSlot}
                className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 text-white py-4 sm:py-3 px-4 rounded-xl sm:rounded-lg font-medium transition-colors disabled:opacity-50 max-w-sm mx-auto sm:max-w-xs shadow-md"
              >
                Start Slot
              </button>
              <button
                onClick={() => captureAndMarkAttendance('END')}
                disabled={capturing || !location || !currentSlot}
                className="w-full sm:flex-1 bg-red-600 hover:bg-red-700 text-white py-4 sm:py-3 px-4 rounded-xl sm:rounded-lg font-medium transition-colors disabled:opacity-50 max-w-sm mx-auto sm:max-w-xs shadow-md"
              >
                End Slot
              </button>
            </div>
          </div>
        )}
        
        {['parth.25bcd7027@vitapstudent.ac.in', 'arnav.25bce7180@vitapstudent.ac.in', 'fazal.25bce7625@vitapstudent.ac.in'].includes(session.user.email) && (
          <AdminDashboard />
        )}
      </main>
    </div>
  );
}
