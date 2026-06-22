import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from "./context/AuthContext.jsx";

export default function FleetAssets({ companyId }) {
  console.log("🚨 THE YARD COMPONENT HAS SUCCESSFULLY LOADED!");
  const { permissions } = useAuth();
  console.log("MY CURRENT PERMISSIONS ARE:", permissions);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [mountedTyres, setMountedTyres] = useState([]);
  const [sideFilter, setSideFilter] = useState('ALL'); 
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [newAsset, setNewAsset] = useState({ fleet_number: '', asset_type: 'Power Unit' });
  // 🚀 NEW: SEARCH & FILTER STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL'); // 'ALL', 'POWER', 'TRAILER'
  // ==========================================
  // 🚀 NEW: SCRAP REASON STATE FOR YARD
  // ==========================================
  const [scrapTyreTarget, setScrapTyreTarget] = useState(null); // Holds the tyre being scrapped
  const [scrapReason, setScrapReason] = useState('');

  // Hook & Drop State
  const [isHooking, setIsHooking] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [availableTrailers, setAvailableTrailers] = useState([]);
  const [hookData, setHookData] = useState({ trailerId: '', trailer2Id: '', odometer: '', isSuperlink: false });
  const [dropOdometer, setDropOdometer] = useState('');
  const [tripResult, setTripResult] = useState(null); // <-- ADDED for math result
  const [isProcessingDrop, setIsProcessingDrop] = useState(false); // <-- ADDED for button loading
  const [isClosingTrip, setIsClosingTrip] = useState(false);
  const [tripOdometer, setTripOdometer] = useState('');
  const [isProcessingTrip, setIsProcessingTrip] = useState(false);
  // Fuel State
  const [isLoggingFuel, setIsLoggingFuel] = useState(false);
  const [fuelData, setFuelData] = useState({ volume: '', cost: '' });

  // Inspection & Global State
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]); 
  const [walkaroundOdo, setWalkaroundOdo] = useState(''); 
  const [tyreInputs, setTyreInputs] = useState({});
  const [loggedStatus, setLoggedStatus] = useState([]);

  // History State
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [tyreHistories, setTyreHistories] = useState({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
// 🚀 NEW: REAL-TIME FILTER ENGINE
  const filteredAssets = assets.filter(asset => {
    // 1. Check if it matches the search box (by fleet number or reg plate)
    const matchesSearch = 
      (asset.fleet_number && asset.fleet_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (asset.registration && asset.registration.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Check if it matches the Category Tabs
    const isTowed = (asset.asset_type || asset.type || '').toLowerCase().includes('trailer');
    const matchesCategory = 
      assetFilter === 'ALL' ? true :
      assetFilter === 'TRAILER' ? isTowed :
      !isTowed; // If 'POWER', it must NOT be a trailer

    return matchesSearch && matchesCategory;
  });
  // ==========================================
  // 🚀 NEW: THE "ALREADY HOOKED" BLACKLIST
  // ==========================================
  // 1. Scan the whole fleet and compile an array of IDs for every trailer currently attached to a truck
  const currentlyHookedTrailerIds = assets.reduce((acc, asset) => {
    if (asset.hooked_trailer_id) acc.push(asset.hooked_trailer_id);
    if (asset.hooked_trailer_2_id) acc.push(asset.hooked_trailer_2_id);
    return acc;
  }, []);

  // 2. Define 'hookableTrailers' to ONLY include trailers that are NOT in the blacklist
  const hookableTrailers = assets.filter(asset => {
    const isTowed = (asset.asset_type || asset.type || '').toLowerCase().includes('trailer');
    return isTowed && !currentlyHookedTrailerIds.includes(asset.id);
  });
  const fetchFleet = async () => {
    if (!companyId) return; // SaaS Safety Check
    const { data } = await supabase.from('vehicles').select('*').eq('company_id', companyId);
    if (data) {
      const sortedAssets = data.sort((a, b) => {
        if (!a.fleet_number || !b.fleet_number) return 0;
        return a.fleet_number.localeCompare(b.fleet_number, undefined, { numeric: true, sensitivity: 'base' });
      });
      setAssets(sortedAssets);
    } else {
      setAssets([]);
    }
  };
// // 🚀 NEW: INDEPENDENT ODOMETER UPDATE (Corrected Column Name)
  const handleQuickOdometerUpdate = async (vehicleId, newOdometerValue) => {
    if (!newOdometerValue) return;

    // 1. Optimistic UI Update (Instantly changes on screen)
    setAssets(prevAssets => 
      prevAssets.map(v => 
        v.id === vehicleId ? { ...v, current_odo: newOdometerValue } : v
      )
    );

    // 2. Background Database Update
    const { error } = await supabase
      .from('vehicles')
      .update({ current_odo: newOdometerValue }) // 🚀 EXACT MATCH NOW!
      .eq('id', vehicleId);

    if (error) {
      alert("Failed to update odometer: " + error.message);
    }
  };

  useEffect(() => {
    fetchFleet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);
// ==========================================
  // 🚀 NEW: EXECUTE SCRAP FROM YARD WALKABOUT
  // ==========================================
  const executeYardScrapTyre = async () => {
    if (!scrapReason.trim()) return alert("You must provide a reason for scrapping this casing.");

    const tyre = scrapTyreTarget.tyre;
    
    // 1. Update the database to SCRAPPED, stripping it from the vehicle completely
    const { error } = await supabase.from('tyres').update({ 
      status: 'SCRAPPED', 
      vehicle_id: null,
      position: null 
    }).eq('id', tyre.id).eq('company_id', companyId);

    if (error) return alert("Database Error: " + error.message);

    // 2. Log the exact reason to the history passport (Using the function available in your app)
    // If your yard app calls it logHistory, change this name to match your local logging function
    await supabase.from('tyre_history').insert([{ 
      company_id: companyId,
      tyre_id: tyre.id, 
      action: 'SCRAPPED', 
      details: `Yard Walkaround Scrap. Reason: ${scrapReason}`, 
      logged_tread: tyre.tread_depth || null, 
      logged_psi: tyre.current_psi || null 
    }]);

    // 3. Clean up UI states
    setScrapTyreTarget(null);
    setScrapReason('');
    
    // Call whatever function refreshes your current asset's tyres (usually loadAssetTyres or fetchFleet)
    if (selectedAsset) loadAssetTyres(selectedAsset); 
  };
  const loadAssetTyres = async (asset) => {
    setSelectedAsset(asset);
    setSideFilter('ALL'); 
    setIsHooking(false);
    setIsDropping(false);
    setIsLoggingFuel(false);
    setExpandedHistoryId(null); 
    
    setWalkaroundOdo(asset.total_mileage ? asset.total_mileage.toString() : '0');
    
    const { data } = await supabase
      .from('tyres')
      .select('*')
      .eq('company_id', companyId) // SaaS Lock
      .eq('vehicle_id', asset.id)
      .order('id', { ascending: true }); 
      
    setMountedTyres(data || []);
    setTyreInputs({});
  };

  const clearSelection = () => setSelectedAsset(null);

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!newAsset.fleet_number.trim()) return;
    const formattedFleetNumber = newAsset.fleet_number.trim().toUpperCase();

    const { error } = await supabase
      .from('vehicles')
      .insert([{ 
        company_id: companyId, // SaaS Lock
        fleet_number: formattedFleetNumber,
        asset_type: newAsset.asset_type,
        total_mileage: 0
      }]);

    if (!error) {
      setNewAsset({ fleet_number: '', asset_type: 'Power Unit' });
      setIsAddingAsset(false);
      await fetchFleet(); 
    }
  };

  const startHook = () => {
    const trailers = assets.filter(a => a.asset_type === 'Trailer');
    setAvailableTrailers(trailers);
    setIsHooking(true);
  };

  const executeHook = async () => {
    if (!hookData.trailerId || !hookData.odometer) return alert("Select a trailer and enter Odometer.");
    if (hookData.isSuperlink && !hookData.trailer2Id) return alert("Please select the Rear Trailer for the Superlink.");

    const { error } = await supabase.from('vehicles').update({
      hooked_trailer_id: hookData.trailerId,
      hooked_trailer_2_id: hookData.isSuperlink ? hookData.trailer2Id : null,
      hook_odometer: parseFloat(hookData.odometer),
      total_mileage: parseFloat(hookData.odometer) 
    }).eq('id', selectedAsset.id).eq('company_id', companyId); // SaaS Lock

    if (error) return alert(`DATABASE ERROR: Could not save hook. \n\nDetails: ${error.message}`);

    setIsHooking(false);
    setHookData({ trailerId: '', trailer2Id: '', odometer: '', isSuperlink: false });
    await fetchFleet();
    
    const updatedTruck = assets.find(a => a.id === selectedAsset.id);
    setSelectedAsset({
      ...updatedTruck, 
      hooked_trailer_id: hookData.trailerId, 
      hooked_trailer_2_id: hookData.isSuperlink ? hookData.trailer2Id : null,
      hook_odometer: hookData.odometer
    });
    setWalkaroundOdo(hookData.odometer); 
  };

  const executeDrop = async () => {
    if (!dropOdometer) return alert("Enter the drop Odometer reading.");
    setIsProcessingDrop(true);

    const startOdo = parseFloat(selectedAsset.hook_odometer || 0);
    const endOdo = parseFloat(dropOdometer);
    const tripDistance = endOdo - startOdo;

    if (tripDistance < 0) {
      setIsProcessingDrop(false);
      return alert("Drop Odometer cannot be less than Hook Odometer!");
    }

    // ==========================================
    // 🚀 NEW: PERMANENT TRIP LEDGER INSERT
    // ==========================================
    const { error: tripError } = await supabase.from('trips').insert([{
      company_id: companyId,
      distance_km: tripDistance,
      trip_ref: `DROP-${selectedAsset.fleet_number}-${new Date().toISOString().split('T')[0]}`,
      // Setting financial defaults to 0 so your math components don't break later
      revenue: 0, cost_tolls: 0, cost_border: 0, cost_maintenance: 0, 
      cost_tyres: 0, cost_driver: 0, cost_overhead: 0,
      fuel_to_load: 0, fuel_to_depot: 0, fuel_to_border: 0, fuel_to_offload: 0, 
      fuel_return_border: 0, fuel_return_depot: 0, fuel_price_per_litre: 0
    }]);

    if (tripError) {
      console.error("Ledger Sync Warning:", tripError.message);
      // We log it to the console rather than alerting the yard operator, 
      // as they don't need to be blocked by an admin ledger error.
    }
    // ==========================================

    const trailer1 = assets.find(a => a.id === selectedAsset.hooked_trailer_id);
    if (trailer1) {
      const newTrailerTotal = parseFloat(trailer1.total_mileage || 0) + tripDistance;
      await supabase.from('vehicles').update({ total_mileage: newTrailerTotal }).eq('id', trailer1.id).eq('company_id', companyId);
    }

    if (selectedAsset.hooked_trailer_2_id) {
      const trailer2 = assets.find(a => a.id === selectedAsset.hooked_trailer_2_id);
      if (trailer2) {
        const newTrailerTotal2 = parseFloat(trailer2.total_mileage || 0) + tripDistance;
        await supabase.from('vehicles').update({ total_mileage: newTrailerTotal2 }).eq('id', trailer2.id).eq('company_id', companyId);
      }
    }

    const { error } = await supabase.from('vehicles').update({ 
      hooked_trailer_id: null, 
      hooked_trailer_2_id: null, 
      hook_odometer: null, 
      total_mileage: endOdo 
    }).eq('id', selectedAsset.id).eq('company_id', companyId); 

    if (error) {
      setIsProcessingDrop(false);
      return alert(`DATABASE ERROR: Could not release kingpin. \n\nDetails: ${error.message}`);
    }

    // Show the success badge
    setTripResult(tripDistance);
    
    await fetchFleet();
    setSelectedAsset({...selectedAsset, hooked_trailer_id: null, hooked_trailer_2_id: null, hook_odometer: null});
    setWalkaroundOdo(endOdo.toString()); 

    // Auto-close the UI after 3.5 seconds
    setTimeout(() => {
      setIsDropping(false);
      setDropOdometer('');
      setTripResult(null);
      setIsProcessingDrop(false);
    }, 3500);
  };
const executeCloseTrip = async () => {
    if (!tripOdometer) return alert("Enter the ending Odometer reading.");
    setIsProcessingTrip(true);

    const startOdo = parseFloat(selectedAsset.hook_odometer || selectedAsset.total_mileage || 0);
    const endOdo = parseFloat(tripOdometer);
    const tripDistance = endOdo - startOdo;

    if (tripDistance <= 0) {
      setIsProcessingTrip(false);
      return alert("Ending Odometer must be greater than starting Odometer!");
    }

    // 1. Insert to Ledger
    const { error: tripError } = await supabase.from('trips').insert([{
      company_id: companyId,
      distance_km: tripDistance,
      trip_ref: `RTN-${selectedAsset.fleet_number}-${new Date().toISOString().split('T')[0]}`,
      revenue: 0, cost_tolls: 0, cost_border: 0, cost_maintenance: 0, 
      cost_tyres: 0, cost_driver: 0, cost_overhead: 0,
      fuel_to_load: 0, fuel_to_depot: 0, fuel_to_border: 0, fuel_to_offload: 0, 
      fuel_return_border: 0, fuel_return_depot: 0, fuel_price_per_litre: 0
    }]);

    // 2. Update the Trailers
    const trailer1 = assets.find(a => a.id === selectedAsset.hooked_trailer_id);
    if (trailer1) await supabase.from('vehicles').update({ total_mileage: parseFloat(trailer1.total_mileage || 0) + tripDistance }).eq('id', trailer1.id).eq('company_id', companyId);

    if (selectedAsset.hooked_trailer_2_id) {
      const trailer2 = assets.find(a => a.id === selectedAsset.hooked_trailer_2_id);
      if (trailer2) await supabase.from('vehicles').update({ total_mileage: parseFloat(trailer2.total_mileage || 0) + tripDistance }).eq('id', trailer2.id).eq('company_id', companyId);
    }

    // 3. Update the Truck (CRITICAL: We keep the trailers hooked, but advance the hook_odometer!)
    await supabase.from('vehicles').update({ 
      total_mileage: endOdo,
      hook_odometer: endOdo // <-- This is the magic reset!
    }).eq('id', selectedAsset.id).eq('company_id', companyId); 

    // Show the success badge using the same tripResult state
    setTripResult(tripDistance);
    
    await fetchFleet();
    setSelectedAsset({...selectedAsset, total_mileage: endOdo, hook_odometer: endOdo});
    setWalkaroundOdo(endOdo.toString()); 

    setTimeout(() => {
      setIsClosingTrip(false);
      setTripOdometer('');
      setTripResult(null);
      setIsProcessingTrip(false);
    }, 3500);
  };
  const executeFuelLog = async () => {
    if (!fuelData.volume) return alert("Please enter the fuel volume.");
    if (!walkaroundOdo) return alert("Please enter the Current Dash Odometer at the top of the screen before logging fuel.");

    const { error } = await supabase.from('fuel_logs').insert([{
      company_id: companyId, // SaaS Lock
      vehicle_id: selectedAsset.id,
      log_date: inspectionDate,
      odometer: parseFloat(walkaroundOdo),
      volume: parseFloat(fuelData.volume),
      cost: fuelData.cost ? parseFloat(fuelData.cost) : null
    }]);

    if (!error) {
      setIsLoggingFuel(false);
      setFuelData({ volume: '', cost: '' });
      await supabase.from('vehicles').update({ total_mileage: parseFloat(walkaroundOdo) }).eq('id', selectedAsset.id).eq('company_id', companyId);
      setSelectedAsset({...selectedAsset, total_mileage: parseFloat(walkaroundOdo)});
      alert("⛽ Fuel Logged Successfully!");
    } else {
      alert("Database Error: Could not save fuel log.");
    }
  };

  const handleTyreInput = (tyreId, field, value) => {
    setTyreInputs(prev => ({
      ...prev,
      [tyreId]: { ...prev[tyreId], [field]: value }
    }));
  };

  const submitInspection = async (tyre) => {
    const inputs = tyreInputs[tyre.id] || {};
    const finalTread = inputs.tread !== undefined && inputs.tread !== '' ? inputs.tread : tyre.tread_depth;
    const finalPsi = inputs.psi !== undefined && inputs.psi !== '' ? inputs.psi : tyre.current_psi;

    if (!finalTread) return alert(`Please enter a mandatory Tread Depth for ${tyre.serial_number}`);
    
    if (selectedAsset.asset_type === 'Power Unit' && !walkaroundOdo) {
      return alert(`Please enter the Current Dash Odometer at the top of the screen before logging inspections.`);
    }

    const odoToLog = walkaroundOdo ? parseFloat(walkaroundOdo) : 0;

    const { error: logError } = await supabase.from('tyre_inspections').insert([{
      company_id: companyId, // SaaS Lock
      tyre_id: tyre.id,
      inspection_date: inspectionDate,
      tread_depth: parseFloat(finalTread),
      psi: finalPsi ? parseFloat(finalPsi) : null,
      odometer: odoToLog 
    }]);

    const { error: historyError } = await supabase.from('tyre_history').insert([{
      company_id: companyId, // SaaS Lock
      tyre_id: tyre.id,
      action: 'INSPECTED',
      details: `Yard Walkaround Logged. Odo: ${odoToLog}km`,
      logged_tread: parseFloat(finalTread),
      logged_psi: finalPsi ? parseFloat(finalPsi) : null
    }]);

    const { error: tyreError } = await supabase.from('tyres').update({
      tread_depth: parseFloat(finalTread),
      current_psi: finalPsi ? parseFloat(finalPsi) : null
    }).eq('id', tyre.id).eq('company_id', companyId); // SaaS Lock

    let vehicleError = null;
    if (selectedAsset.asset_type === 'Power Unit') {
      const { error } = await supabase.from('vehicles').update({
        total_mileage: odoToLog
      }).eq('id', selectedAsset.id).eq('company_id', companyId); // SaaS Lock
      vehicleError = error;
    }

    if (logError || historyError || tyreError || vehicleError) {
      console.error("Errors:", logError, historyError, tyreError, vehicleError);
      return alert(`DATABASE ERROR:\n\n` +
        (logError ? `Inspections Table: ${logError.message}\n` : '') +
        (historyError ? `History Table: ${historyError.message}\n` : '') +
        (tyreError ? `Tyres Table: ${tyreError.message}\n` : '') +
        (vehicleError ? `Truck Table: ${vehicleError.message}` : '')
      );
    }

    setLoggedStatus(prev => [...prev, tyre.id]);
    if (expandedHistoryId === tyre.id) {
      setTyreHistories(prev => ({ ...prev, [tyre.id]: null }));
      toggleHistory(tyre.id); 
    }
    setTimeout(() => setLoggedStatus(prev => prev.filter(id => id !== tyre.id)), 2000);
    
    if (selectedAsset.asset_type === 'Power Unit') {
      setSelectedAsset({...selectedAsset, total_mileage: odoToLog});
    }
  };

  const toggleHistory = async (tyreId) => {
    if (expandedHistoryId === tyreId) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(tyreId);
    
    setIsLoadingHistory(true);
    const { data, error } = await supabase
      .from('tyre_inspections')
      .select('*')
      .eq('company_id', companyId) // SaaS Lock
      .eq('tyre_id', tyreId)
      .order('inspection_date', { ascending: false })
      .limit(5);

    if (!error) {
      setTyreHistories(prev => ({ ...prev, [tyreId]: data || [] }));
    }
    setIsLoadingHistory(false);
  };

  const handleTyreAction = async (tyre, destinationStatus) => {
    // 🚀 1. THE BULLETPROOF INTERCEPT FOR THE YARD
    const safeStatus = String(destinationStatus).trim().toUpperCase();

    if (safeStatus === 'SCRAPPED') {
      // Freezes the action, prevents the window.confirm, and opens our red modal!
      setScrapTyreTarget({ tyre });
      return; 
    }

    // 🚀 2. STANDARD YARD ACTION FLOW
    const isConfirmed = window.confirm(`WARNING: Remove tyre ${tyre.serial_number} from unit and send to ${safeStatus}?`);
    if (!isConfirmed) return;

    const { error: updateError } = await supabase.from('tyres').update({
      vehicle_id: null,
      position: null,
      status: safeStatus
    }).eq('id', tyre.id).eq('company_id', companyId); // SaaS Lock

    const { error: logError } = await supabase.from('tyre_history').insert([{
      company_id: companyId, // SaaS Lock
      tyre_id: tyre.id,
      action: 'UNMOUNTED',
      details: `Removed during Walkaround. Sent to: ${safeStatus}`,
      logged_tread: tyre.tread_depth,
      logged_psi: tyre.current_psi // FIX: Changed from tyre.psi to tyre.current_psi
    }]);

    if (!updateError) {
      setMountedTyres(prev => prev.filter(t => t.id !== tyre.id));
      alert(`Tyre successfully moved to ${safeStatus}!`);
    } else {
      alert("Database Error: Could not move tyre.");
    }
  };
  const displayTyres = mountedTyres.filter(t => {
    if (sideFilter === 'ALL') return true;
    if (!t.position || t.position.trim() === '') return true; 
    
    const pos = t.position.toLowerCase().trim();
    if (pos.includes('spare')) return true;

    if (sideFilter === 'LEFT') return /\b(left|driver|l|li|lo)\b/.test(pos);
    if (sideFilter === 'RIGHT') return /\b(right|passenger|r|ri|ro)\b/.test(pos);
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-20">
      <div className="bg-gray-800 p-6 border-b border-gray-700 shadow-md sticky top-0 z-20">
        <h1 className="text-2xl font-black tracking-widest text-white uppercase text-center">
          {selectedAsset ? selectedAsset.fleet_number : "YARD WALKAROUND"}
        </h1>
        
        {selectedAsset && (
          <button onClick={clearSelection} className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg border border-gray-600 shadow-sm active:scale-[0.98]">
            ← BACK TO FLEET
          </button>
        )}
      </div>

      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        
        {!selectedAsset ? (
          <div className="space-y-4">
            {!isAddingAsset ? (
              <button onClick={() => setIsAddingAsset(true)} className="w-full p-4 mb-4 bg-indigo-600 rounded-2xl font-black text-white text-lg tracking-wider shadow-lg active:scale-[0.98]">
                + ADD NEW ASSET
              </button>
            ) : (
              <div className="bg-gray-800 p-6 rounded-2xl border-2 border-indigo-500 mb-6 shadow-xl">
                <h2 className="text-indigo-400 font-black tracking-wider uppercase mb-4 text-center">Register Vehicle</h2>
                <form onSubmit={handleAddAsset} className="space-y-4">
                  <div>
                    <label className="block text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">Fleet Number</label>
                    <input type="text" value={newAsset.fleet_number} onChange={e => setNewAsset({...newAsset, fleet_number: e.target.value})} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-2xl font-black text-white uppercase focus:border-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">Asset Type</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setNewAsset({...newAsset, asset_type: 'Power Unit'})} className={`flex-1 py-4 rounded-xl font-black uppercase transition-colors border-2 ${newAsset.asset_type === 'Power Unit' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-900 border-gray-600 text-gray-500'}`}>Power Unit</button>
                      <button type="button" onClick={() => setNewAsset({...newAsset, asset_type: 'Trailer'})} className={`flex-1 py-4 rounded-xl font-black uppercase transition-colors border-2 ${newAsset.asset_type === 'Trailer' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-900 border-gray-600 text-gray-500'}`}>Trailer</button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-2 border-t border-gray-700">
                    <button type="button" onClick={() => setIsAddingAsset(false)} className="flex-1 py-4 bg-gray-700 text-white rounded-xl font-black uppercase active:bg-gray-600">Cancel</button>
                    <button type="submit" className="flex-2 py-4 bg-green-600 text-white rounded-xl font-black uppercase active:scale-[0.98]">Save Asset</button>
                  </div>
                </form>
              </div>
            )}

            {/* ==========================================
                🚀 STEP 3: SEARCH AND FILTER BAR 
            ========================================== */}
            <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 mt-2 mb-6 space-y-4 animate-fade-in">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 text-lg">⌕</span>
                </div>
                <input
                  type="text"
                  placeholder="Search by Fleet Number or Reg Plate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white font-bold placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white font-bold">✕</button>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAssetFilter('ALL')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-colors ${assetFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'}`}>All Fleet</button>
                <button onClick={() => setAssetFilter('POWER')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-colors ${assetFilter === 'POWER' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'}`}>Power</button>
                <button onClick={() => setAssetFilter('TRAILER')} className={`flex-1 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-colors ${assetFilter === 'TRAILER' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'}`}>Trailers</button>
              </div>
            </div>

            <p className="text-gray-400 font-bold uppercase tracking-wider text-sm mb-4">Select Asset to Inspect</p>
            
            {filteredAssets.length === 0 && (
              <p className="text-gray-500 text-center py-8 font-bold italic bg-gray-900 rounded-xl border border-gray-700">No assets match your search.</p>
            )}

            {/* ==========================================
                🚀 STEP 4: USING 'filteredAssets' INSTEAD OF 'assets' 
            ========================================== */}
            {filteredAssets.map(a => (
              <button key={a.id} onClick={() => loadAssetTyres(a)} className="w-full p-6 bg-gray-800 rounded-2xl border-2 border-gray-700 text-left active:border-indigo-500 flex justify-between items-center shadow-lg">
                <div className="flex flex-col">
                  <span className="text-3xl font-black text-white flex items-center gap-3">
                    {a.fleet_number} 
                    {a.hooked_trailer_id && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded border border-green-500/50">🔗 HOOKED</span>}
                  </span>
                  <span className="text-gray-500 font-bold text-sm uppercase tracking-wider mt-1">
                    {a.asset_type || 'Vehicle'} 
                    {a.total_mileage > 0 && ` • ${Number(a.total_mileage).toLocaleString()} km`}
                  </span>
                </div>
                <span className="text-3xl">👉</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 p-5 rounded-2xl border-2 border-gray-700 shadow-lg flex flex-col md:flex-row gap-4 justify-between items-center mt-4 mb-8">
              <div className="flex-1 w-full">
                <label className="block text-gray-400 font-black uppercase tracking-wider text-xs mb-2">Walkaround Date</label>
                <input 
                  type="date" 
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl p-3 text-white font-black text-lg focus:border-indigo-500 outline-none"
                />
              </div>
              
              <div className="flex-1 w-full">
                {selectedAsset.asset_type === 'Power Unit' ? (
                  <>
                    <label className="block text-indigo-400 font-black uppercase tracking-wider text-xs mb-2">Current Dash Odo (km) *</label>
                    
                    {/* 🚀 NEW: FLEX WRAPPER FOR INPUT + SAVE BUTTON */}
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={walkaroundOdo}
                        onChange={(e) => setWalkaroundOdo(e.target.value)}
                        placeholder="e.g. 150000"
                        className="w-full bg-gray-900 border-2 border-indigo-600 rounded-xl p-3 text-white font-black text-lg focus:border-indigo-400 outline-none shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                      />
                      <button 
                        onClick={() => {
                          // Fire the function using the state you already have!
                          handleQuickOdometerUpdate(selectedAsset.id, walkaroundOdo);
                          
                          // Quick green flash for visual success
                          const btn = document.getElementById('btn-odo-save');
                          btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
                          btn.classList.add('bg-green-600');
                          setTimeout(() => {
                            btn.classList.remove('bg-green-600');
                            btn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
                          }, 1000);
                        }}
                        id="btn-odo-save"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-colors shadow-lg active:scale-95 shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-gray-400 font-black uppercase tracking-wider text-xs mb-2">Trailer Virtual Mileage</label>
                    <input 
                      type="number" 
                      value={walkaroundOdo}
                      disabled
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl p-3 text-gray-500 font-black text-lg outline-none cursor-not-allowed"
                    />
                    <p className="text-[10px] text-gray-500 mt-2 uppercase font-bold tracking-wider">Calculated automatically on Drop</p>
                  </>
                )}
              </div>
            </div>

            {selectedAsset.asset_type === 'Power Unit' && (
              <>
                <div className="bg-gray-800 rounded-2xl border-2 border-gray-700 overflow-hidden shadow-xl p-5 mb-6">
                  <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">Fuel Management</h3>
                  {!isLoggingFuel ? (
                    <button 
  onClick={() => setIsLoggingFuel(true)} 
  disabled={!permissions?.canLogFuel}
  className={`w-full py-4 border rounded-xl font-black text-lg tracking-widest shadow-lg flex justify-center items-center gap-3 transition-all ${!permissions?.canLogFuel ? 'bg-gray-800 border-gray-700 text-gray-500 opacity-50 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 border-gray-500 text-white active:scale-[0.98]'}`}
>
  <span>⛽</span> LOG FUEL
</button>
                  ) : (
                    <div className="space-y-4">
                      <input type="number" placeholder="Volume (Liters)" value={fuelData.volume} onChange={(e) => setFuelData({...fuelData, volume: e.target.value})} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-xl font-black text-white focus:border-indigo-500" />
                      <input type="number" placeholder="Total Cost (Optional)" value={fuelData.cost} onChange={(e) => setFuelData({...fuelData, cost: e.target.value})} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-xl font-black text-white focus:border-indigo-500" />
                      <div className="flex gap-2 pt-2 border-t border-gray-700">
                        <button onClick={() => setIsLoggingFuel(false)} className="flex-1 bg-gray-700 py-3 rounded-xl font-black text-white">CANCEL</button>
                        <button onClick={executeFuelLog} className="flex-2 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-black text-white active:scale-[0.98]">SAVE FUEL LOG</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 rounded-2xl border-2 border-gray-700 overflow-hidden shadow-xl p-5 mb-8">
                  <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-4 border-b border-gray-700 pb-2">Dispatch & Routing</h3>
                  
                  {!selectedAsset.hooked_trailer_id && !isHooking && (
                    <button 
  onClick={startHook} 
  disabled={!permissions?.canHookTrailer}
  className={`w-full py-4 border rounded-xl font-black text-lg tracking-widest shadow-lg flex justify-center items-center gap-3 transition-all ${!permissions?.canHookTrailer ? 'bg-gray-800 border-gray-700 text-gray-500 opacity-50 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 border-gray-500 text-white active:scale-[0.98]'}`}
>
  <span>🔗</span> HOOK TRAILER
</button>
                  )}
                  
                  {isHooking && (
                    <div className="space-y-4">
                      <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-700">
                        <button onClick={() => setHookData({...hookData, isSuperlink: false})} className={`flex-1 py-3 text-sm font-black uppercase rounded-lg ${!hookData.isSuperlink ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-800'}`}>Single Trailer</button>
                        <button onClick={() => setHookData({...hookData, isSuperlink: true})} className={`flex-1 py-3 text-sm font-black uppercase rounded-lg ${hookData.isSuperlink ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-800'}`}>Superlink (2)</button>
                      </div>

                      <select onChange={(e) => setHookData({...hookData, trailerId: e.target.value})} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-lg font-bold text-white focus:border-indigo-500">
                        <option value="">{hookData.isSuperlink ? 'Select Front Link...' : 'Select Trailer...'}</option>
{hookableTrailers.map(t => <option key={t.id} value={t.id}>{t.fleet_number}</option>)}
                      </select>

                      {hookData.isSuperlink && (
                        <select onChange={(e) => setHookData({...hookData, trailer2Id: e.target.value})} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-lg font-bold text-white focus:border-indigo-500">
                          <option value="">Select Rear Trailer...</option>
{hookableTrailers.filter(t => t.id !== hookData.trailerId).map(t => <option key={t.id} value={t.id}>{t.fleet_number}</option>)}
                        </select>
                      )}

                      <input type="number" placeholder="Dash Odometer (km)" onChange={(e) => setHookData({...hookData, odometer: e.target.value})} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-xl font-black text-white focus:border-indigo-500" />
                      
                      <div className="flex gap-2 pt-2 border-t border-gray-700">
                        <button onClick={() => setIsHooking(false)} className="flex-1 bg-gray-700 py-3 rounded-xl font-black text-white">CANCEL</button>
                        <button onClick={executeHook} className="flex-2 bg-indigo-600 py-3 rounded-xl font-black text-white active:scale-[0.98]">LOCK KINGPIN</button>
                      </div>
                    </div>
                  )}

                  {selectedAsset.hooked_trailer_id && !isDropping && !isClosingTrip && (
  <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl flex flex-col items-center gap-3">
    <span className="text-green-400 font-black tracking-widest uppercase text-center">
      PULLING: {assets.find(a => a.id === selectedAsset.hooked_trailer_id)?.fleet_number}
      {selectedAsset.hooked_trailer_2_id && ` & ${assets.find(a => a.id === selectedAsset.hooked_trailer_2_id)?.fleet_number}`}
    </span>
    <span className="text-gray-400 text-sm">Last Trip Start: {selectedAsset.hook_odometer} km</span>
    
    {/* TWO OPTIONS: Keep Hooked vs Drop */}
    <div className="grid grid-cols-2 gap-2 w-full mt-2">
      <button onClick={() => setIsClosingTrip(true)} className="py-3 bg-indigo-600/20 border border-indigo-500/50 hover:bg-indigo-600 text-indigo-100 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest shadow-lg transition-colors active:scale-[0.98]">
        LOG ROUND TRIP
      </button>
      <button onClick={() => setIsDropping(true)} className="py-3 bg-red-600/20 border border-red-500/50 hover:bg-red-600 text-red-100 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest shadow-lg transition-colors active:scale-[0.98]">
        DROP TRAILER
      </button>
    </div>
  </div>
)}

                  {isDropping && (
  <div className="space-y-4 mt-4 border-t border-gray-700 pt-4 animate-fade-in">
    {tripResult !== null ? (
      // SUCCESS BADGE
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-green-900/50 rounded-full border-4 border-green-500 flex items-center justify-center mx-auto mb-3">
          <span className="text-green-500 text-2xl">✓</span>
        </div>
        <h4 className="text-green-400 font-black uppercase tracking-widest text-lg mb-1">Trailer Dropped</h4>
        <p className="text-white text-2xl font-mono font-bold bg-black/50 inline-block px-4 py-2 rounded-lg border border-gray-700">
          {tripResult.toLocaleString()} <span className="text-gray-500 text-xs">km trip</span>
        </p>
      </div>
    ) : (
      // INPUT FORM
      <>
        <p className="text-gray-300 font-bold text-sm">Enter Dash Odometer to calculate trailer trip mileage.</p>
        <input 
          type="number" 
          disabled={isProcessingDrop} 
          placeholder="Current Odometer (km)" 
          onChange={(e) => setDropOdometer(e.target.value)} 
          className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-xl font-black text-white focus:border-red-500 disabled:opacity-50" 
        />
        <div className="flex gap-2">
          <button onClick={() => setIsDropping(false)} disabled={isProcessingDrop} className="flex-1 bg-gray-700 py-3 rounded-xl font-black text-white disabled:opacity-50">CANCEL</button>
          <button 
            onClick={executeDrop} 
            disabled={isProcessingDrop} 
            className={`flex-2 py-3 rounded-xl font-black text-white shadow-lg transition-colors ${isProcessingDrop ? 'bg-red-800 text-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 active:scale-[0.98]'}`}
          >
            {isProcessingDrop ? 'CALCULATING...' : 'RELEASE KINGPIN'}
          </button>
        </div>
      </>
    )}
  </div>
)}
{isClosingTrip && (
  <div className="space-y-4 mt-4 border-t border-gray-700 pt-4 animate-fade-in">
    {tripResult !== null ? (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-indigo-900/50 rounded-full border-4 border-indigo-500 flex items-center justify-center mx-auto mb-3">
          <span className="text-indigo-500 text-2xl">✓</span>
        </div>
        <h4 className="text-indigo-400 font-black uppercase tracking-widest text-lg mb-1">Round Trip Logged</h4>
        <p className="text-white text-2xl font-mono font-bold bg-black/50 inline-block px-4 py-2 rounded-lg border border-gray-700">
          {tripResult.toLocaleString()} <span className="text-gray-500 text-xs">km trip</span>
        </p>
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-3">Trailer remains hooked for next load</p>
      </div>
    ) : (
      <>
        <p className="text-gray-300 font-bold text-sm">Enter Dash Odometer to calculate and log the Round Trip.</p>
        <input 
          type="number" 
          disabled={isProcessingTrip} 
          placeholder="Current Odometer (km)" 
          onChange={(e) => setTripOdometer(e.target.value)} 
          className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-14 px-4 text-xl font-black text-white focus:border-indigo-500 disabled:opacity-50" 
        />
        <div className="flex gap-2">
          <button onClick={() => setIsClosingTrip(false)} disabled={isProcessingTrip} className="flex-1 bg-gray-700 py-3 rounded-xl font-black text-white disabled:opacity-50">CANCEL</button>
          <button 
            onClick={executeCloseTrip} 
            disabled={isProcessingTrip} 
            className={`flex-2 py-3 rounded-xl font-black text-white shadow-lg transition-colors ${isProcessingTrip ? 'bg-indigo-800 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98]'}`}
          >
            {isProcessingTrip ? 'LOGGING...' : 'LOG ROUND TRIP'}
          </button>
        </div>
      </>
    )}
  </div>
)}
                </div>
              </>
            )}

            <div className="sticky top-27.5 z-10 bg-gray-900 pt-2 pb-4 border-t border-gray-800 mt-4">
              <div className="flex bg-gray-800 p-1.5 rounded-xl border border-gray-700 shadow-lg">
                <button onClick={() => setSideFilter('LEFT')} className={`flex-1 py-3 text-sm font-black uppercase rounded-lg ${sideFilter === 'LEFT' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>LEFT</button>
                <button onClick={() => setSideFilter('ALL')} className={`flex-1 py-3 text-sm font-black uppercase rounded-lg ${sideFilter === 'ALL' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>ALL</button>
                <button onClick={() => setSideFilter('RIGHT')} className={`flex-1 py-3 text-sm font-black uppercase rounded-lg ${sideFilter === 'RIGHT' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>RIGHT</button>
              </div>
            </div>

            {displayTyres.map((t, index) => (
  <div key={t.id} className="bg-gray-800 rounded-2xl border-2 border-gray-700 overflow-hidden shadow-xl mb-4">
                <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                  <span className="text-indigo-400 font-black text-xl uppercase">{t.position ? t.position : `TYRE #${index + 1}`}</span>
                  <span className="text-gray-400 font-bold text-sm bg-gray-800 px-3 py-1 rounded-full border border-gray-700">SN: {t.serial_number}</span>
                </div>
                <div className="p-5 space-y-5">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-gray-400 font-bold text-xs uppercase mb-2">Tread (mm) *</label>
                      <input type="number" defaultValue={t.tread_depth} onChange={(e) => handleTyreInput(t.id, 'tread', e.target.value)} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-16 text-center text-3xl font-black text-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-gray-400 font-bold text-xs uppercase mb-2">PSI (Opt)</label>
                      <input type="number" defaultValue={t.current_psi} onChange={(e) => handleTyreInput(t.id, 'psi', e.target.value)} className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl h-16 text-center text-3xl font-black text-white focus:border-indigo-500 outline-none" />
                    </div>
                  </div>
                  
                  <button onClick={() => submitInspection(t)} className={`w-full py-4 rounded-xl shadow-lg font-black text-xl tracking-widest transition-colors active:scale-[0.98] ${loggedStatus.includes(t.id) ? 'bg-green-500 text-white border-2 border-green-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                    {loggedStatus.includes(t.id) ? '✓ SAVED' : 'LOG INSPECTION'}
                  </button>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700">
                    <button onClick={() => handleTyreAction(t, 'REPAIR')} className="bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 py-4 rounded-xl font-black uppercase active:bg-yellow-600 active:text-white transition-colors">Repair</button>
                    <button onClick={() => handleTyreAction(t, 'RECAP')} className="bg-purple-600/20 text-purple-400 border border-purple-600/50 py-4 rounded-xl font-black uppercase active:bg-purple-600 active:text-white transition-colors">Recap</button>
                    <button onClick={() => handleTyreAction(t, 'SOLD')} className="bg-blue-600/20 text-blue-400 border border-blue-600/50 py-4 rounded-xl font-black uppercase active:bg-blue-600 active:text-white transition-colors">Sell</button>
                    <button onClick={() => handleTyreAction(t, 'SCRAPPED')} className="bg-red-600/20 text-red-500 border border-red-600/50 py-4 rounded-xl font-black uppercase active:bg-red-600 active:text-white transition-colors">Scrap</button>
                  </div>

                  <div className="pt-4 border-t border-gray-700">
                    <button onClick={() => toggleHistory(t.id)} className="w-full py-3 bg-gray-900 hover:bg-gray-700 border-2 border-gray-600 rounded-xl text-gray-400 font-bold uppercase tracking-widest transition-colors flex justify-center items-center gap-2">
                      <span>📜</span> {expandedHistoryId === t.id ? 'HIDE HISTORY' : 'VIEW HISTORY'}
                    </button>

                    {expandedHistoryId === t.id && (
                      <div className="mt-3 bg-gray-900 rounded-xl p-4 border border-gray-700 shadow-inner">
                        {isLoadingHistory && (!tyreHistories[t.id] || tyreHistories[t.id].length === 0) ? (
                          <p className="text-gray-500 text-center text-sm font-bold animate-pulse">Loading logs...</p>
                        ) : tyreHistories[t.id] && tyreHistories[t.id].length > 0 ? (
                          <div className="space-y-2">
                            {tyreHistories[t.id].map((log, i) => (
                              <div key={log.id || i} className="flex justify-between items-center bg-gray-800 p-3 rounded-lg border border-gray-700">
                                <div className="flex flex-col">
                                  <span className="text-indigo-400 font-bold text-sm">{log.inspection_date}</span>
                                  <span className="text-gray-500 text-xs font-bold uppercase">{log.odometer ? `${Number(log.odometer).toLocaleString()} km` : 'No Odo'}</span>
                                </div>
                                <div className="flex gap-4 text-right">
                                  <div className="flex flex-col items-center">
                                    <span className="text-gray-500 text-[10px] uppercase font-bold mb-1">Tread</span>
                                    <span className="text-white font-black text-lg leading-none">{log.tread_depth}<span className="text-xs text-gray-400 ml-0.5">mm</span></span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-gray-500 text-[10px] uppercase font-bold mb-1">PSI</span>
                                    <span className="text-white font-black text-lg leading-none">{log.psi || '--'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center text-sm font-bold py-2">No history logged for this tyre yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ==========================================
          🚀 NEW: YARD WALKABOUT SCRAP REASON MODAL 
      ========================================== */}
      {scrapTyreTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-90 flex items-center justify-center p-4 animate-fade-in text-gray-900">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-red-500">
            <div className="bg-red-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-widest uppercase text-sm flex items-center gap-2">
                ⚠️ Scrap Casing {scrapTyreTarget.tyre?.serial_number}
              </h3>
              <button onClick={() => { setScrapTyreTarget(null); setScrapReason(''); }} className="text-red-200 hover:text-white font-bold text-xl leading-none">✕</button>
            </div>
            
            <div className="p-6 bg-red-50/30">
              <p className="text-sm font-bold text-gray-700 mb-4">
                This action will permanently remove tyre <span className="text-red-600 font-black">{scrapTyreTarget.tyre?.serial_number}</span> from this truck and send it to the Scrap Ledger.
              </p>
              <div>
                <label className="block text-xs font-black text-red-800 uppercase tracking-widest mb-2">Reason for Scrapping *</label>
                <textarea 
                  placeholder="e.g. Irreparable sidewall blowout, run flat, reached absolute end of life..."
                  value={scrapReason} 
                  onChange={e => setScrapReason(e.target.value)} 
                  className="w-full p-3 border-2 border-red-200 rounded-lg focus:border-red-500 outline-none text-sm text-gray-800 font-medium min-h-25 shadow-inner bg-white" 
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setScrapTyreTarget(null); setScrapReason(''); }} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-200 rounded transition-colors">Cancel</button>
              <button onClick={executeYardScrapTyre} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded shadow-md transition-colors active:scale-95 uppercase tracking-widest">
                Confirm & Scrap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}