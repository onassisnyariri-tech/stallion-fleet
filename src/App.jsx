import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// --- APP COMPONENTS ---
import AuthScreen from './AuthScreen';
import ExecutiveDashboard from './ExecutiveDashboard';
import FleetAssets from './FleetAssets';
import TripProfitability from './TripProfitability';
import TyreDashboard from './TyreDashboard';
import MaintenanceTracker from './MaintenanceTracker';
import ProfitabilityReport from './ProfitabilityReport';
import SuperAdminDashboard from './SuperAdminDashboard';
import { useAuth } from './context/AuthContext.jsx';
import TeamManagement from './TeamManagement';
import UserSettings from './UserSettings';
import LiveDispatchBoard from './LiveDispatchBoard';
import Drivers from './Drivers';
import LightVehicleInspection from './LightVehicleInspection'; // adjust path if needed
import AdminBillingDashboard from './AdminBillingDashboard';

export default function App() {
  const { permissions } = useAuth(); // 2. ADD THIS HOOK
  const [session, setSession] = useState(null);
  const [companyContext, setCompanyContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('exec'); 
// ADD THIS BLOCK: Route Inspectors to the Yard automatically
// ADD THIS: The Smart Routing Fallback
  useEffect(() => {
    if (companyContext && companyContext.features_active) {
      // If the currently active tab is NOT in their paid features...
      if (!companyContext.features_active.includes(activeTab)) {
        // Automatically switch them to the first feature in their array
        setActiveTab(companyContext.features_active[0]);
      }
    }
  }, [companyContext]);  
useEffect(() => {
    if (permissions && !permissions.canAccessFinancials && activeTab === 'exec') {
      setActiveTab('yard');
    }
  }, [permissions, activeTab]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchCompanyProfile(session.user.id);
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchCompanyProfile(session.user.id);
      } else {
        setCompanyContext(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchCompanyProfile = async (userId) => {
    setIsLoading(true);
    
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('user_id', userId)
      .limit(1);

    if (profileError) {
      console.error("❌ Database rejected profile request:", profileError);
      setIsLoading(false);
      return;
    }

    if (profiles && profiles.length > 0) {
      const companyId = profiles[0].company_id;

      const { data: companies } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .limit(1);
        
      if (companies && companies.length > 0) {
        setCompanyContext(companies[0]);
      }
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-indigo-500 font-black tracking-widest text-xl animate-pulse">
          LOADING FLEET OS...
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  if (companyContext && companyContext.status === 'TRIAL') {
    const trialEnd = new Date(companyContext.trial_ends_at);
    if (new Date() > trialEnd) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-4xl font-black text-white uppercase tracking-widest mb-4">Trial Expired</h1>
          <button onClick={handleLogout} className="text-sm font-bold text-gray-500 hover:text-white transition-colors">Sign Out</button>
        </div>
      );
    }
  }

  // --- DYNAMIC SAAS VARIABLES ---
  // Default to Indigo and all features if the database hasn't loaded yet
  const brandColor = companyContext?.brand_color || '#4f46e5'; 
  const activeFeatures = companyContext?.features_active || ['exec', 'yard', 'trip', 'reports', 'pm', 'office'];
  const hasFeature = (feat) => activeFeatures.includes(feat);

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      
      {/* Top Navigation Bar */}
      <nav className="bg-gray-900 border-b border-gray-800 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            {/* Left Side: Logo & Desktop Tabs */}
            <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar">
              {/* DYNAMIC LOGO COLOR */}
              <span className="font-black text-xl tracking-widest uppercase shrink-0" style={{ color: brandColor }}>
                Fleet OS
              </span>
              
              <div className="hidden lg:flex gap-2 ml-4">
  {/* FINANCIAL & EXEC TABS */}
        
        {/* STALLION VIEW (Locked to financial permissions) */}
        {hasFeature('exec') && permissions?.canAccessFinancials && (
          <button 
            onClick={() => setActiveTab('exec')} 
            style={activeTab === 'exec' ? { backgroundColor: brandColor, color: 'white' } : {}} 
            className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'exec' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}
          >
            Executive
          </button>
        )}

        {/* 🚀 NEW: CLIENT SUMMARY VIEW */}
{hasFeature('client-summary') && permissions?.canAccessFinancials && (
  <button 
    onClick={() => setActiveTab('client-summary')} 
    style={activeTab === 'client-summary' ? { backgroundColor: brandColor, color: 'white' } : {}} 
    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'client-summary' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}
  >
    Client Summary
  </button>
)}
  {hasFeature('trip') && permissions?.canAccessFinancials && <button onClick={() => setActiveTab('trip')} style={activeTab === 'trip' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'trip' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}>Trip Ledger</button>}
  {hasFeature('reports') && permissions?.canAccessFinancials && <button onClick={() => setActiveTab('reports')} style={activeTab === 'reports' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'reports' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}>PDF Reports</button>}

  {/* YARD TAB */}
  {hasFeature('yard') && permissions?.canAccessYard && <button onClick={() => setActiveTab('yard')} style={activeTab === 'yard' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'yard' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}>Yard App</button>}
  
  {/* 🚀 DESKTOP DISPATCH TAB */}
{hasFeature('dispatch') && (permissions?.canAccessDispatch || permissions?.canAccessAdminSettings) && (
  <button 
    onClick={() => setActiveTab('dispatch')} 
    style={activeTab === 'dispatch' ? { backgroundColor: brandColor, color: 'white' } : {}} 
    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'dispatch' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}
  >
    Dispatch Board
  </button>
)}
  
  {/* TYRES & MAINTENANCE TABS */}
  {hasFeature('office') && permissions?.canAccessTyres && <button onClick={() => setActiveTab('office')} style={activeTab === 'office' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'office' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}>Tyres</button>}
  {hasFeature('pm') && permissions?.canAccessMaintenance && <button onClick={() => setActiveTab('pm')} style={activeTab === 'pm' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'pm' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}>Maintenance</button>}
  {/* 🚀 ADD YOUR NEW TAB HERE */}
  {hasFeature('light-inspection') && (
  <button 
    onClick={() => setActiveTab('light-inspection')} 
    style={activeTab === 'light-inspection' ? { backgroundColor: brandColor, color: 'white' } : {}} 
    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'light-inspection' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}
  >
    Light Inspection
  </button>
)}
    
  {/* 🚀 ADMIN ONLY: DRIVERS TAB */}
  {permissions?.canAccessAdminSettings && (
    <button 
      onClick={() => setActiveTab('drivers')} 
      style={activeTab === 'drivers' ? { backgroundColor: brandColor, color: 'white' } : {}} 
      className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'drivers' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}
    >
      Drivers
    </button>
  )}

  {/* TEAM / ADMIN TAB */}
  {permissions?.canAccessAdminSettings && (
    <button 
      onClick={() => setActiveTab('team')} 
      style={activeTab === 'team' ? { backgroundColor: brandColor, color: 'white' } : {}} 
      className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-colors shrink-0 ${activeTab !== 'team' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : ''}`}
    >
      Team
    </button>
  )}
</div>
            </div>

           {/* Right Side: Tenant Info & Logout */}
            <div className="flex items-center gap-4 pl-4 border-l border-gray-800 ml-4">
              
              {/* SECRET SUPER ADMIN BUTTONS - Only visible to Onassis */}
              {session?.user?.email === 'onassis.nyariri@gmail.com' && (
                <div className="hidden sm:flex gap-2">
                  <button 
                    onClick={() => setActiveTab('billing')} 
                    className={`px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest border-2 transition-colors shrink-0 ${activeTab === 'billing' ? 'bg-purple-600 border-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'border-purple-900 text-purple-500 hover:bg-purple-900/30'}`}
                  >
                    MRR Billing
                  </button>
                  <button 
                    onClick={() => setActiveTab('admin')} 
                    className={`px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest border-2 transition-colors shrink-0 ${activeTab === 'admin' ? 'bg-red-600 border-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'border-red-900 text-red-500 hover:bg-red-900/30'}`}
                  >
                    God Mode
                  </button>
                </div>
              )}

              <div className="text-right hidden sm:block">
                {/* Change this line to check for both company_name AND name */}
                <p className="text-white text-xs font-black uppercase tracking-wider">
                  {companyContext?.company_name || companyContext?.name || 'Unassigned Tenant'}
                </p>
                <p className="text-gray-500 text-[10px] uppercase font-bold">{session?.user?.email}</p>
              </div>
              
              {/* ADDED: Settings Button */}
              <button 
                onClick={() => setActiveTab('settings')} 
                className="text-gray-400 hover:text-white px-3 py-1.5 rounded transition-colors"
                title="Account Settings"
              >
                ⚙️
              </button>
              <button onClick={handleLogout} className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded text-xs font-black transition-colors uppercase tracking-wider active:scale-95">Logout</button>
            </div>
            
          </div>
        </div>

       {/* Mobile Navigation Scrollbar */}
        <div className="lg:hidden flex overflow-x-auto bg-gray-800 p-2 gap-2 hide-scrollbar">
          {hasFeature('exec') && permissions?.canAccessFinancials && <button onClick={() => setActiveTab('exec')} style={activeTab === 'exec' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'exec' ? 'text-gray-400' : ''}`}>Exec</button>}
          {hasFeature('trip') && permissions?.canAccessFinancials && <button onClick={() => setActiveTab('trip')} style={activeTab === 'trip' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'trip' ? 'text-gray-400' : ''}`}>Ledger</button>}
          {hasFeature('reports') && permissions?.canAccessFinancials && <button onClick={() => setActiveTab('reports')} style={activeTab === 'reports' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'reports' ? 'text-gray-400' : ''}`}>Reports</button>}
          
          {/* 🚀 MOBILE CLIENT SUMMARY TAB */}
          {hasFeature('client-summary') && permissions?.canAccessFinancials && (
            <button 
              onClick={() => setActiveTab('client-summary')} 
              style={activeTab === 'client-summary' ? { backgroundColor: brandColor, color: 'white' } : {}} 
              className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'client-summary' ? 'text-gray-400' : ''}`}
            >
              Summary
            </button>
          )}

          {/* 🚀 MOBILE YARD TAB */}
          {hasFeature('yard') && (
            <button 
              onClick={() => setActiveTab('yard')} 
              style={activeTab === 'yard' ? { backgroundColor: brandColor, color: 'white' } : {}} 
              className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'yard' ? 'text-gray-400' : ''}`}
            >
              Yard
            </button>
          )}

          {/* 🚀 MOBILE DISPATCH TAB */}
          {hasFeature('dispatch') && (permissions?.canAccessDispatch || permissions?.canAccessAdminSettings) && (
            <button 
              onClick={() => setActiveTab('dispatch')} 
              style={activeTab === 'dispatch' ? { backgroundColor: brandColor, color: 'white' } : {}} 
              className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'dispatch' ? 'text-gray-400' : ''}`}
            >
              Dispatch
            </button>
          )}
          
          {hasFeature('office') && permissions?.canAccessTyres && <button onClick={() => setActiveTab('office')} style={activeTab === 'office' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'office' ? 'text-gray-400' : ''}`}>Tyres</button>}
          {hasFeature('pm') && permissions?.canAccessMaintenance && <button onClick={() => setActiveTab('pm')} style={activeTab === 'pm' ? { backgroundColor: brandColor, color: 'white' } : {}} className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'pm' ? 'text-gray-400' : ''}`}>Maint</button>}
          
          {/* 🚀 MOBILE LIGHT INSPECTION TAB */}
          {hasFeature('light-inspection') && (
            <button 
              onClick={() => setActiveTab('light-inspection')} 
              style={activeTab === 'light-inspection' ? { backgroundColor: brandColor, color: 'white' } : {}} 
              className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'light-inspection' ? 'text-gray-400' : ''}`}
            >
              Light Insp.
            </button>
          )}
          
          {/* 🚀 ADMIN ONLY: MOBILE DRIVERS TAB */}
          {permissions?.canAccessAdminSettings && (
            <button 
              onClick={() => setActiveTab('drivers')} 
              style={activeTab === 'drivers' ? { backgroundColor: brandColor, color: 'white' } : {}} 
              className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'drivers' ? 'text-gray-400' : ''}`}
            >
              Drivers
            </button>
          )}

          {/* MOBILE TEAM TAB */}
          {permissions?.canAccessAdminSettings && (
            <button 
              onClick={() => setActiveTab('team')} 
              style={activeTab === 'team' ? { backgroundColor: brandColor, color: 'white' } : {}} 
              className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab !== 'team' ? 'text-gray-400' : ''}`}
            >
              Team
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Router */}
      <main className="w-full">
        {/* STALLION TRUCKING VIEW: Shows everything (Protected by 'exec' feature) */}
{activeTab === 'exec' && hasFeature('exec') && (
  <ExecutiveDashboard companyId={companyContext?.id} setActiveTab={setActiveTab} />
)}

{/* CLIENT VIEW: Hides the money (Uses a new tab name like 'client-summary') */}
{activeTab === 'client-summary' && (
  <ExecutiveDashboard companyId={companyContext?.id} setActiveTab={setActiveTab} hideFinancials={true} />
)}
        {activeTab === 'yard' && hasFeature('yard') && <FleetAssets companyId={companyContext?.id} />}
        {activeTab === 'trip' && hasFeature('trip') && <TripProfitability companyId={companyContext?.id} />}
        {activeTab === 'dispatch' && <LiveDispatchBoard companyId={companyContext?.id} />}
        {activeTab === 'office' && hasFeature('office') && <TyreDashboard companyId={companyContext?.id} />}
        {activeTab === 'pm' && hasFeature('pm') && <MaintenanceTracker companyId={companyContext?.id} />}
        

        {activeTab === 'reports' && hasFeature('reports') && <ProfitabilityReport companyId={companyContext?.id} />}
        {activeTab === 'admin' && session?.user?.email === 'onassis.nyariri@gmail.com' && <SuperAdminDashboard />}
        {activeTab === 'drivers' && <Drivers companyId={companyContext?.id} />}
        {activeTab === 'light-inspection' && hasFeature('light-inspection') && (
  <LightVehicleInspection />
)}
      {/* ADD THE TEAM ROUTE HERE */}
  {activeTab === 'team' && permissions?.canAccessAdminSettings && <TeamManagement companyId={companyContext?.id} />}
  {/* Add this line right below your other activeTab routes */}
{activeTab === 'settings' && <UserSettings />}
  
  {/* God Mode Route */}
  {activeTab === 'admin' && session?.user?.email === 'onassis.nyariri@gmail.com' && <SuperAdminDashboard />}
  {/* 🚀 PASTE THE NEW BILLING SCREEN HERE */}
    {activeTab === 'billing' && session?.user?.email === 'onassis.nyariri@gmail.com' && (
    <AdminBillingDashboard />
  )}
</main>
      

    </div>
  );
}