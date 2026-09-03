import React, { useState } from 'react';
import { supabase } from './supabase';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // This ensures we get the domain if we need it, though Supabase handles Google OAuth.
          // You can enforce hosted domain by passing query params if needed.
          queryParams: {
            prompt: 'select_account',
          }
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TNN Attendance</h1>
          <p className="text-gray-600">Login with your VIT AP Email</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-70"
        >
          <LogIn size={20} />
          {loading ? 'Redirecting...' : 'Sign in with Google'}
        </button>
        
        <p className="text-xs text-gray-500 mt-6 text-center">
          Note: Your attendance is tracked via GPS coordinates at the start and end of your slot.
        </p>
      </div>
    </div>
  );
}
