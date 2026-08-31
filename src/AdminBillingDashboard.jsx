import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

// 🚀 SCALABLE PRICING ENGINE
const PRICING_TIERS = {
  BAKKIE: 100,
  RIGID: 200,
  TANDEM_TRAILER: 250,
  POWER_UNIT: 300,
  DOLLY_16: 500,
  ABNORMAL_16: 500,
  ABNORMAL_32: 1000,
  UNKNOWN: 0
};

// 🚀 NEW: CLIENT DIRECTORY
const COMPANY_NAMES = {
  1: 'Stallion Trucking',
  8: 'Dalinjebo Group',
  9: 'WastePlan'
  // When you onboard new clients, just add them here (e.g., 10: 'NextGen Logistics')
};


export default function AdminBillingDashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActiveFleet();
  }, []);

  const fetchActiveFleet = async () => {
    setIsLoading(true);
    // We ONLY fetch ACTIVE vehicles. Scrapped/Sold ones are completely ignored for billing.
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, company_id, fleet_number, asset_type, type')
      .eq('status', 'ACTIVE');

    if (error) {
      alert("Failed to fetch billing data: " + error.message);
    } else {
      setVehicles(data || []);
    }
    setIsLoading(false);
  };

  // 🚀 THE UPGRADED CATEGORIZATION ENGINE
      const categorizeAsset = (vehicle) => {
        const typeStr = String(vehicle.asset_type || vehicle.type || '').toLowerCase();
        
        // 1. Light Vehicles
        if (typeStr.includes('bakkie') || typeStr.includes('ldv')) return 'BAKKIE';
        
        // 2. Rigids
        if (typeStr.includes('rigid')) return 'RIGID';
        
        // 3. Specialized Trailers
        if (typeStr.includes('dolly')) return 'DOLLY_16';
        if (typeStr.includes('abnormal') && typeStr.includes('32')) return 'ABNORMAL_32';
        if (typeStr.includes('abnormal')) return 'ABNORMAL_16';
        
        // 4. Standard Trailers (Catch-all for Link, Deck, Tandem, etc.)
        if (typeStr.includes('trailer') || typeStr.includes('link') || typeStr.includes('deck') || typeStr.includes('tandem')) {
          return 'TANDEM_TRAILER';
        }
        
        // 5. Default fallback
        return 'POWER_UNIT'; 
      };

  // 🚀 THE BILLING CALCULATOR
  const clientInvoices = useMemo(() => {
    const grouped = {};

    vehicles.forEach(vehicle => {
      const cid = vehicle.company_id || 'Unknown Client';
      if (!grouped[cid]) {
        grouped[cid] = {
          companyId: cid,
          totalAssets: 0,
          totalRevenue: 0,
          breakdown: {
            BAKKIE: 0, RIGID: 0, TANDEM_TRAILER: 0, POWER_UNIT: 0, 
            DOLLY_16: 0, ABNORMAL_16: 0, ABNORMAL_32: 0, UNKNOWN: 0
          }
        };
      }

      const category = categorizeAsset(vehicle);
      
      grouped[cid].totalAssets += 1;
      grouped[cid].breakdown[category] += 1;
      grouped[cid].totalRevenue += PRICING_TIERS[category] || 0;
    });

    // Convert the object into an array and sort by highest paying client
    return Object.values(grouped).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [vehicles]);

  const globalMRR = clientInvoices.reduce((sum, client) => sum + client.totalRevenue, 0);
  const globalAssets = clientInvoices.reduce((sum, client) => sum + client.totalAssets, 0);

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen animate-fade-in text-gray-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 uppercase">Billing Engine</h1>
            <p className="text-gray-500 font-bold">Automated Monthly Recurring Revenue (MRR)</p>
          </div>
          <button onClick={fetchActiveFleet} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg active:scale-95">
            Refresh Ledger
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400 font-bold animate-pulse">Calculating fleet usage...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-green-500 flex flex-col justify-center items-center text-center">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Monthly Revenue</p>
                <p className="text-5xl font-black text-green-600">R {globalMRR.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-indigo-500 flex flex-col justify-center items-center text-center">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Active Assets</p>
                <p className="text-5xl font-black text-indigo-600">{globalAssets.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm border-b-2 border-gray-200 pb-2">Client Invoices Breakdown</h3>
              
              {clientInvoices.length === 0 ? (
                <p className="text-gray-500 italic">No active assets found in the database.</p>
              ) : (
                clientInvoices.map(client => (
                  <div key={client.companyId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 bg-gray-900 flex justify-between items-center">
  <h4 className="text-white font-black uppercase tracking-widest">
    Client ID {client.companyId}: {COMPANY_NAMES[client.companyId] || 'Unknown Company'}
  </h4>
  <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-3 py-1 rounded text-lg font-black">
    R {client.totalRevenue.toLocaleString()} <span className="text-xs font-bold text-green-400/70">/mo</span>
  </span>
</div>
                    
                    <div className="p-5">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Billable Assets: {client.totalAssets}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(client.breakdown).map(([category, count]) => {
                          if (count === 0) return null;
                          return (
                            <div key={category} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                              <div>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{category.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-gray-400 font-bold">R {PRICING_TIERS[category]} ea</p>
                              </div>
                              <span className="text-lg font-black text-gray-800">x{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}