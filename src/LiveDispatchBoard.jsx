import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function LiveDispatchBoard({ companyId }) {
  const [vehicles, setVehicles] = useState([]);
  const [recentTrips, setRecentTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (companyId) fetchDispatchData();
  }, [companyId]);

  const fetchDispatchData = async () => {
    setIsLoading(true);
    
    // 1. Fetch the entire fleet
    const { data: fleetData } = await supabase
      .from('vehicles')
      .select('*')
      .eq('company_id', companyId)
      .order('fleet_number', { ascending: true });

    // 2. Fetch the most recent 100 trips to figure out where the trucks are
    const { data: tripData } = await supabase
      .from('trips')
      .select('id, trip_ref, distance_km, power_unit_id, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fleetData) setVehicles(fleetData);
    if (tripData) setRecentTrips(tripData);
    
    setIsLoading(false);
  };
  // 🚀 NEW: QUICK STATUS TOGGLE
  const toggleVehicleStatus = async (vehicleId, currentStatus) => {
    const newStatus = currentStatus === 'IN SHOP' ? 'ACTIVE' : 'IN SHOP';
    
    // 1. Instantly update the screen (Optimistic UI)
    setVehicles(prevVehicles => 
      prevVehicles.map(v => v.id === vehicleId ? { ...v, status: newStatus } : v)
    );

    // 2. Update the Supabase Database in the background
    await supabase
      .from('vehicles')
      .update({ status: newStatus })
      .eq('id', vehicleId);
  };

  // Helper to separate trailers from horses
  const isTowedUnit = (vehicle) => {
    const t = (vehicle?.asset_type || vehicle?.type || '').toLowerCase();
    return t.includes('deck') || t.includes('link') || t.includes('trailer');
  };

  // Separate the fleet into Power Units and Trailers
  const powerUnits = vehicles.filter(v => !isTowedUnit(v));
  const trailers = vehicles.filter(v => isTowedUnit(v));

  // Apply filters (Active vs In Shop)
  const filteredPowerUnits = powerUnits.filter(unit => {
    if (filter === 'ALL') return true;
    return (unit.status || 'ACTIVE').toUpperCase() === filter;
  });

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8 animate-fade-in">
      
      {/* 🚀 HEADER & KANBAN FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Live Dispatch Board</h1>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Fleet Operations Control</p>
        </div>
        
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <button 
            onClick={() => setFilter('ALL')} 
            className={`px-6 py-2 text-xs font-black uppercase tracking-widest transition-colors ${filter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Entire Fleet
          </button>
          <button 
            onClick={() => setFilter('ACTIVE')} 
            className={`px-6 py-2 text-xs font-black uppercase tracking-widest transition-colors border-l border-gray-200 ${filter === 'ACTIVE' ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Active / On Road
          </button>
          <button 
            onClick={() => setFilter('IN SHOP')} 
            className={`px-6 py-2 text-xs font-black uppercase tracking-widest transition-colors border-l border-gray-200 ${filter === 'IN SHOP' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            In Workshop
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-lg font-bold text-gray-400 animate-pulse">Syncing satellite telemetry...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 🚀 TRUCK CARDS (THE KANBAN BOARD) */}
          {filteredPowerUnits.map(truck => {
            // Find hooked trailers (checks if trailer's hooked_to_id matches this truck)
            const hookedTrailers = trailers.filter(t => String(t.hooked_to_id) === String(truck.id));
            
            // Find the most recent trip for this specific truck
            const latestTrip = recentTrips.find(trip => String(trip.power_unit_id) === String(truck.id));

            const isShop = (truck.status || '').toUpperCase() === 'IN SHOP';

            return (
              <div key={truck.id} className={`bg-white rounded-2xl shadow-lg border-2 overflow-hidden flex flex-col ${isShop ? 'border-red-300' : 'border-gray-200'}`}>
                
                {/* CARD HEADER: TRUCK IDENTITY & QUICK TOGGLE */}
                <div className={`p-4 flex justify-between items-center ${isShop ? 'bg-red-50' : 'bg-gray-900'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isShop ? 'bg-red-500 animate-pulse' : 'bg-green-400'}`}></div>
                    <h2 className={`text-xl font-black ${isShop ? 'text-red-900' : 'text-white'}`}>
                      {truck.fleet_number}
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded hidden sm:block ${isShop ? 'bg-red-200 text-red-800' : 'bg-gray-700 text-gray-300'}`}>
                      {truck.make} {truck.model}
                    </span>
                    
                    {/* 🚀 NEW: QUICK STATUS BUTTONS */}
                    {isShop ? (
                      <button 
                        onClick={() => toggleVehicleStatus(truck.id, 'IN SHOP')}
                        className="bg-green-500 hover:bg-green-600 text-white text-[10px] font-black px-3 py-1.5 rounded shadow transition-colors uppercase tracking-widest cursor-pointer"
                      >
                        Release
                      </button>
                    ) : (
                      <button 
                        onClick={() => toggleVehicleStatus(truck.id, 'ACTIVE')}
                        className="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/50 hover:border-red-500 text-[10px] font-black px-2 py-1 rounded transition-colors uppercase tracking-widest cursor-pointer"
                      >
                        Down
                      </button>
                    )}
                  </div>
                </div>

                {/* CARD BODY */}
                <div className="p-5 flex-1 flex flex-col gap-4">
                  
                  {/* TRAILER CONFIGURATION */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Current Configuration</p>
                    {hookedTrailers.length === 0 ? (
                      <div className="text-sm font-bold text-gray-500 flex items-center gap-2">
                        <span className="w-2 h-2 bg-gray-300 rounded-full"></span> Bobtail (No Trailers Hooked)
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {hookedTrailers.map((trailer, index) => (
                          <div key={trailer.id} className="flex justify-between items-center bg-white border border-gray-200 px-3 py-1.5 rounded shadow-sm">
                            <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                              <span className="text-gray-400 text-[10px]">Link {index + 1}</span> 
                              {trailer.fleet_number}
                            </span>
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">HOOKED</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* LATEST TRIP / LOCATION */}
                  <div className="mt-auto">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Last Known Assignment</p>
                    {latestTrip ? (
                      <div className="bg-indigo-50 border-l-4 border-indigo-500 p-3 rounded-r-lg">
                        <p className="font-bold text-indigo-900 text-sm truncate" title={latestTrip.trip_ref}>
                          {latestTrip.trip_ref}
                        </p>
                        <div className="flex justify-between mt-2 text-xs font-bold text-indigo-700/70">
                          <span>{latestTrip.distance_km} km routed</span>
                          <span>{new Date(latestTrip.created_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-dashed border-gray-300 p-3 rounded text-center">
                        <p className="text-xs font-bold text-gray-400 italic">No recent trips logged in the ledger.</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}