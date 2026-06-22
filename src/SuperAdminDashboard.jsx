import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

 // New Tenant Form State
  const [companyName, setCompanyName] = useState('');
  const [brandColor, setBrandColor] = useState('#f97316'); 
  const [selectedFeatures, setSelectedFeatures] = useState({
    exec: true, yard: true, trip: true, dispatch: true, reports: true, office: false, pm: false
  });
  
  // ADDED: Admin User Credentials State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setTenants(data);
    setIsLoading(false);
  };

  const handleToggleFeature = (feat) => {
    setSelectedFeatures(prev => ({ ...prev, [feat]: !prev[feat] }));
  };

  const handleCreateTenant = async () => {
    if (!companyName) return alert("Please enter a company name.");
    if (!adminEmail || !adminPassword) return alert("Please provide admin credentials.");
    
    setIsCreating(true);

    const activeFeaturesArray = Object.keys(selectedFeatures).filter(k => selectedFeatures[k]);
    const trialDate = new Date();
    trialDate.setDate(trialDate.getDate() + 90);

    // STEP 1: Create the Company and return the new ID
    const { data: newCompany, error: companyError } = await supabase
      .from('companies')
      .insert([{
        name: companyName, 
        brand_color: brandColor,
        features_active: activeFeaturesArray,
        status: 'TRIAL', 
        trial_ends_at: trialDate.toISOString(), // <-- Add a comma here!
        admin_email: adminEmail                 // 🚀 ADD THIS NEW LINE HERE! 
      }])
      .select() // <-- ADDED: This forces Supabase to return the new row
      .single(); // <-- ADDED: Returns just the one object instead of an array

    if (companyError) {
      setIsCreating(false);
      return alert("Error creating tenant: " + companyError.message);
    }

    // STEP 2 & 3: Create Auth User & Link Profile (Architecture Note Below)
    try {
      /* NOTE: Running auth creation directly on the frontend usually requires 
         either logging the current user (you) out, or using a secure Edge Function.
         For prototype testing, you can use signUp, but it will log out your God Mode.
      */
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
      });

      if (authError) throw authError;

      // Link them to the company in user_profiles
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([{
            user_id: authData.user.id,
            company_id: newCompany.id, // Using the ID we got from Step 1!
            role: 'admin' // Make them the admin of their own company
          }]);
          
        if (profileError) throw profileError;
      }

      alert(`${companyName} successfully onboarded on a 90-Day Trial!`);
      
      // Reset Form
      setCompanyName('');
      setAdminEmail('');
      setAdminPassword('');
      fetchTenants();
      
    } catch (error) {
      alert("Company created, but user setup failed: " + error.message);
    }

    setIsCreating(false);
  };

  if (isLoading) return <div className="p-10 text-center text-white font-bold animate-pulse">Loading Global Matrix...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in font-sans pb-20">
      
      <div className="mb-8 border-b border-gray-700 pb-4">
        <h2 className="text-3xl font-black tracking-widest text-white uppercase border-l-4 border-red-500 pl-4">
          Super Admin Console
        </h2>
        <p className="text-gray-400 mt-2 text-sm font-bold tracking-wider">
          Global Fleet OS Tenant Management
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: NEW TENANT CREATOR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-white font-black uppercase tracking-widest mb-6 border-b border-gray-700 pb-2">
              Onboard New Client
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Company Name</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Logistics"
                  className="w-full bg-gray-800 text-white p-3 border border-gray-700 rounded-lg outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Brand Hex Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border border-gray-700 bg-gray-800 p-1"
                  />
                  <input 
                    type="text" 
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="flex-1 bg-gray-800 text-white p-3 border border-gray-700 rounded-lg outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Module Access (Pricing Tiers)</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(selectedFeatures).map(feat => (
                    <button 
                      key={feat}
                      onClick={() => handleToggleFeature(feat)}
                      className={`p-2 rounded border text-xs font-bold uppercase transition-colors ${selectedFeatures[feat] ? 'bg-green-900/40 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                    >
                     {feat === 'exec' ? 'Dashboard' : feat === 'pm' ? 'Maintenance' : feat === 'dispatch' ? 'Dispatch Board' : feat}
                    </button>
                  ))}
                </div>
              </div>

              {/* ADDED: Initial Admin Credentials Section */}
              <div className="pt-4 border-t border-gray-700 mt-4">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Primary Admin Account</label>
                <div className="space-y-3">
                  <input 
                    type="email" 
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full bg-gray-800 text-white p-3 border border-gray-700 rounded-lg outline-none focus:border-red-500 text-sm"
                  />
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Temporary Password"
                    className="w-full bg-gray-800 text-white p-3 border border-gray-700 rounded-lg outline-none focus:border-red-500 text-sm"
                  />
                </div>
              </div>

              <button 
                onClick={handleCreateTenant}
                disabled={isCreating}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest py-4 rounded-xl mt-4 shadow-lg active:scale-95 transition-all"
              >
                {isCreating ? 'Deploying...' : 'Deploy Tenant'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: ACTIVE TENANTS */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-6 border-b border-gray-700 pb-2">
              Active Fleet OS Instances
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-900 text-gray-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 rounded-tl-lg">Tenant / ID</th>
                    <th className="p-3">Brand</th>
                    <th className="p-3">Active Modules</th>
                    <th className="p-3 rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {tenants.map(t => (
                    <tr key={t.id} className="hover:bg-gray-750 transition-colors">
                      <td className="p-3">
                        {/* Adjusted to use t.name based on your database column insert */}
                        <p className="font-black text-white">{t.name || t.company_name}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">{t.id}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-gray-500" style={{ backgroundColor: t.brand_color || '#4f46e5' }}></div>
                          <span className="text-xs uppercase">{t.brand_color || '#4f46e5'}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(t.features_active || []).map(f => (
                            <span key={f} className="text-[9px] bg-gray-900 border border-gray-600 px-1.5 py-0.5 rounded text-gray-400 uppercase font-bold">{f}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-wider ${t.status === 'ACTIVE' ? 'bg-green-900/50 text-green-400 border border-green-500/50' : 'bg-red-900/50 text-red-400 border border-red-500/50'}`}>
                          {t.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}