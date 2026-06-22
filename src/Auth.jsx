import { useState } from 'react';
import { supabase } from './supabaseClient';
import { Truck } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isSignUp) {
        // Create a new user
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Registration successful! You can now sign in.');
        setIsSignUp(false);
      } else {
        // Sign in existing user
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // If successful, the App component will automatically detect it
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border-t-4 border-blue-600">
        <div className="flex justify-center mb-6">
          <Truck className="text-blue-600 w-16 h-16" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-800">
          Fleet Management Portal
        </h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          Authorized Dispatch Personnel Only
        </p>
        
        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="dispatcher@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold p-3 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Authenticating...' : (isSignUp ? 'Register New Fleet' : 'Secure Login')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {isSignUp ? 'Already have credentials? Sign in here' : 'Need an account? Register fleet'}
          </button>
        </div>
      </div>
    </div>
  );
}