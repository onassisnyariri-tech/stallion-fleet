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
    // Fetch everyone who shares this exact company ID
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, role, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (data) setTeam(data);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      /* THE KAIZEN MOVE: We reuse the exact same Edge Function architecture!
         Instead of creating a new company, we just pass the Admin's existing companyId 
         and the specific role they selected from the dropdown.
      */
      const { data, error } = await supabase.functions.invoke('provision-employee', {
        body: { 
          email: email, 
          password: password, 
          companyId: companyId, // The Admin's company ID
          role: role // 'inspector' or 'operations'
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

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans">
      <h2 className="text-2xl font-black text-gray-800 uppercase tracking-widest mb-6">
        Team Directory
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
                {/* Notice we DO NOT give them the option to create another Admin! */}
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
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 border rounded-lg">
                <span className="font-mono text-xs text-gray-500">{member.user_id.substring(0, 8)}...</span>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                  member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                  member.role === 'operations' ? 'bg-blue-100 text-blue-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}