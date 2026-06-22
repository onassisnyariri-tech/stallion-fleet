import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function UserSettings() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters long.");
    }

    setLoading(true);

    try {
      // This Supabase function automatically updates the password 
      // for whoever is currently logged into this browser session.
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage("Password successfully updated!");
      setNewPassword('');
      setConfirmPassword('');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto font-sans mt-8">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-widest mb-2 border-b-4 border-indigo-500 pb-2 inline-block">
          Security Settings
        </h2>
        <p className="text-gray-500 text-sm font-bold mb-8 uppercase tracking-wider">
          Update your temporary credentials
        </p>

        {message && <div className="bg-green-50 text-green-700 p-4 rounded-lg font-bold mb-6 border border-green-200">{message}</div>}
        {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg font-bold mb-6 border border-red-200">{error}</div>}

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">New Password</label>
            <input 
              type="password" 
              required 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-indigo-500 transition-colors font-bold text-gray-700"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Confirm Password</label>
            <input 
              type="password" 
              required 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50 outline-none focus:border-indigo-500 transition-colors font-bold text-gray-700"
              placeholder="Confirm new password"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
              loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg active:scale-[0.98]'
            }`}
          >
            {loading ? 'Updating Vault...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}