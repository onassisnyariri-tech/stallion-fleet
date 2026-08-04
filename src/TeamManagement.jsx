import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function TeamManagement({ companyId }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);

  // New Employee Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('inspector'); // Default to lowest permission

  useEffect(() => {
    if (companyId) fetchTeam();
  }, [companyId]);

  const fetchTeam = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, email, role, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching team:", error);
      return;
    }

    if (data) {
      // 🚀 Hides inactive users on the frontend instead of the database!
      // This prevents the "blank list" bug if some users have a NULL role.
      const activeUsers = data.filter(user => user.role !== 'inactive');
      setTeam(activeUsers);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('provision-employee', {
        body: { 
          email: email, 
          password: password, 
          companyId: companyId, 
          role: role 
        }
      });

      if (error) throw new Error(error.message);

      alert(`Successfully added ${email} as ${role.toUpperCase()}`);
      setEmail('');
      setPassword('');
      fetchTeam();

    } catch (err) {
      alert("Error adding employee: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 NEW: Revoke Access Function
  const handleRemoveUser = async (userId) => {
    if (!window.confirm("Are you sure you want to revoke access for this user? They will be instantly locked out of the app.")) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: 'inactive' })
        .eq('user_id', userId);

      if (error) throw error;

      setTeam(prevTeam => prevTeam.filter(member => member.user_id !== userId));
      alert("User access successfully revoked.");
      
    } catch (err) {
      console.error("Error removing user:", err);
      alert("Failed to remove user: " + err.message);
    }
  };
// 🚀 NEW: Update Role Function
  const handleUpdateRole = async (userId, newRole) => {
    try {
      // Update the database
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      // Update the screen instantly
      setTeam(prevTeam => 
        prevTeam.map(member => 
          member.user_id === userId ? { ...member, role: newRole } : member
        )
      );
      
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update role: " + err.message);
    }
  };
  return (
    <div className="p-6 max-w-4xl mx-auto font-sans">
      <h2 className="text-2xl font-black text-gray-800 uppercase tracking-widest mb-6">
  Team Directory - TEST
</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* ADD NEW EMPLOYEE FORM */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-fit">
          <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Add New Hire</h3>
          
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded bg-gray-50 outline-none focus:border-indigo-500" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Temp Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded bg-gray-50 outline-none focus:border-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Access Level</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 border rounded bg-gray-50 outline-none focus:border-indigo-500 font-bold text-sm">
                <option value="inspector">Yard Inspector (Walkarounds Only)</option>
                <option value="operations">Operations (Tyres, Maintenance, Fuel)</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded uppercase tracking-widest text-sm transition-colors mt-4">
              {loading ? 'Adding...' : '+ Add Employee'}
            </button>
          </form>
        </div>

        {/* ACTIVE EMPLOYEES LIST */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Active Access</h3>
          
          <div className="space-y-3">
            {team.map((member, index) => (
              <div key={member.user_id || index} className="flex flex-wrap md:flex-nowrap justify-between items-center p-3 bg-gray-50 border rounded-lg hover:border-gray-300 transition-colors gap-3">
                
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-gray-800">
                    {member.email || (member.user_id ? member.user_id.substring(0, 8) + '...' : 'Unknown')}
                  </span>
                  
                  {/* 🚀 UPDATED: Role Badge is now a clickable dropdown! */}
                  <select
                    value={member.role || 'inspector'}
                    onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded cursor-pointer outline-none border-none ${
                      member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      member.role === 'operations' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}
                  >
                    <option value="admin">Admin</option>
                    <option value="operations">Operations</option>
                    <option value="inspector">Inspector</option>
                  </select>
                </div>

                <button
                  onClick={() => handleRemoveUser(member.user_id)}
                  className="px-3 py-1 bg-white border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded hover:bg-red-600 hover:text-white transition-colors"
                >
                  Revoke
                </button>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}