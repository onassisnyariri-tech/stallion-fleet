import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';


export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(''); // New state for success banners

  // New States for Password Recovery
  const [authMode, setAuthMode] = useState('login'); // 'login', 'forgot_password', 'update_password'
  const [newPassword, setNewPassword] = useState('');

  // Listen for the password recovery link click
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('update_password');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      setSuccessMsg('Login successful! Redirecting...');
      
      // Instead of forcing a hard reload, we use a slight delay 
      // to let the Supabase session token settle in the browser storage.
      // We then trigger a state change that your app's router/context 
      // should pick up to switch to the dashboard.
      setTimeout(() => {
        window.location.href = window.location.origin; 
      }, 800);
    }
  };

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!email) {
      setErrorMsg("Please enter your email address first.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin, // Sends them back to your app
    });

    if (error) {
      setErrorMsg(`Error: ${error.message}`);
    } else {
      setSuccessMsg("Password reset email sent! Please check your inbox.");
      setAuthMode('login'); // Go back to login so they can log in later
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword) {
      setErrorMsg("Please enter a new password.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setErrorMsg(`Error updating password: ${error.message}`);
    } else {
      setSuccessMsg("Password updated successfully! You are now logged in.");
      setAuthMode('login');
      setPassword(''); // Clear out the old password field
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white uppercase tracking-widest">Fleet OS</h1>
          <p className="text-gray-400 text-sm mt-2 font-bold uppercase">SaaS Operations Platform</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded mb-6 text-sm font-bold text-center">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-500/20 border border-green-500 text-green-100 p-3 rounded mb-6 text-sm font-bold text-center">
            {successMsg}
          </div>
        )}

        {/* --- LOGIN SCREEN --- */}
        {authMode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'AUTHENTICATING...' : 'SECURE LOGIN'}
            </button>

            <div className="text-center mt-4">
              <button 
                type="button" 
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setAuthMode('forgot_password');
                }} 
                className="text-gray-500 hover:text-indigo-400 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {/* --- FORGOT PASSWORD SCREEN --- */}
        {authMode === 'forgot_password' && (
          <form onSubmit={handleSendResetEmail} className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Reset Password</h2>
              <p className="text-gray-400 text-xs mt-2 font-bold">Enter your email to receive a reset link.</p>
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-3">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'SENDING...' : 'SEND RESET LINK'}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setErrorMsg('');
                  setAuthMode('login');
                }} 
                disabled={loading}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-black py-3 rounded-xl active:scale-[0.98] transition-all"
              >
                BACK TO LOGIN
              </button>
            </div>
          </form>
        )}

        {/* --- UPDATE PASSWORD SCREEN (Shown after clicking email link) --- */}
        {authMode === 'update_password' && (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
             <div className="text-center mb-2">
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Create New Password</h2>
              <p className="text-gray-400 text-xs mt-2 font-bold">Please secure your account.</p>
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">New Password</label>
              <input 
                type="password" 
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-black text-lg py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'SAVING...' : 'SAVE NEW PASSWORD'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}