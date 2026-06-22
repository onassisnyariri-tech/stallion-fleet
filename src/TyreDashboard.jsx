import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';

export default function TyreDashboard({ companyId }) {
  const [tyres, setTyres] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  
  const [activeSubTab, setActiveSubTab] = useState('inventory');
  const [inventoryFilter, setInventoryFilter] = useState('ACTIVE');
  
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [intakeSerial, setIntakeSerial] = useState('');
  const [intakeBrand, setIntakeBrand] = useState('');
  const [intakePrice, setIntakePrice] = useState('');
  const [intakeTread, setIntakeTread] = useState('14.0');
  const [editingTyre, setEditingTyre] = useState(null);
  const [editForm, setEditForm] = useState({ serial_number: '', brand: '', purchase_price: '', original_tread: '' });
  
  const [editingFuelLog, setEditingFuelLog] = useState(null);
  const [fuelEditForm, setFuelEditForm] = useState({ odometer: '', volume: '', cost: '' });
  
  const [editingHistoryLog, setEditingHistoryLog] = useState(null);
  const [historyEditForm, setHistoryEditForm] = useState({ logged_tread: '', logged_psi: '', details: '' });
  
  const [scrapTyreTarget, setScrapTyreTarget] = useState(null);
  const [scrapReason, setScrapReason] = useState('');

  const [selectedPowerUnit, setSelectedPowerUnit] = useState(null);
  const [mountingSlot, setMountingSlot] = useState(null); 
  const [inspectingTyre, setInspectingTyre] = useState(null);
  const [newTread, setNewTread] = useState('');
  const [newPsi, setNewPsi] = useState(''); 
  
  const [repairCosts, setRepairCosts] = useState({});

  const [historyPanelTyre, setHistoryPanelTyre] = useState(null);
  const [tyreHistoryLogs, setTyreHistoryLogs] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (companyId) fetchData(); }, [companyId]);

  const fetchData = async () => {
    const { data: tyreData, error } = await supabase
      .from('tyres')
      .select('*')
      .eq('company_id', companyId);
      
    if (tyreData) {
      const analyzedTyres = tyreData.map(tyre => {
        const treadUsed = tyre.original_tread - tyre.tread_depth;
        const thousandsOfKm = tyre.virtual_mileage / 1000;
        let burnRate = 0, expectedLife = 0, cpk = 0;
        if (thousandsOfKm > 0) burnRate = (treadUsed / thousandsOfKm).toFixed(2);
        if (burnRate > 0) expectedLife = Math.round(((tyre.original_tread - 2.0) / burnRate) * 1000);
        let totalCost = Number(tyre.purchase_price || 0) + Number(tyre.repair_cost || 0);
        if (tyre.virtual_mileage > 0 && totalCost > 0) cpk = (totalCost / tyre.virtual_mileage).toFixed(4);
        return { ...tyre, treadUsed, burnRate, expectedLife, cpk, totalCost };
      });
      setTyres(analyzedTyres);
    }
    
    const { data: vehicleData } = await supabase.from('vehicles').select('*').eq('company_id', companyId).order('fleet_number', { ascending: true });
    if (vehicleData) setVehicles(vehicleData);

    const { data: fuelData } = await supabase.from('fuel_logs').select('*').eq('company_id', companyId).order('log_date', { ascending: false });
    if (fuelData) setFuelLogs(fuelData);
  };

  const isTowedUnit = (vehicle) => {
    const t = (vehicle?.asset_type || vehicle?.type || '').toLowerCase();
    return t.includes('deck') || t.includes('link') || t.includes('trailer');
  };

  const logTyreHistory = async (tyreId, action, details, tread, psi = null) => {
    await supabase.from('tyre_history').insert([{ 
      company_id: companyId,
      tyre_id: tyreId, 
      action: action, 
      details: details, 
      logged_tread: tread, 
      logged_psi: psi 
    }]);
  };

  const handleViewHistory = async (tyre) => {
    setHistoryPanelTyre(tyre); setIsLoadingHistory(true);
    const { data } = await supabase.from('tyre_history').select('*').eq('tyre_id', tyre.id).order('created_at', { ascending: false });
    setTyreHistoryLogs(data || []); setIsLoadingHistory(false);
  };

  const handleIntakeTyre = async () => {
    const numPrice = parseFloat(intakePrice) || 0;
    const numTread = parseFloat(intakeTread) || 14.0;
    
    const { data, error } = await supabase.from('tyres').insert([{ 
      company_id: companyId, 
      serial_number: intakeSerial, 
      brand: intakeBrand,
      purchase_price: numPrice, 
      original_tread: numTread, 
      tread_depth: numTread, 
      status: 'ON HAND', 
      virtual_mileage: 0, 
      retread_count: 0 
    }]).select();

    if (error) return alert("Database Error: " + error.message);

    if (data && data[0]) {
      await logTyreHistory(data[0].id, 'PURCHASED', `Added to yard inventory. Brand: ${intakeBrand}, Purchase Price: R ${numPrice}`, numTread);
    }
    
    setIntakeSerial(''); setIntakeBrand(''); setIntakePrice(''); setIntakeTread('14.0'); setShowIntakeForm(false); 
    fetchData();
  };

  const openEditModal = (tyre) => {
    setEditingTyre(tyre);
    setEditForm({
      serial_number: tyre.serial_number || '',
      brand: tyre.brand || '',
      purchase_price: tyre.purchase_price || '',
      original_tread: tyre.original_tread || ''
    });
  };

  const handleSaveEdit = async () => {
    const { error } = await supabase.from('tyres').update({
      serial_number: editForm.serial_number,
      brand: editForm.brand,
      purchase_price: parseFloat(editForm.purchase_price) || 0,
      original_tread: parseFloat(editForm.original_tread) || 14.0
    }).eq('id', editingTyre.id).eq('company_id', companyId);

    if (error) return alert("Database Error: " + error.message);

    await logTyreHistory(editingTyre.id, 'RECORD EDITED', `Admin updated casing baseline details.`, editForm.original_tread);
    setEditingTyre(null);
    fetchData();
  };

  const handleDeleteTyre = async (id, serial) => {
    const confirmText = `CRITICAL WARNING:\n\nAre you sure you want to completely delete tyre ${serial}?\nThis will wipe it from the ledger permanently!`;
    if (!window.confirm(confirmText)) return;

    await supabase.from('tyre_history').delete().eq('tyre_id', id).eq('company_id', companyId);
    const { error } = await supabase.from('tyres').delete().eq('id', id).eq('company_id', companyId);

    if (error) return alert("Database Error: " + error.message);
    setEditingTyre(null);
    fetchData();
  };

  const openFuelEditModal = (log) => {
    setEditingFuelLog(log);
    setFuelEditForm({
      odometer: log.odometer || '',
      volume: log.volume || '',
      cost: log.cost || ''
    });
  };

  const handleSaveFuelEdit = async () => {
    const { error } = await supabase.from('fuel_logs').update({
      odometer: parseFloat(fuelEditForm.odometer) || null,
      volume: parseFloat(fuelEditForm.volume) || null,
      cost: parseFloat(fuelEditForm.cost) || null
    }).eq('id', editingFuelLog.id).eq('company_id', companyId);

    if (error) return alert("Database Error: " + error.message);

    setEditingFuelLog(null);
    fetchData(); 
  };

  const handleDeleteFuelLog = async (id) => {
    if (!window.confirm("CRITICAL WARNING:\n\nDelete this fuel log permanently? This will recalculate the truck's consumption history.")) return;

    const { error } = await supabase.from('fuel_logs').delete().eq('id', id).eq('company_id', companyId);
    if (error) return alert("Database Error: " + error.message);
    
    setEditingFuelLog(null);
    fetchData();
  };

  const openHistoryEditModal = (log) => {
    setEditingHistoryLog(log);
    setHistoryEditForm({
      logged_tread: log.logged_tread || '',
      logged_psi: log.logged_psi || '',
      details: log.details || ''
    });
  };

  const executeScrapTyre = async () => {
    if (!scrapReason.trim()) return alert("You must provide a reason for scrapping this casing.");

    const tyre = scrapTyreTarget.tyre;
    
    const { error } = await supabase.from('tyres').update({ 
      status: 'SCRAPPED', 
      vehicle_id: null,
      position: null 
    }).eq('id', tyre.id).eq('company_id', companyId);

    if (error) return alert("Database Error: " + error.message);

    await logTyreHistory(tyre.id, 'SCRAPPED', `Reason for scrap: ${scrapReason}`, tyre.tread_depth, tyre.current_psi);

    setScrapTyreTarget(null);
    setScrapReason('');
    if (scrapTyreTarget.fromInspectPanel) setInspectingTyre(null);
    
    fetchData(); 
  };

  const handleSaveHistoryEdit = async () => {
    const { error } = await supabase.from('tyre_history').update({
      logged_tread: parseFloat(historyEditForm.logged_tread) || null,
      logged_psi: parseFloat(historyEditForm.logged_psi) || null,
      details: historyEditForm.details
    }).eq('id', editingHistoryLog.id).eq('company_id', companyId);

    if (error) return alert("Database Error: " + error.message);

    setEditingHistoryLog(null);
    handleViewHistory(historyPanelTyre); 
  };

  const handleDeleteHistoryLog = async (id) => {
    if (!window.confirm("CRITICAL WARNING:\n\nDelete this audit log? This cannot be undone.")) return;

    const { error } = await supabase.from('tyre_history').delete().eq('id', id).eq('company_id', companyId);
    if (error) return alert("Database Error: " + error.message);
    
    setEditingHistoryLog(null);
    handleViewHistory(historyPanelTyre);
  };

  const handleMountTyre = async (tyreId) => {
    const tyre = tyres.find(t => t.id === tyreId);
    const targetVehicle = vehicles.find(v => String(v.id) === String(mountingSlot.vehicleId));
    await supabase.from('tyres').update({ vehicle_id: mountingSlot.vehicleId, position: mountingSlot.position, status: 'ACTIVE' }).eq('id', tyreId);
    await logTyreHistory(tyreId, 'MOUNTED', `Mounted to ${targetVehicle?.fleet_number} at position: ${mountingSlot.position}`, tyre.tread_depth);
    setMountingSlot(null); fetchData();
  };

  const handleUnmountTyre = async (tyreId, destinationStatus) => {
    const tyre = tyres.find(t => t.id === tyreId);
    const safeStatus = String(destinationStatus).trim().toUpperCase();

    if (safeStatus === 'SCRAPPED') {
      setScrapTyreTarget({ tyre, fromInspectPanel: true });
      return; 
    }

    const isConfirmed = window.confirm(`Remove tyre from unit and send to ${safeStatus}?`);
    if (!isConfirmed) return;

    await supabase.from('tyres').update({ vehicle_id: null, position: null, status: safeStatus }).eq('id', tyreId).eq('company_id', companyId);
    await logTyreHistory(tyreId, 'UNMOUNTED', `Removed from unit. Sent to: ${safeStatus}`, tyre.tread_depth);
    setInspectingTyre(null); 
    fetchData();
  };

  const handleQuickMove = async (tyre, destinationStatus) => {
    if (!destinationStatus) return;
    const safeStatus = String(destinationStatus).trim().toUpperCase();

    if (safeStatus === 'SCRAPPED') {
      setScrapTyreTarget({ tyre, fromInspectPanel: false });
      return; 
    }

    const isConfirmed = window.confirm(`Move tyre ${tyre.serial_number} to ${safeStatus}?`);
    if (!isConfirmed) return;

    await supabase.from('tyres').update({ status: safeStatus, vehicle_id: null, position: null }).eq('id', tyre.id).eq('company_id', companyId);
    await logTyreHistory(tyre.id, 'STATUS UPDATE', `Re-routed to ${safeStatus} from Office Dashboard.`, tyre.tread_depth, tyre.current_psi);
    fetchData();
  };

  const handleLogInspection = async (tyreId) => {
    const numericTread = parseFloat(newTread);
    const numericPsi = newPsi ? parseFloat(newPsi) : null;
    const updatePayload = { tread_depth: numericTread };
    if (numericPsi) updatePayload.current_psi = numericPsi;
    await supabase.from('tyres').update(updatePayload).eq('id', tyreId);
    let detailsStr = `Tread depth logged: ${numericTread}mm.`;
    if (numericPsi) detailsStr += ` Pressure logged: ${numericPsi} PSI.`;
    await logTyreHistory(tyreId, 'INSPECTED', detailsStr, numericTread, numericPsi);
    setInspectingTyre(null); setNewTread(''); setNewPsi(''); fetchData();
  };

  const handleCompleteRepair = async (tyreId, currentRepairTotal) => {
    const tyre = tyres.find(t => t.id === tyreId);
    const additionalCost = parseFloat(repairCosts[tyreId]) || 0;
    await supabase.from('tyres').update({ status: 'ON HAND', repair_cost: currentRepairTotal + additionalCost }).eq('id', tyreId);
    await logTyreHistory(tyreId, 'REPAIRED', `Returned from repair. Invoice cost: R ${additionalCost.toFixed(2)}`, tyre.tread_depth);
    setRepairCosts(prev => ({...prev, [tyreId]: ''}));
    fetchData();
  };

  const handleHook = async (tractorId, trailerId) => { await supabase.from('vehicles').update({ hooked_to_id: tractorId }).eq('id', trailerId); fetchData(); };
  const handleDrop = async (trailerId) => { await supabase.from('vehicles').update({ hooked_to_id: null }).eq('id', trailerId); fetchData(); };

  const filteredInventoryTyres = tyres.filter(t => {
    const status = t.status || 'ACTIVE';
    return status === inventoryFilter;
  });

  const exportToCSV = () => {
    const headers = ["Serial Number", "Purchase Date", "Purchase Cost (ZAR)", "Original Tread Depth (mm)", "Current Tread Depth (mm)", "Retread Count", "Status", "KM Run", "Cost per KM (ZAR)", "Avg Tread Wear (mm/1000km)", "Estimated Lifespan (km)"];
    
    const csvRows = filteredInventoryTyres.map(tyre => {
      const dateStr = tyre.purchase_date || tyre.created_at;
      const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-ZA') : 'Unknown';
      return [`"${tyre.serial_number}"`, `"${formattedDate}"`, tyre.purchase_price || 0, tyre.original_tread || 14.0, tyre.tread_depth || 0, tyre.retread_count || 0, `"${tyre.status || 'ACTIVE'}"`, tyre.virtual_mileage || 0, tyre.cpk || 0, tyre.burnRate || 0, tyre.expectedLife || 0];
    });

    const csvContent = "sep=,\n" + [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a'); 
    link.setAttribute('href', url); 
    link.setAttribute('download', `STC_${inventoryFilter}_Tyres_${new Date().toISOString().split('T')[0]}.csv`);
    
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  const getTyreAtPosition = (vehicleId, position) => {
    return tyres.find(t => {
      const isCorrectVehicle = String(t.vehicle_id) === String(vehicleId);
      const safeDbPos = (t.position || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const safeReactPos = (position || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const isCorrectPosition = safeDbPos === safeReactPos;
      const isActive = (t.status || '').toUpperCase().includes('ACTIVE');
      return isCorrectVehicle && isCorrectPosition && isActive;
    });
  };

  const getTreadColor = (depth) => {
    if (depth > 4) return 'bg-green-500 border-green-700';
    if (depth >= 2) return 'bg-yellow-400 border-yellow-600';
    return 'bg-red-500 border-red-700 animate-pulse';
  };

  const renderTyreSlot = (vehicleId, position, label, isSteer = false) => {
    const mountedTyre = getTyreAtPosition(vehicleId, position);
    if (mountedTyre) {
      return (
        <button type="button" key={`${vehicleId}-${position}`} onClick={() => setInspectingTyre(mountedTyre)} className={`w-8 h-16 ${getTreadColor(mountedTyre.tread_depth)} rounded flex items-center justify-center cursor-pointer shadow-lg border-2 hover:opacity-80 transition-all z-10 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-400`}>
          <span className={`text-[8px] text-white font-black drop-shadow-md ${isSteer ? (label?.includes('L') ? 'rotate-90' : '-rotate-90') : ''}`}>{mountedTyre.tread_depth}</span>
        </button>
      );
    }
    return (
      <button type="button" key={`${vehicleId}-${position}`} onClick={() => setMountingSlot({ vehicleId, position })} className="w-8 h-16 bg-gray-300 border-2 border-dashed border-gray-500 rounded flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors z-10 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-400">
        <span className="text-gray-500 font-bold text-xl">+</span>
      </button>
    );
  };

  const availableToMount = tyres.filter(t => t.status === 'ON HAND');
  const hookedTrailers = selectedPowerUnit ? vehicles.filter(v => String(v.hooked_to_id) === String(selectedPowerUnit.id)) : [];

  const fuelMetrics = useMemo(() => {
    let totalDist = 0;
    let totalVol = 0;
    
    const byVehicle = {};
    fuelLogs.forEach(log => {
      if (!byVehicle[log.vehicle_id]) byVehicle[log.vehicle_id] = [];
      byVehicle[log.vehicle_id].push(log);
    });
    
    const consumptionMap = {};
    Object.keys(byVehicle).forEach(vid => {
      const vLogs = byVehicle[vid].sort((a, b) => Number(b.odometer) - Number(a.odometer));
      for (let i = 0; i < vLogs.length; i++) {
        let cons = '-';
        if (i < vLogs.length - 1) {
          const prev = vLogs[i + 1];
          const dist = Number(vLogs[i].odometer) - Number(prev.odometer);
          const vol = Number(vLogs[i].volume);
          if (dist > 0 && vol > 0) {
            cons = (dist / vol).toFixed(2) + ' km/L';
            totalDist += dist;
            totalVol += vol;
          }
        }
        consumptionMap[vLogs[i].id] = cons;
      }
    });
    
    const processed = fuelLogs.map(log => ({
      ...log,
      consumption: consumptionMap[log.id] || '-',
      rpl: log.cost && log.volume ? (Number(log.cost) / Number(log.volume)).toFixed(2) : '-'
    }));
    
    return {
      processedFuelLogs: processed,
      fleetAvgKmL: totalVol > 0 ? (totalDist / totalVol).toFixed(2) : '0.00',
      totalVolume: fuelLogs.reduce((acc, log) => acc + (Number(log.volume) || 0), 0),
      totalSpend: fuelLogs.reduce((acc, log) => acc + (Number(log.cost) || 0), 0)
    };
  }, [fuelLogs]);

  return (
    <div className="animate-fade-in relative overflow-hidden">
      
      <div className="flex overflow-x-auto whitespace-nowrap gap-4 border-b border-gray-200 pb-2 bg-white px-4 md:px-6 pt-4 rounded-t-lg hide-scrollbar">
        <button type="button" onClick={() => setActiveSubTab('inventory')} className={`font-bold pb-2 transition-colors ${activeSubTab === 'inventory' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Inventory Analytics</button>
        <button type="button" onClick={() => setActiveSubTab('repairs')} className={`font-bold pb-2 transition-colors ${activeSubTab === 'repairs' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}>Repair Ledger</button>
        <button type="button" onClick={() => setActiveSubTab('workshop')} className={`font-bold pb-2 transition-colors ${activeSubTab === 'workshop' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Live Workshop</button>
        <button type="button" onClick={() => setActiveSubTab('fuel')} className={`font-bold pb-2 transition-colors ${activeSubTab === 'fuel' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-700'}`}>Fuel Analytics</button>
      </div>

      <div className="py-4 md:py-6">
        
        {activeSubTab === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
              <button type="button" onClick={() => setInventoryFilter('ACTIVE')} className={`text-left w-full cursor-pointer bg-white p-3 md:p-4 rounded shadow-sm border-t-4 border-green-500 transition-all ${inventoryFilter === 'ACTIVE' ? 'ring-2 ring-green-500 bg-green-50 scale-[1.02]' : 'hover:bg-gray-50'}`}>
                <span className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase">Active</span>
                <span className="block text-xl md:text-2xl font-black text-green-600">{tyres.filter(t => (t.status || 'ACTIVE') === 'ACTIVE').length}</span>
              </button>
              <button type="button" onClick={() => setInventoryFilter('ON HAND')} className={`text-left w-full cursor-pointer bg-white p-3 md:p-4 rounded shadow-sm border-t-4 border-blue-500 transition-all ${inventoryFilter === 'ON HAND' ? 'ring-2 ring-blue-500 bg-blue-50 scale-[1.02]' : 'hover:bg-gray-50'}`}>
                <span className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase">Yard / On Hand</span>
                <span className="block text-xl md:text-2xl font-black">{tyres.filter(t => t.status === 'ON HAND').length}</span>
              </button>
              <button type="button" onClick={() => setInventoryFilter('RECAP')} className={`text-left w-full cursor-pointer bg-white p-3 md:p-4 rounded shadow-sm border-t-4 border-purple-500 transition-all ${inventoryFilter === 'RECAP' ? 'ring-2 ring-purple-500 bg-purple-50 scale-[1.02]' : 'hover:bg-gray-50'}`}>
                <span className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase">In Recap</span>
                <span className="block text-xl md:text-2xl font-black">{tyres.filter(t => t.status === 'RECAP').length}</span>
              </button>
              <button type="button" onClick={() => setInventoryFilter('SOLD')} className={`text-left w-full cursor-pointer bg-white p-3 md:p-4 rounded shadow-sm border-t-4 border-gray-800 transition-all ${inventoryFilter === 'SOLD' ? 'ring-2 ring-gray-800 bg-gray-100 scale-[1.02]' : 'hover:bg-gray-50'}`}>
                <span className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase">Casings to Sell</span>
                <span className="block text-xl md:text-2xl font-black">{tyres.filter(t => t.status === 'SOLD').length}</span>
              </button>
              <button type="button" onClick={() => setInventoryFilter('SCRAPPED')} className={`text-left w-full cursor-pointer bg-white p-3 md:p-4 rounded shadow-sm border-t-4 border-red-500 transition-all ${inventoryFilter === 'SCRAPPED' ? 'ring-2 ring-red-500 bg-red-50 scale-[1.02]' : 'hover:bg-gray-50'}`}>
                <span className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase">Scrapped</span>
                <span className="block text-xl md:text-2xl font-black text-red-600">{tyres.filter(t => t.status === 'SCRAPPED').length}</span>
              </button>
            </div>

            <div>
              {!showIntakeForm ? (
                <button type="button" onClick={() => setShowIntakeForm(true)} className="w-full md:w-auto bg-gray-800 text-white px-4 py-3 md:py-2 rounded text-sm font-bold shadow-sm hover:bg-black transition-colors">
                  + Intake New Casing
                </button>
              ) : (
                <div className="bg-blue-50 p-4 border border-blue-200 rounded-lg shadow-sm flex flex-col md:flex-row items-stretch md:items-end gap-4 animate-fade-in">
                  <div className="flex gap-2 flex-1">
                    <div className="flex-1">
                      <label htmlFor="intakeBrand" className="block text-xs font-bold text-blue-800 mb-1">Brand</label>
                      <input id="intakeBrand" type="text" value={intakeBrand} onChange={(e)=>setIntakeBrand(e.target.value)} className="w-full p-2 border border-blue-200 rounded outline-none focus:border-blue-500" placeholder="e.g. Michelin" />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="intakeSerial" className="block text-xs font-bold text-blue-800 mb-1">Serial Number</label>
                      <input id="intakeSerial" type="text" value={intakeSerial} onChange={(e)=>setIntakeSerial(e.target.value)} className="w-full p-2 border border-blue-200 rounded outline-none focus:border-blue-500" placeholder="e.g. STC-800" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 md:w-32">
                      <label htmlFor="intakePrice" className="block text-xs font-bold text-blue-800 mb-1">Price (R)</label>
                      <input id="intakePrice" type="number" value={intakePrice} onChange={(e)=>setIntakePrice(e.target.value)} className="w-full p-2 border border-blue-200 rounded outline-none focus:border-blue-500" />
                    </div>
                    <div className="flex-1 md:w-32">
                      <label htmlFor="intakeTread" className="block text-xs font-bold text-blue-800 mb-1">Tread (mm)</label>
                      <input id="intakeTread" type="number" step="0.1" value={intakeTread} onChange={(e)=>setIntakeTread(e.target.value)} className="w-full p-2 border border-blue-200 rounded outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    <button type="button" onClick={handleIntakeTyre} disabled={!intakeSerial} className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setShowIntakeForm(false)} className="flex-1 md:flex-none bg-white text-gray-500 border border-gray-300 px-4 py-2 rounded font-bold hover:bg-gray-100">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="font-bold text-gray-800">
                  Ledger: {inventoryFilter === 'ON HAND' ? 'YARD / ON HAND' : inventoryFilter === 'SOLD' ? 'CASINGS TO SELL' : inventoryFilter} TYRES
                </h3>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button type="button" onClick={exportToCSV} className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700 shadow-sm">Export Filtered CSV</button>
                </div>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-200">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="p-3 md:p-4 font-bold">Serial / Status</th>
                      <th className="p-3 md:p-4 font-bold">Total Cost</th>
                      <th className="p-3 md:p-4 font-bold">Tread</th>
                      <th className="p-3 md:p-4 font-bold">Mileage</th>
                      <th className="p-3 md:p-4 font-bold text-indigo-600">CPK</th>
                      <th className="p-3 md:p-4 font-bold text-center">Audit & Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventoryTyres.length === 0 ? (
                      <tr><td colSpan="6" className="p-10 text-center text-gray-500 font-bold italic">No tyres found in {inventoryFilter} status.</td></tr>
                    ) : (
                      filteredInventoryTyres.map(tyre => (
                        <tr key={tyre.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 md:p-4">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{tyre.brand || 'No Brand'}</span>
                            <span className="block font-black text-gray-800 text-lg leading-none mb-1">{tyre.serial_number}</span>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${tyre.status === 'ACTIVE' || !tyre.status ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{tyre.status || 'ACTIVE'}</span>
                          </td>
                          <td className="p-3 md:p-4 font-bold text-gray-700">R {tyre.totalCost?.toFixed(2)}</td>
                          <td className="p-3 md:p-4 font-bold">{tyre.tread_depth} mm</td>
                          <td className="p-3 md:p-4 text-sm text-gray-600">{tyre.virtual_mileage.toLocaleString()} km</td>
                          <td className="p-3 md:p-4 text-sm font-black text-indigo-600">{tyre.cpk > 0 ? `R ${tyre.cpk}` : '-'}</td>
                          
                          <td className="p-3 md:p-4 text-center whitespace-nowrap flex items-center justify-center gap-2 mt-2">
                            <button type="button" onClick={() => handleViewHistory(tyre)} className="text-[10px] md:text-xs bg-gray-800 text-white px-3 py-1.5 rounded font-bold hover:bg-black transition-colors">History</button>
                            
                            <button type="button" onClick={() => openEditModal(tyre)} className="text-[10px] md:text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded font-bold hover:bg-indigo-100 transition-colors">Edit</button>
                            
                            <select 
                              onChange={(e) => handleQuickMove(tyre, e.target.value)} 
                              value="" 
                              className="text-[10px] md:text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded font-bold outline-none cursor-pointer hover:bg-gray-50 shadow-sm"
                            >
                              <option value="" disabled>Move To...</option>
                              {['ON HAND', 'REPAIR', 'RECAP', 'SOLD', 'SCRAPPED'].filter(s => s !== (tyre.status || 'ACTIVE')).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'repairs' && (
          <div className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="font-bold text-red-800">Active Repair Orders</h3>
              <span className="bg-white px-3 py-1 rounded text-sm font-bold text-red-600 shadow-sm">Total Spend: R {tyres.reduce((sum, t) => sum + Number(t.repair_cost || 0), 0).toFixed(2)}</span>
            </div>
            <div className="p-4 md:p-6">
              {tyres.filter(t => t.status === 'REPAIR').length === 0 ? (
                <p className="text-gray-500 italic">No tyres currently out for repair.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {tyres.filter(t => t.status === 'REPAIR').map(tyre => (
                    <div key={tyre.id} className="border border-gray-200 p-4 rounded-lg shadow-sm">
                      <h4 className="font-black text-lg text-gray-800">{tyre.serial_number}</h4>
                      <p className="text-sm text-gray-500 mb-4">Previous Repair Cost: R {tyre.repair_cost || 0}</p>
                      <div className="space-y-2">
                        <input 
                          type="number" 
                          placeholder="Invoice Cost (R)" 
                          value={repairCosts[tyre.id] || ''}
                          className="w-full p-2 border border-gray-300 rounded text-sm outline-none focus:border-red-500" 
                          onChange={(e) => setRepairCosts(prev => ({...prev, [tyre.id]: e.target.value}))} 
                        />
                        <button type="button" onClick={() => handleCompleteRepair(tyre.id, tyre.repair_cost || 0)} className="w-full bg-red-600 text-white font-bold py-2 rounded text-sm hover:bg-red-700">Log Invoice</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'workshop' && (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-10">
              <div>
                <label htmlFor="primaryPowerUnit" className="block text-xs font-bold text-gray-500 uppercase mb-2">1. Primary Power Unit</label>
                <select id="primaryPowerUnit" value={selectedPowerUnit?.id || ''} onChange={(e) => { setSelectedPowerUnit(vehicles.find(v => String(v.id) === String(e.target.value))); setMountingSlot(null); setInspectingTyre(null); }} className="w-full p-3 border-2 border-indigo-200 rounded font-bold outline-none focus:border-indigo-600 bg-indigo-50">
                  <option value="">Select Tractor / Rigid...</option>
                  {vehicles.filter(v => !isTowedUnit(v)).map(v => <option key={v.id} value={v.id}>{v.fleet_number} ({v.asset_type || v.type || 'Power Unit'})</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="hookTowedUnit" className="block text-xs font-bold text-gray-500 uppercase mb-2">2. Hook Towed Unit</label>
                <select id="hookTowedUnit" onChange={(e) => handleHook(selectedPowerUnit?.id, e.target.value)} disabled={!selectedPowerUnit} className="w-full p-3 border-2 border-emerald-200 rounded font-bold outline-none focus:border-emerald-600 bg-emerald-50" defaultValue="">
                  <option value="">Hook a trailer...</option>
                  {vehicles.filter(v => isTowedUnit(v) && String(v.id) !== String(selectedPowerUnit?.id)).map(v => <option key={v.id} value={v.id}>{v.fleet_number} {v.hooked_to_id ? '(Already Hooked)' : ''}</option>)}
                </select>
              </div>
            </div>

            {selectedPowerUnit ? (
              <div className="bg-gray-100 p-4 md:p-8 rounded-xl border-2 border-dashed border-gray-300 overflow-x-auto">
                <div className="flex flex-col items-center gap-4 min-w-75">
                  
                  <div className="w-72 border-4 border-gray-800 rounded-t-3xl pb-10 pt-2 bg-gray-200 flex flex-col items-center shadow-xl">
                    <div className="bg-gray-800 text-white px-4 py-1 rounded-full text-xs font-black mb-4 uppercase tracking-widest">{selectedPowerUnit.fleet_number}</div>
                    <div className="w-full h-16 bg-blue-100/50 rounded-t-2xl border-b-2 border-gray-800 mb-8"></div>
                    <div className="w-full flex justify-between px-2 relative mb-8">
                      <div className="absolute top-4 left-0 w-full h-3 bg-gray-700"></div>
                      {renderTyreSlot(selectedPowerUnit.id, 'Steer - L', 'L', true)}
                      {renderTyreSlot(selectedPowerUnit.id, 'Steer - R', 'R', true)}
                    </div>
                    <div className="w-full px-8 mb-8">
                      <div className="border-2 border-dashed border-gray-400 rounded p-2 flex justify-center relative bg-gray-300/50">
                        <span className="absolute -top-2.5 bg-gray-200 px-2 text-[9px] font-bold text-gray-600 uppercase tracking-widest rounded">Spare Rack</span>
                        {renderTyreSlot(selectedPowerUnit.id, 'Spare 1')}
                      </div>
                    </div>
                    <div className="w-full flex justify-between relative mb-10 px-2 -mx-2">
                      <div className="absolute top-4 left-0 w-full h-4 bg-gray-800"></div>
                      <div className="flex gap-1">{renderTyreSlot(selectedPowerUnit.id, 'Drive 1 - LO')}{renderTyreSlot(selectedPowerUnit.id, 'Drive 1 - LI')}</div>
                      <div className="flex gap-1">{renderTyreSlot(selectedPowerUnit.id, 'Drive 1 - RI')}{renderTyreSlot(selectedPowerUnit.id, 'Drive 1 - RO')}</div>
                    </div>
                    <div className="w-full flex justify-between relative px-2 -mx-2">
                      <div className="absolute top-4 left-0 w-full h-4 bg-gray-800"></div>
                      <div className="flex gap-1">{renderTyreSlot(selectedPowerUnit.id, 'Drive 2 - LO')}{renderTyreSlot(selectedPowerUnit.id, 'Drive 2 - LI')}</div>
                      <div className="flex gap-1">{renderTyreSlot(selectedPowerUnit.id, 'Drive 2 - RI')}{renderTyreSlot(selectedPowerUnit.id, 'Drive 2 - RO')}</div>
                    </div>
                  </div>

                  {hookedTrailers.map((trailer) => (
                    <div key={trailer.id} className="flex flex-col items-center">
                      <div className="h-8 w-4 bg-gray-800"></div>
                      <div className="w-72 border-4 border-emerald-800 rounded pb-8 pt-4 bg-emerald-50 flex flex-col items-center shadow-xl relative">
                        <button type="button" onClick={() => handleDrop(trailer.id)} className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-700">DROP</button>
                        <div className="bg-emerald-800 text-white px-4 py-1 rounded text-xs font-black mb-6 uppercase tracking-widest">{trailer.fleet_number}</div>
                        <div className="w-full px-6 mb-8">
                          <div className="border-2 border-dashed border-emerald-400 rounded p-2 flex justify-center gap-2 relative bg-emerald-100/50">
                            <span className="absolute -top-2.5 bg-emerald-50 px-2 text-[9px] font-bold text-emerald-700 uppercase tracking-widest rounded">Spare Carrier Racks</span>
                            {renderTyreSlot(trailer.id, 'Spare 1')}
                            {renderTyreSlot(trailer.id, 'Spare 2')}
                          </div>
                        </div>
                        <div className="w-full flex justify-between relative mb-10 px-2 -mx-2">
                          <div className="absolute top-4 left-0 w-full h-4 bg-gray-800"></div>
                          <div className="flex gap-1">{renderTyreSlot(trailer.id, 'Axle 1 - LO')}{renderTyreSlot(trailer.id, 'Axle 1 - LI')}</div>
                          <div className="flex gap-1">{renderTyreSlot(trailer.id, 'Axle 1 - RI')}{renderTyreSlot(trailer.id, 'Axle 1 - RO')}</div>
                        </div>
                        <div className="w-full flex justify-between relative mb-10 px-2 -mx-2">
                          <div className="absolute top-4 left-0 w-full h-4 bg-gray-800"></div>
                          <div className="flex gap-1">{renderTyreSlot(trailer.id, 'Axle 2 - LO')}{renderTyreSlot(trailer.id, 'Axle 2 - LI')}</div>
                          <div className="flex gap-1">{renderTyreSlot(trailer.id, 'Axle 2 - RI')}{renderTyreSlot(trailer.id, 'Axle 2 - RO')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400 italic font-medium">Select a Power Unit to pull it into the bay.</div>
            )}
          </div>
        )}

        {activeSubTab === 'fuel' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-amber-500">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Volume</p>
                <p className="text-xl md:text-3xl font-black text-gray-800">
                  {fuelMetrics.totalVolume.toFixed(0)} <span className="text-sm text-gray-500">Liters</span>
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-green-500">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Spend</p>
                <p className="text-xl md:text-3xl font-black text-green-600">
                  R {fuelMetrics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border-t-4 border-blue-500">
                <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg R / Liter</p>
                <p className="text-xl md:text-3xl font-black text-blue-600">
                  R {fuelMetrics.totalVolume > 0 ? (fuelMetrics.totalSpend / fuelMetrics.totalVolume).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="bg-gray-900 p-4 rounded-xl shadow-sm border-t-4 border-purple-500">
                <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fleet Avg Consumption</p>
                <p className="text-xl md:text-3xl font-black text-purple-400">
                  {fuelMetrics.fleetAvgKmL} <span className="text-sm text-gray-400">km/L</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 uppercase tracking-widest text-sm">Fleet Fuel Ledger</h3>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-200">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="p-3 md:p-4 font-bold">Date Logged</th>
                      <th className="p-3 md:p-4 font-bold">Power Unit</th>
                      <th className="p-3 md:p-4 font-bold">Odometer</th>
                      <th className="p-3 md:p-4 font-bold text-amber-600">Volume Filled</th>
                      <th className="p-3 md:p-4 font-bold text-green-600">Invoice Cost</th>
                      <th className="p-3 md:p-4 font-bold text-blue-600">R / Liter</th>
                      <th className="p-3 md:p-4 font-bold text-purple-600 border-l border-gray-100">Consumption (km/L)</th>
                      <th className="p-3 md:p-4 font-bold text-center">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelMetrics.processedFuelLogs.length === 0 ? (
                      <tr><td colSpan="7" className="p-10 text-center text-gray-500 font-bold italic">No fuel logs recorded yet. Head to the Yard Walkaround to log diesel.</td></tr>
                    ) : (
                      fuelMetrics.processedFuelLogs.map(log => {
                        const truck = vehicles.find(v => String(v.id) === String(log.vehicle_id));
                        return (
                          <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3 md:p-4 font-bold text-gray-700">
                              {log.log_date || new Date(log.created_at).toLocaleDateString('en-ZA')}
                            </td>
                            <td className="p-3 md:p-4">
                              <span className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-black uppercase tracking-wider">
                                {truck ? truck.fleet_number : 'Unknown'}
                              </span>
                            </td>
                            <td className="p-3 md:p-4 font-bold text-gray-600">
                              {log.odometer ? `${Number(log.odometer).toLocaleString()} km` : '-'}
                            </td>
                            <td className="p-3 md:p-4 font-black text-amber-600">{log.volume} L</td>
                            <td className="p-3 md:p-4 font-black text-green-600">{log.cost ? `R ${log.cost}` : '-'}</td>
                            <td className="p-3 md:p-4 font-bold text-blue-600">{log.rpl !== '-' ? `R ${log.rpl}` : '-'}</td>
                            <td className="p-3 md:p-4 font-black text-purple-600 border-l border-gray-100 bg-purple-50/30">
                              {log.consumption}
                            </td>
                            <td className="p-3 md:p-4 text-center whitespace-nowrap">
                              <button type="button" onClick={() => openFuelEditModal(log)} className="text-[10px] md:text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded font-bold hover:bg-amber-100 transition-colors">Edit</button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {mountingSlot && (
        <div className="fixed top-0 right-0 w-full sm:w-80 h-full bg-white shadow-2xl border-l border-gray-200 p-6 z-50 flex flex-col transform transition-transform translate-x-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-800">Mount to {mountingSlot.position}</h3>
            <button type="button" onClick={() => setMountingSlot(null)} className="text-gray-400 hover:text-black font-bold text-xl">X</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {availableToMount.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No active tyres in yard.</p>
            ) : (
              availableToMount.map(t => (
                <button type="button" key={t.id} onClick={() => handleMountTyre(t.id)} className="w-full text-left p-3 border border-gray-200 rounded cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <span className="block font-bold text-gray-800">{t.serial_number}</span>
                  <span className="flex justify-between text-xs mt-1">
                    <span className="text-gray-500">{t.tread_depth}mm</span>
                    <span className="text-gray-500">{t.virtual_mileage} km</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {inspectingTyre && (
        <div className="fixed top-0 left-0 w-full sm:w-80 h-full bg-white shadow-2xl border-r border-gray-200 p-6 z-50 flex flex-col transform transition-transform translate-x-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-800">{inspectingTyre.serial_number}</h3>
            <button type="button" onClick={() => setInspectingTyre(null)} className="text-gray-400 hover:text-black font-bold text-xl">X</button>
          </div>
          
          <div className="bg-gray-50 p-4 rounded mb-6 border border-gray-200 flex flex-col gap-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{inspectingTyre.position}</p>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <p className="text-3xl font-black text-gray-800">{inspectingTyre.tread_depth} <span className="text-base text-gray-500">mm</span></p>
                {inspectingTyre.current_psi && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">{inspectingTyre.current_psi} PSI</span>}
              </div>
              <button type="button" onClick={() => { setInspectingTyre(null); handleViewHistory(inspectingTyre); }} className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-2 rounded hover:bg-blue-200">History</button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="updateTread" className="block text-xs font-bold text-gray-600 mb-1">Update Tread & PSI</label>
              <div className="flex gap-2">
                <input id="updateTread" type="number" step="0.1" value={newTread} onChange={(e) => setNewTread(e.target.value)} className="w-20 border p-2 rounded text-sm outline-none focus:border-blue-500" placeholder="mm"/>
                <input type="number" value={newPsi} onChange={(e) => setNewPsi(e.target.value)} className="w-20 border p-2 rounded text-sm outline-none focus:border-blue-500" placeholder="PSI"/>
                <button type="button" onClick={() => handleLogInspection(inspectingTyre.id)} disabled={!newTread} className="flex-1 bg-gray-800 text-white rounded text-sm font-bold hover:bg-black disabled:opacity-50">Log</button>
              </div>
            </div>
            <hr className="my-4 border-gray-200"/>
            <button type="button" onClick={() => handleUnmountTyre(inspectingTyre.id, 'ON HAND')} className="w-full py-2.5 bg-blue-50 text-blue-700 font-bold text-sm rounded border border-blue-200 hover:bg-blue-100">Return to Yard</button>
            <button type="button" onClick={() => handleUnmountTyre(inspectingTyre.id, 'REPAIR')} className="w-full py-2.5 bg-yellow-50 text-yellow-700 font-bold text-sm rounded border border-yellow-200 hover:bg-yellow-100">Send to Repair</button>
            <button type="button" onClick={() => handleUnmountTyre(inspectingTyre.id, 'RECAP')} className="w-full py-2.5 bg-purple-50 text-purple-700 font-bold text-sm rounded border border-purple-200 hover:bg-purple-100">Send for Recap</button>
            <button type="button" onClick={() => handleUnmountTyre(inspectingTyre.id, 'SOLD')} className="w-full py-2.5 bg-gray-100 text-gray-800 font-bold text-sm rounded border border-gray-300 hover:bg-gray-200">Sell Casing</button>
            <button type="button" onClick={() => handleUnmountTyre(inspectingTyre.id, 'SCRAPPED')} className="w-full py-2.5 bg-red-50 text-red-700 font-bold text-sm rounded border border-red-200 hover:bg-red-100">Scrap Tyre</button>
          </div>
        </div>
      )}

      {historyPanelTyre && (
        <div className="fixed top-0 right-0 w-full sm:w-96 h-full bg-white shadow-2xl border-l border-gray-200 p-6 z-50 flex flex-col transform transition-transform translate-x-0">
          <div className="flex justify-between items-center mb-6">
            <div><h3 className="font-black text-xl text-gray-800">Tyre Passport</h3><p className="text-xs font-bold text-gray-500">S/N: {historyPanelTyre.serial_number}</p></div>
            <button type="button" onClick={() => setHistoryPanelTyre(null)} className="text-gray-400 hover:text-black font-bold text-xl">X</button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            {isLoadingHistory ? (
              <p className="text-center text-gray-500 italic mt-10">Pulling audit logs...</p>
            ) : tyreHistoryLogs.length === 0 ? (
              <div className="text-center mt-10"><p className="text-gray-500 italic">No historical actions logged.</p></div>
            ) : (
              <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                {tyreHistoryLogs.map((log) => (
                  <div key={log.id} className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-1.75 top-1.5 border-2 border-white"></div>
                    <p className="text-xs font-bold text-blue-600 mb-1">{new Date(log.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} <span className="text-gray-400 ml-2 font-normal">{new Date(log.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span></p>
                    <div className="bg-gray-50 p-3 rounded border border-gray-100 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-800 text-sm tracking-tight">{log.action}</span>
                          <button type="button" onClick={() => openHistoryEditModal(log)} className="text-[9px] bg-gray-200 text-gray-600 hover:bg-gray-300 px-1.5 py-0.5 rounded font-bold transition-colors">Edit</button>
                        </div>
                        <div className="flex gap-1">
                          {log.logged_psi && <span className="bg-blue-100 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold text-blue-800">{log.logged_psi} PSI</span>}
                          {log.logged_tread && <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold text-gray-600">{log.logged_tread} mm</span>}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">{log.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🚀 NEW: EDIT/DELETE MODAL */}
      {editingTyre && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gray-900 p-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-widest uppercase">Edit Tyre Record</h3>
              <button onClick={() => setEditingTyre(null)} className="text-gray-400 hover:text-white font-bold">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Brand</label>
                  <input type="text" value={editForm.brand} onChange={e => setEditForm({...editForm, brand: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-indigo-500 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Serial Number</label>
                  <input type="text" value={editForm.serial_number} onChange={e => setEditForm({...editForm, serial_number: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-indigo-500 outline-none font-black text-gray-800" />
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Price (ZAR)</label>
                  <input type="number" value={editForm.purchase_price} onChange={e => setEditForm({...editForm, purchase_price: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-indigo-500 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Orig. Tread (mm)</label>
                  <input type="number" step="0.1" value={editForm.original_tread} onChange={e => setEditForm({...editForm, original_tread: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:border-indigo-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
              <button onClick={() => handleDeleteTyre(editingTyre.id, editingTyre.serial_number)} className="text-red-500 hover:text-red-700 text-xs font-black uppercase tracking-widest border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 rounded transition-colors">
                Delete Asset
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingTyre(null)} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded transition-colors">Cancel</button>
                <button onClick={handleSaveEdit} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded shadow-md transition-colors">Save Updates</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 NEW: FUEL LOG EDIT/DELETE MODAL */}
      {editingFuelLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-70 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-500 p-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-widest uppercase text-sm">Edit Fuel Record</h3>
              <button onClick={() => setEditingFuelLog(null)} className="text-amber-100 hover:text-white font-bold text-xl leading-none">✕</button>
            </div>
            
            <div className="p-6 space-y-4 bg-amber-50/30">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dash Odometer (km)</label>
                <input type="number" value={fuelEditForm.odometer} onChange={e => setFuelEditForm({...fuelEditForm, odometer: e.target.value})} className="w-full p-2 border border-amber-200 rounded focus:border-amber-500 outline-none font-bold text-gray-800" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Volume Filled (L)</label>
                  <input type="number" step="0.1" value={fuelEditForm.volume} onChange={e => setFuelEditForm({...fuelEditForm, volume: e.target.value})} className="w-full p-2 border border-amber-200 rounded focus:border-amber-500 outline-none font-black text-amber-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Invoice Cost (R)</label>
                  <input type="number" step="0.1" value={fuelEditForm.cost} onChange={e => setFuelEditForm({...fuelEditForm, cost: e.target.value})} className="w-full p-2 border border-amber-200 rounded focus:border-amber-500 outline-none font-black text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
              <button onClick={() => handleDeleteFuelLog(editingFuelLog.id)} className="text-red-500 hover:text-red-700 text-xs font-black uppercase tracking-widest border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 rounded transition-colors">
                Delete Log
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingFuelLog(null)} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded transition-colors">Cancel</button>
                <button onClick={handleSaveFuelEdit} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded shadow-md transition-colors">Save Updates</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 NEW: HISTORY LOG EDIT/DELETE MODAL */}
      {editingHistoryLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-80 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-widest uppercase text-sm">Edit Audit Log</h3>
              <button onClick={() => setEditingHistoryLog(null)} className="text-blue-100 hover:text-white font-bold text-xl leading-none">✕</button>
            </div>
            
            <div className="p-6 space-y-4 bg-blue-50/30">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Action Notes / Details</label>
                <textarea value={historyEditForm.details} onChange={e => setHistoryEditForm({...historyEditForm, details: e.target.value})} className="w-full p-2 border border-blue-200 rounded focus:border-blue-500 outline-none text-sm text-gray-700 min-h-20" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tread (mm)</label>
                  <input type="number" step="0.1" value={historyEditForm.logged_tread} onChange={e => setHistoryEditForm({...historyEditForm, logged_tread: e.target.value})} className="w-full p-2 border border-blue-200 rounded focus:border-blue-500 outline-none font-black text-gray-800" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pressure (PSI)</label>
                  <input type="number" step="0.1" value={historyEditForm.logged_psi} onChange={e => setHistoryEditForm({...historyEditForm, logged_psi: e.target.value})} className="w-full p-2 border border-blue-200 rounded focus:border-blue-500 outline-none font-black text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
              <button onClick={() => handleDeleteHistoryLog(editingHistoryLog.id)} className="text-red-500 hover:text-red-700 text-xs font-black uppercase tracking-widest border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 rounded transition-colors">
                Delete Log
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingHistoryLog(null)} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded transition-colors">Cancel</button>
                <button onClick={handleSaveHistoryEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded shadow-md transition-colors">Save Updates</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 NEW: SCRAP REASON MODAL */}
      {scrapTyreTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-90 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-red-500">
            <div className="bg-red-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-widest uppercase text-sm flex items-center gap-2">
                ⚠️ Scrap Casing {scrapTyreTarget.tyre.serial_number}
              </h3>
              <button onClick={() => { setScrapTyreTarget(null); setScrapReason(''); }} className="text-red-200 hover:text-white font-bold text-xl leading-none">✕</button>
            </div>
            
            <div className="p-6 bg-red-50/30">
              <p className="text-sm font-bold text-gray-700 mb-4">
                This action will permanently move <span className="text-red-600 font-black">{scrapTyreTarget.tyre.serial_number}</span> to the Scrapped Ledger.
              </p>
              <div>
                <label className="block text-xs font-black text-red-800 uppercase tracking-widest mb-2">Reason for Scrapping *</label>
                <textarea 
                  placeholder="e.g. Irreparable sidewall blowout, run flat, reached absolute end of life..."
                  value={scrapReason} 
                  onChange={e => setScrapReason(e.target.value)} 
                  className="w-full p-3 border-2 border-red-200 rounded-lg focus:border-red-500 outline-none text-sm text-gray-800 font-medium min-h-25 shadow-inner" 
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setScrapTyreTarget(null); setScrapReason(''); }} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-200 rounded transition-colors">Cancel</button>
              <button onClick={executeScrapTyre} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded shadow-md transition-colors active:scale-95 uppercase tracking-widest">
                Confirm & Scrap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}