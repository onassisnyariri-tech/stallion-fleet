import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
// 🚀 NEW: STICKY STATE ENGINE (Saves data to browser memory)
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn("Error reading localStorage", error);
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  }, [key, value]);

  return [value, setValue];
}
export default function TripProfitability({ companyId }) { 
  // --- LEDGER STATE (Keep as normal useState so it refreshes from the server) ---
  const [tripsLedger, setTripsLedger] = useState([]);
  const [selectedTripId, setSelectedTripId] = useLocalStorage('stc-selectedTripId', null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);

  // ==========================================
  // 🚀 NEW: STICKY FORM STATE 
  // (We use unique 'stc-' keys to save each field to the browser)
  // ==========================================
  
 // Trip Meta
  const [tripRef, setTripRef] = useLocalStorage('stc-tripRef', '');
  const [routeDirection, setRouteDirection] = useLocalStorage('stc-routeDirection', 'ROUND_TRIP'); // 🚀 NEW: Stops the crash!
  const [distanceKm, setDistanceKm] = useLocalStorage('stc-distanceKm', '');
  const [revenue, setRevenue] = useLocalStorage('stc-revenue', '');

  // Fuel Segments (Litres)
  const [fuelToLoad, setFuelToLoad] = useLocalStorage('stc-fuelToLoad', '');
  const [fuelToDepot, setFuelToDepot] = useLocalStorage('stc-fuelToDepot', '');
  const [fuelToBorder, setFuelToBorder] = useLocalStorage('stc-fuelToBorder', '');
  const [fuelToOffload, setFuelToOffload] = useLocalStorage('stc-fuelToOffload', '');
  const [fuelReturnBorder, setFuelReturnBorder] = useLocalStorage('stc-fuelReturnBorder', '');
  const [fuelReturnDepot, setFuelReturnDepot] = useLocalStorage('stc-fuelReturnDepot', '');
  const [fuelPrice, setFuelPrice] = useLocalStorage('stc-fuelPrice', '');

  // Fixed & Variable Costs
  const [costTolls, setCostTolls] = useLocalStorage('stc-costTolls', '');
  const [costBorder, setCostBorder] = useLocalStorage('stc-costBorder', '');
  const [costMaintenance, setCostMaintenance] = useLocalStorage('stc-costMaintenance', '');
  const [costTyres, setCostTyres] = useLocalStorage('stc-costTyres', '');
  const [costDriver, setCostDriver] = useLocalStorage('stc-costDriver', '');
  const [costOverhead, setCostOverhead] = useLocalStorage('stc-costOverhead', '');
  // 🚀 UPGRADED: FLEET LIST STATE (Superlink Ready)
  const [vehicles, setVehicles] = useState([]);
  const [powerUnitId, setPowerUnitId] = useLocalStorage('stc-powerUnitId', '');
  const [trailer1Id, setTrailer1Id] = useLocalStorage('stc-trailer1', '');
  const [trailer2Id, setTrailer2Id] = useLocalStorage('stc-trailer2', '');

  // Automation State
  const [expectedMonthlyTrips, setExpectedMonthlyTrips] = useLocalStorage('stc-expectedTrips', '2');
  
  // UI State (Keep normal so buttons reset properly)
  const [isSaving, setIsSaving] = useState(false);
  // --- FETCH LEDGER DATA ---
  const fetchLedger = async () => {
    setIsLoadingLedger(true);
    
    // 1. Fetch the recent trips
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(20); // Get recent 20 trips
    
    if (data) setTripsLedger(data);

    // 🚀 2. NEW: Fetch the fleet for the dropdowns
    const { data: fleetData } = await supabase
      .from('vehicles')
      .select('*')
      .eq('company_id', companyId)
      .order('fleet_number', { ascending: true }); // Alphabetical order!
      
    if (fleetData) setVehicles(fleetData);

    setIsLoadingLedger(false);
  };
// Helper to separate trailers from horses
  const isTowedUnit = (vehicle) => {
    const t = (vehicle?.asset_type || vehicle?.type || '').toLowerCase();
    return t.includes('deck') || t.includes('link') || t.includes('trailer');
  };
  useEffect(() => {
    if (companyId) fetchLedger();
  }, [companyId]);
  // --- LOAD A DRAFT INTO THE CALCULATOR ---
  const loadTripIntoForm = (trip) => {
    setSelectedTripId(trip.id);
    setTripRef(trip.trip_ref || '');
    
    // 🚀 NEW: POPULATE THE DROPDOWNS FROM THE DB
    setPowerUnitId(trip.power_unit_id || '');
    setTrailer1Id(trip.trailer_id || '');
    setTrailer2Id(trip.trailer_2_id || '');
    
    setDistanceKm(trip.distance_km || '');
    setRevenue(trip.revenue || '');
    setFuelToLoad(trip.fuel_to_load || '');
    setFuelToDepot(trip.fuel_to_depot || '');
    setFuelToBorder(trip.fuel_to_border || '');
    setFuelToOffload(trip.fuel_to_offload || '');
    setFuelReturnBorder(trip.fuel_return_border || '');
    setFuelReturnDepot(trip.fuel_return_depot || '');
    setFuelPrice(trip.fuel_price_per_litre || '');
    setCostTolls(trip.cost_tolls || '');
    setCostBorder(trip.cost_border || '');
    setCostMaintenance(trip.cost_maintenance || '');
    setCostTyres(trip.cost_tyres || '');
    setCostDriver(trip.cost_driver || '');
    setCostOverhead(trip.cost_overhead || '');
  };

  const clearForm = () => {
    setSelectedTripId(null);
    setTripRef(''); setDistanceKm(''); setRevenue('');
    setFuelToLoad(''); setFuelToDepot(''); setFuelToBorder(''); setFuelToOffload(''); setFuelReturnBorder(''); setFuelReturnDepot(''); setFuelPrice('');
    setCostTolls(''); setCostBorder(''); setCostMaintenance(''); setCostTyres(''); setCostDriver(''); setCostOverhead('');setPowerUnitId('');
    setTrailer1Id('');
    setTrailer2Id('');
  };

  // --- AUTOMATED MATH ENGINE ---
  const safeNum = (val) => parseFloat(val) || 0;

  const totalFuelLitres =
    safeNum(fuelToLoad) + safeNum(fuelToDepot) + safeNum(fuelToBorder) +
    safeNum(fuelToOffload) + safeNum(fuelReturnBorder) + safeNum(fuelReturnDepot);

  const totalFuelCost = totalFuelLitres * safeNum(fuelPrice);

  const totalOtherCosts =
    safeNum(costTolls) + safeNum(costBorder) + safeNum(costMaintenance) +
    safeNum(costTyres) + safeNum(costDriver) + safeNum(costOverhead);

  const totalCosts = totalFuelCost + totalOtherCosts;
  const netProfit = safeNum(revenue) - totalCosts;

  let profitMargin = 0;
  if (safeNum(revenue) > 0) {
    profitMargin = ((netProfit / safeNum(revenue)) * 100).toFixed(2);
  }

// --- THE AUTO-CALCULATOR ---
  const handleAutoCalculateCosts = () => {
    if (!distanceKm) return alert("Please enter the Total Distance (km) first.");
    
    const dist = safeNum(distanceKm);
    const tripsPerMonth = safeNum(expectedMonthlyTrips) || 2; 

    // 1. Maintenance
    const calcMaint = dist * 1.5;

    // 🚀 2. DYNAMIC TYRE APPORTIONMENT (Counts the axles)
    let activeTyreCount = 10; // Bobtail default
    if (trailer1Id) activeTyreCount += 8; // Add Link 1
    if (trailer2Id) activeTyreCount += 8; // Add Link 2

    const costPerTyrePerKm = 0.12; 
    const calcTyres = dist * (activeTyreCount * costPerTyrePerKm);

    // 🚀 3. PAYROLL ENGINE (Round Trip vs Deadhead)
    const baseSalaryApportionment = 10000 / tripsPerMonth;
    const tripCommission = routeDirection === 'DEADHEAD' ? 0 : 3000;
    const calcDriver = baseSalaryApportionment + tripCommission;

    // 4. Overhead 
    const calcOverhead = (23200 / tripsPerMonth);

    // Push to screen
    setCostMaintenance(calcMaint.toFixed(2));
    setCostTyres(calcTyres.toFixed(2));
    setCostDriver(calcDriver.toFixed(2));
    setCostOverhead(calcOverhead.toFixed(2));
  };

 // --- SAVE TO SUPABASE (SUPERLINK READY) ---
  const handleSaveTrip = async () => {
    setIsSaving(true);
    const newTripDist = parseFloat(distanceKm) || 0;
    let mileageDelta = newTripDist; 

    if (selectedTripId) {
      const { data: oldTrip } = await supabase.from('trips').select('distance_km').eq('id', selectedTripId).single();
      const oldDist = oldTrip?.distance_km ? parseFloat(oldTrip.distance_km) : 0;
      mileageDelta = newTripDist - oldDist; 
    }

    const payload = {
      company_id: companyId, 
      trip_ref: tripRef,
      
      // 🚀 UPDATED: SAVING BOTH TRAILERS TO SUPABASE
      power_unit_id: powerUnitId || null,
      trailer_id: trailer1Id || null,
      trailer_2_id: trailer2Id || null,
      
      distance_km: newTripDist,
      revenue: safeNum(revenue),
      fuel_to_load: safeNum(fuelToLoad),
      fuel_to_depot: safeNum(fuelToDepot),
      fuel_to_border: safeNum(fuelToBorder),
      fuel_to_offload: safeNum(fuelToOffload),
      fuel_return_border: safeNum(fuelReturnBorder),
      fuel_return_depot: safeNum(fuelReturnDepot),
      fuel_price_per_litre: safeNum(fuelPrice),
      cost_tolls: safeNum(costTolls),
      cost_border: safeNum(costBorder),
      cost_maintenance: safeNum(costMaintenance),
      cost_tyres: safeNum(costTyres),
      cost_driver: safeNum(costDriver),
      cost_overhead: safeNum(costOverhead)
    };

    if (selectedTripId) {
      await supabase.from('trips').update(payload).eq('id', selectedTripId);
      alert("Trip Reconciled & Updated!");
    } else {
      await supabase.from('trips').insert([payload]);
      alert("New Trip Logged!");
    }
    
    // 🚀 UPDATED: VIRTUAL MILEAGE ENGINE FOR ALL 3 UNITS
    if (mileageDelta !== 0 && (powerUnitId || trailer1Id || trailer2Id)) {
      // Create a clean array of any vehicle IDs that were actually selected
      const activeVehicles = [powerUnitId, trailer1Id, trailer2Id].filter(Boolean);

      const { data: mountedTyres } = await supabase
        .from('tyres')
        .select('id, virtual_mileage')
        .in('vehicle_id', activeVehicles)
        .eq('status', 'ACTIVE')
        .eq('company_id', companyId);

      if (mountedTyres && mountedTyres.length > 0) {
        await Promise.all(mountedTyres.map(async (tyre) => {
          const newMileage = Math.max(0, (Number(tyre.virtual_mileage) || 0) + mileageDelta);
          return supabase.from('tyres').update({ virtual_mileage: newMileage }).eq('id', tyre.id);
        }));
      }
    }
    
    clearForm();
    fetchLedger(); 
    setIsSaving(false);
  };
// --- DELETE DRAFT / DEADHEAD TRIP ---
  const handleDeleteTrip = async () => {
    if (!selectedTripId) return;
    
    if (!window.confirm("Are you sure you want to delete this trip permanently?\n\nThis is usually done to clear empty yard moves (deadheading) or accidental drafts.")) return;

    setIsSaving(true); 
    const { error } = await supabase.from('trips').delete().eq('id', selectedTripId).eq('company_id', companyId);

    if (error) {
      setIsSaving(false);
      return alert("Database Error: " + error.message);
    }

    clearForm();
    fetchLedger(); // Refresh the sidebar
    setIsSaving(false);
  };
  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ==========================================
            COLUMN 1: THE TRIP LEDGER (SIDEBAR)
        ========================================== */}
        <div className="lg:col-span-1 bg-gray-900 rounded-xl shadow-xl border border-gray-700 p-4 h-200 overflow-y-auto">
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
            <h2 className="text-white font-black uppercase tracking-widest text-sm">Trip Ledger</h2>
            <button onClick={clearForm} className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase">+ New</button>
          </div>
          
          {isLoadingLedger ? (
            <p className="text-gray-500 text-center text-xs font-bold animate-pulse">Syncing Database...</p>
          ) : (
            <div className="space-y-2">
              {tripsLedger.map(trip => (
                <button 
                  key={trip.id}
                  onClick={() => loadTripIntoForm(trip)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${selectedTripId === trip.id ? 'border-indigo-500 bg-gray-800' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-white font-bold text-sm truncate">{trip.trip_ref}</span>
                    {safeNum(trip.revenue) === 0 ? (
                      <span className="bg-yellow-900/50 text-yellow-500 border border-yellow-500 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Draft</span>
                    ) : (
                      <span className="bg-green-900/50 text-green-500 border border-green-500 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Reconciled</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs mt-1 font-mono">{trip.distance_km} km</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ==========================================
            COLUMNS 2-4: THE CALCULATOR 
        ========================================== */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* REAL-TIME PROFITABILITY SCORECARD */}
          <div className="bg-gray-800 rounded-xl shadow-xl p-6 border-b-4 border-indigo-500">
            <h2 className="text-white font-black text-xl mb-6 tracking-tight">
              {selectedTripId ? `Reconciling: ${tripRef}` : 'New Trip Calculator'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Revenue</p>
                <p className="text-2xl font-black text-white">R {safeNum(revenue).toLocaleString()}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Trip Costs</p>
                <p className="text-2xl font-black text-red-400">R {totalCosts.toLocaleString()}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Net Profit</p>
                <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                  R {netProfit.toLocaleString()}
                </p>
              </div>
              <div className={`p-4 rounded-lg flex flex-col justify-center items-center border-2 ${profitMargin >= 15 ? 'bg-green-900/30 border-green-500' : profitMargin > 0 ? 'bg-yellow-900/30 border-yellow-500' : 'bg-red-900/30 border-red-500'}`}>
                <p className="text-gray-300 text-xs font-bold uppercase tracking-widest mb-1">Margin</p>
                <p className={`text-4xl font-black ${profitMargin >= 15 ? 'text-green-400' : profitMargin > 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                  {profitMargin}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* TRIP META & REVENUE */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-black text-gray-800 border-b border-gray-200 pb-2 mb-4">Trip Logistics</h3>
              
              {/* 🚀 UPGRADED: ALIGNED, SCALED, & HOVER-READY DROPDOWNS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 items-end">
                <div className="w-full flex flex-col justify-end">
                  <label 
                    title="1. Power Unit *" 
                    className="block text-[10px] md:text-xs font-black text-indigo-800 uppercase tracking-widest mb-1.5 truncate"
                  >
                    1. Power Unit *
                  </label>
                  <select 
                    value={powerUnitId} 
                    onChange={(e) => setPowerUnitId(e.target.value)} 
                    title={powerUnitId ? vehicles.find(v => String(v.id) === String(powerUnitId))?.fleet_number : "Select Tractor..."}
                    className="w-full bg-white border-2 border-indigo-200 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-indigo-600 outline-none transition-colors truncate shadow-sm cursor-pointer"
                    required
                  >
                    <option value="" title="Select Tractor...">Select Tractor...</option>
                    {vehicles.filter(v => !isTowedUnit(v)).map(v => (
                      <option key={v.id} value={v.id} title={v.fleet_number}>{v.fleet_number}</option>
                    ))}
                  </select>
                </div>
                
                <div className="w-full flex flex-col justify-end">
                  <label 
                    title="2. Link 1 (A-Trailer)" 
                    className="block text-[10px] md:text-xs font-black text-indigo-800 uppercase tracking-widest mb-1.5 truncate"
                  >
                    2. Link 1 (A-Trailer)
                  </label>
                  <select 
                    value={trailer1Id} 
                    onChange={(e) => setTrailer1Id(e.target.value)} 
                    title={trailer1Id ? vehicles.find(v => String(v.id) === String(trailer1Id))?.fleet_number : "None / Bobtail"}
                    className="w-full bg-white border-2 border-indigo-200 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-indigo-600 outline-none transition-colors truncate shadow-sm cursor-pointer"
                  >
                    <option value="" title="None / Bobtail">None / Bobtail</option>
                    {vehicles.filter(v => isTowedUnit(v)).map(v => (
                      <option key={v.id} value={v.id} title={v.fleet_number}>{v.fleet_number}</option>
                    ))}
                  </select>
                </div>
                
                <div className="w-full flex flex-col justify-end">
                  <label 
                    title="3. Link 2 (B-Trailer)" 
                    className="block text-[10px] md:text-xs font-black text-indigo-800 uppercase tracking-widest mb-1.5 truncate"
                  >
                    3. Link 2 (B-Trailer)
                  </label>
                  <select 
                    value={trailer2Id} 
                    onChange={(e) => setTrailer2Id(e.target.value)} 
                    title={trailer2Id ? vehicles.find(v => String(v.id) === String(trailer2Id))?.fleet_number : "No Rear Link"}
                    className="w-full bg-white border-2 border-indigo-200 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-indigo-600 outline-none transition-colors truncate shadow-sm cursor-pointer"
                  >
                    <option value="" title="No Rear Link">No Rear Link</option>
                    {vehicles.filter(v => isTowedUnit(v) && String(v.id) !== String(trailer1Id)).map(v => (
                      <option key={v.id} value={v.id} title={v.fleet_number}>{v.fleet_number}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* 🚀 NEW: ROUND TRIP VS DEADHEAD TOGGLE */}
              <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <label className="block text-[10px] md:text-xs font-black text-blue-800 uppercase tracking-widest mb-1.5">
                  Trip Type & Driver Commission
                </label>
                <select 
                  value={routeDirection} 
                  onChange={(e) => setRouteDirection(e.target.value)} 
                  className="w-full bg-white border-2 border-blue-200 rounded-lg p-2.5 text-sm font-bold text-gray-800 focus:border-blue-600 outline-none transition-colors shadow-sm cursor-pointer"
                >
                  <option value="ROUND_TRIP">🔄 Loaded Round Trip (R3,000 Comm.)</option>
                  <option value="DEADHEAD">🪹 Empty Reposition / Deadhead (No Comm.)</option>
                </select>
              </div>

              {/* ORIGINAL INPUTS */}
              <div className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Trip Reference</label><input type="text" value={tripRef} onChange={(e) => setTripRef(e.target.value)} placeholder="e.g. TRP-104" className="w-full p-2 border rounded text-sm outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Total Distance (km)</label><input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Fuel Price (per Litre)</label><input type="number" value={fuelPrice} onChange={(e) => setFuelPrice(e.target.value)} placeholder="R" className="w-full p-2 border rounded text-sm outline-none focus:border-indigo-500" /></div>
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-black text-green-700 uppercase tracking-widest mb-1">Gross Trip Revenue</label>
                  <input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Total ZAR Billed" className="w-full p-3 border-2 border-green-200 bg-green-50 rounded text-lg font-bold outline-none focus:border-green-500" />
                </div>
              </div>
            </div>

            {/* THE 6 FUEL SEGMENTS */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-end border-b border-gray-200 pb-2 mb-4">
                <h3 className="font-black text-gray-800">Fuel Burn Segments</h3>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">{totalFuelLitres} Total Litres</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</span><div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase">To Loading Point</label><input type="number" value={fuelToLoad} onChange={(e) => setFuelToLoad(e.target.value)} placeholder="Litres" className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" /></div></div>
                <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</span><div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase">To Depot</label><input type="number" value={fuelToDepot} onChange={(e) => setFuelToDepot(e.target.value)} placeholder="Litres" className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" /></div></div>
                <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">3</span><div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase">To Border Post</label><input type="number" value={fuelToBorder} onChange={(e) => setFuelToBorder(e.target.value)} placeholder="Litres" className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" /></div></div>
                <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">4</span><div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase">To Offloading Point</label><input type="number" value={fuelToOffload} onChange={(e) => setFuelToOffload(e.target.value)} placeholder="Litres" className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" /></div></div>
                <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">5</span><div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase">Back to Border</label><input type="number" value={fuelReturnBorder} onChange={(e) => setFuelReturnBorder(e.target.value)} placeholder="Litres" className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" /></div></div>
                <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">6</span><div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase">Back to Depot</label><input type="number" value={fuelReturnDepot} onChange={(e) => setFuelReturnDepot(e.target.value)} placeholder="Litres" className="w-full p-2 border rounded text-sm outline-none focus:border-blue-500" /></div></div>
              </div>
            </div>

            {/* OVERHEAD & OPERATIONAL COSTS */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-end border-b border-gray-200 pb-2 mb-4">
                <h3 className="font-black text-gray-800">Operational Deductions</h3>
                <span className="text-xs font-bold bg-red-50 text-red-600 px-2 py-1 rounded">R {totalOtherCosts.toLocaleString()}</span>
              </div>
              
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded mb-4 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Est. Trips/Month</label>
                  <input type="number" value={expectedMonthlyTrips} onChange={(e) => setExpectedMonthlyTrips(e.target.value)} className="w-full p-1.5 border border-indigo-200 rounded text-sm" />
                </div>
                <button onClick={handleAutoCalculateCosts} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-700 shadow-sm active:scale-95">
                  Auto-Fill Rates
                </button>
              </div>

              <div className="space-y-3">
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Toll Fees</label><input type="number" value={costTolls} onChange={(e) => setCostTolls(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-red-400" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Border Crossing / Clearing</label><input type="number" value={costBorder} onChange={(e) => setCostBorder(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-red-400" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Truck Maintenance</label><input type="number" value={costMaintenance} onChange={(e) => setCostMaintenance(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-red-400" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Tyre Wear Apportionment</label><input type="number" value={costTyres} onChange={(e) => setCostTyres(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-red-400" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Driver Salary & Allowance</label><input type="number" value={costDriver} onChange={(e) => setCostDriver(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-red-400" /></div>
                <div><label className="block text-xs font-bold text-gray-500 mb-1">Tracking & Rent Overhead</label><input type="number" value={costOverhead} onChange={(e) => setCostOverhead(e.target.value)} className="w-full p-2 border rounded text-sm outline-none focus:border-red-400" /></div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200">
            {/* ONLY SHOW DELETE BUTTON IF A DRAFT/TRIP IS SELECTED */}
            {selectedTripId ? (
              <button
                onClick={handleDeleteTrip}
                disabled={isSaving}
                className="text-red-500 hover:text-red-700 text-sm font-black uppercase tracking-widest px-4 py-3 border-2 border-red-200 bg-red-50 rounded-xl transition-colors hover:bg-red-100 disabled:opacity-50 active:scale-95"
              >
                Delete Draft
              </button>
            ) : (
              <div></div> /* Empty div to push the save button to the right */
            )}

            <button
              onClick={handleSaveTrip}
              disabled={!tripRef || isSaving}
              className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] active:scale-95 uppercase tracking-widest"
            >
              {isSaving ? 'Processing...' : selectedTripId ? 'Commit Reconciliation' : 'Log New Trip'}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}