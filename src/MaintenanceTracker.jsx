import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function MaintenanceTracker({ companyId }) {
  const [vehicles, setVehicles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  
  const [rosterSearch, setRosterSearch] = useState('');
  
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;
  
  // Form States
  const [newOdo, setNewOdo] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskCategory, setTaskCategory] = useState('ADMIN'); 
  
  // The KM / DATE tracking states
  const [trackingType, setTrackingType] = useState('KM'); 
  const [taskInterval, setTaskInterval] = useState(''); 
  const [taskLastOdo, setTaskLastOdo] = useState(''); 
  const [taskIntervalDays, setTaskIntervalDays] = useState(''); 
  const [taskLastDate, setTaskLastDate] = useState(''); 

  // 🚀 NEW: State for the "Log Done" Modal
  const [logDoneTarget, setLogDoneTarget] = useState(null);
  const [logDoneDate, setLogDoneDate] = useState('');
  const [logDoneOdo, setLogDoneOdo] = useState('');

  useEffect(() => {
    if (companyId) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]); 

  const fetchData = async () => {
    const { data: vData } = await supabase.from('vehicles').select('*').eq('company_id', companyId).order('fleet_number', { ascending: true });
    const { data: tData, error: tError } = await supabase.from('pm_tasks').select('*').eq('company_id', companyId);
    
    if (tError) console.error("Could not load tasks:", tError.message);
    
    if (vData) setVehicles(vData);
    if (tData) setTasks(tData);
  };

  const handleUpdateOdo = async () => {
    const numOdo = parseFloat(newOdo);
    setVehicles(prev => prev.map(v => v.id === selectedVehicleId ? { ...v, total_mileage: numOdo } : v));
    
    const { error } = await supabase.from('vehicles').update({ total_mileage: numOdo }).eq('id', selectedVehicleId);
    
    if (error) {
      fetchData(); 
      return alert(`DATABASE ERROR: Could not sync Odo.\n\nDetails: ${error.message}`);
    }
    
    setNewOdo('');
    fetchData();
  };

  const handleAddTask = async () => {
    const payload = {
      company_id: companyId,
      vehicle_id: selectedVehicleId,
      service_name: taskName,
      tracking_type: trackingType,
      category: taskCategory
    };

    if (trackingType === 'KM') {
      if (!taskInterval) return alert("Please set a KM interval.");
      payload.interval_km = parseFloat(taskInterval);
      payload.last_service_odo = taskLastOdo ? parseFloat(taskLastOdo) : (selectedVehicle.total_mileage || 0);
    } else {
      if (!taskIntervalDays) return alert("Please set an interval in days.");
      payload.interval_days = parseInt(taskIntervalDays);
      payload.last_service_date = taskLastDate || new Date().toISOString().split('T')[0];
    }
    
    const { error } = await supabase.from('pm_tasks').insert([payload]);

    if (error) return alert(`DATABASE ERROR: Could not add task.\n\nDetails: ${error.message}`);

    setTaskName(''); 
    setTaskCategory('ADMIN');
    setTaskInterval(''); setTaskLastOdo('');
    setTaskIntervalDays(''); setTaskLastDate('');
    fetchData();
  };

  // 🚀 NEW: Open the Modal instead of instantly processing
  const openLogDoneModal = (task) => {
    setLogDoneTarget(task);
    if (task.tracking_type === 'DATE') {
      setLogDoneDate(new Date().toISOString().split('T')[0]); // Default to today
    } else {
      setLogDoneOdo(selectedVehicle.total_mileage || 0); // Default to current dash odo
    }
  };

  // 🚀 NEW: Process the Modal submission
  const executeLogDone = async () => {
    let updatePayload = {};

    if (logDoneTarget.tracking_type === 'DATE') {
      if (!logDoneDate) return alert("Please select a completion date.");
      updatePayload.last_service_date = logDoneDate;
    } else {
      if (!logDoneOdo) return alert("Please enter the completion odometer.");
      updatePayload.last_service_odo = parseFloat(logDoneOdo);
    }

    const { error } = await supabase.from('pm_tasks').update(updatePayload).eq('id', logDoneTarget.id).eq('company_id', companyId);
    
    if (error) return alert(`DATABASE ERROR: Could not log service.\n\nDetails: ${error.message}`);
    
    setLogDoneTarget(null);
    fetchData();
  };

  const handleDeleteTask = async (taskId) => {
    if(!window.confirm("Permanently delete this tracking requirement?")) return;
    const { error } = await supabase.from('pm_tasks').delete().eq('id', taskId).eq('company_id', companyId);
    if (error) return alert("Database Error: " + error.message);
    fetchData();
  };

  const getTaskUrgency = (task) => {
    if (task.tracking_type === 'DATE') {
      const lastDate = new Date(task.last_service_date);
      const today = new Date();
      const nextDue = new Date(lastDate);
      nextDue.setDate(nextDue.getDate() + (task.interval_days || 0));
      
      const diffTime = nextDue - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return { level: 'OVERDUE', days: diffDays, color: 'border-red-500 bg-red-50 text-red-800', bar: 'bg-red-500' };
      if (diffDays <= 14) return { level: 'ACTION', days: diffDays, color: 'border-yellow-500 bg-yellow-50 text-yellow-800', bar: 'bg-yellow-500' };
      return { level: 'OK', days: diffDays, color: 'border-green-500 bg-green-50 text-green-800', bar: 'bg-green-500' };
    } else {
      const currentOdo = selectedVehicle?.total_mileage || 0;
      const nextDue = (task.last_service_odo || 0) + (task.interval_km || 0);
      const kmRemaining = nextDue - currentOdo;

      if (kmRemaining < 0) return { level: 'OVERDUE', km: kmRemaining, color: 'border-red-500 bg-red-50 text-red-800', bar: 'bg-red-500' };
      if (kmRemaining <= 500) return { level: 'ACTION', km: kmRemaining, color: 'border-yellow-500 bg-yellow-50 text-yellow-800', bar: 'bg-yellow-500' };
      return { level: 'OK', km: kmRemaining, color: 'border-green-500 bg-green-50 text-green-800', bar: 'bg-green-500' };
    }
  };

  const vehicleTasks = tasks.filter(t => String(t.vehicle_id) === String(selectedVehicleId));
  const adminTasks = vehicleTasks.filter(t => !t.category || String(t.category).toUpperCase() === 'ADMIN');
  const mechTasks = vehicleTasks.filter(t => String(t.category).toUpperCase() === 'MECHANICAL');

  const renderTaskCard = (task) => {
    const isDate = task.tracking_type === 'DATE';
    const urgency = getTaskUrgency(task);
    
    let percentUsed = 0;
    let remainingStr = '';
    let subtextStr = '';

    if (isDate) {
      const totalDays = task.interval_days || 1;
      const daysPassed = totalDays - urgency.days;
      percentUsed = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
      remainingStr = urgency.level === 'OVERDUE' ? 'OVERDUE' : `${urgency.days} days`;
      subtextStr = urgency.level === 'OVERDUE' ? `By ${Math.abs(urgency.days)} days` : 'Remaining';
    } else {
      percentUsed = Math.min(100, Math.max(0, (((selectedVehicle.total_mileage || 0) - (task.last_service_odo || 0)) / (task.interval_km || 1)) * 100));
      remainingStr = urgency.level === 'OVERDUE' ? 'OVERDUE' : `${urgency.km.toLocaleString()} km`;
      subtextStr = urgency.level === 'OVERDUE' ? `By ${Math.abs(urgency.km).toLocaleString()} km` : 'Remaining';
    }

    return (
      <div key={task.id} className={`p-4 border-l-4 rounded shadow-sm relative overflow-hidden ${urgency.color}`}>
        {(urgency.level === 'OVERDUE' || urgency.level === 'ACTION') && (
          <div className={`absolute top-0 right-0 ${urgency.level === 'OVERDUE' ? 'bg-red-600' : 'bg-yellow-500'} text-white text-[9px] font-black px-2 py-0.5 rounded-bl uppercase tracking-widest animate-pulse shadow-sm`}>
            {urgency.level === 'OVERDUE' ? 'CRITICAL' : 'ACTION REQUIRED'}
          </div>
        )}
        <div className="flex justify-between items-start mb-2 mt-1">
          <div>
            <h4 className="font-black text-lg">{task.service_name}</h4>
            {isDate ? (
               <p className="text-xs opacity-80">Interval: {task.interval_days} Days | Last: {task.last_service_date}</p>
            ) : (
               <p className="text-xs opacity-80">Interval: {task.interval_km} km | Last: {task.last_service_odo} km</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-black text-xl">{remainingStr}</p>
            <p className="text-[10px] uppercase font-bold opacity-80">{subtextStr}</p>
          </div>
        </div>
        
        <div className="w-full h-2 bg-black/10 rounded-full mt-2 mb-3 overflow-hidden">
          <div className={`h-full ${urgency.bar} transition-all`} style={{ width: `${percentUsed}%` }}></div>
        </div>

        <div className="flex justify-between items-center mt-3">
          <button onClick={() => handleDeleteTask(task.id)} className="text-[10px] text-gray-500 hover:text-red-600 uppercase font-bold tracking-widest">Remove</button>
          <button onClick={() => openLogDoneModal(task)} className="text-xs bg-white border border-current px-3 py-1.5 rounded font-bold hover:bg-black hover:text-white hover:border-black transition-colors shadow-sm">
            Log Done...
          </button>
        </div>
      </div>
    );
  };

  const filteredVehicles = vehicles.filter(v => 
    (v.fleet_number?.toLowerCase() || '').includes(rosterSearch.toLowerCase()) ||
    (v.type?.toLowerCase() || '').includes(rosterSearch.toLowerCase()) ||
    (v.asset_type?.toLowerCase() || '').includes(rosterSearch.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 animate-fade-in w-full flex flex-col md:flex-row gap-6">
      
      {/* LEFT COLUMN: VEHICLE ROSTER */}
      <div className="w-full md:w-1/3 lg:w-1/4 bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-fit">
        <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
          <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Fleet Roster</h3>
          <button onClick={fetchData} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-1 px-2 rounded transition-colors">
            ↻ Sync
          </button>
        </div>

        <div className="mb-3 relative">
          <input 
            type="text" 
            placeholder="Search unit (e.g. DAF or FLT)..." 
            value={rosterSearch}
            onChange={(e) => setRosterSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-gray-50"
          />
          <span className="absolute left-2.5 top-2 text-gray-400">🔍</span>
        </div>

        <div className="space-y-2 max-h-137.5 overflow-y-auto pr-1">
          {filteredVehicles.length === 0 ? (
             <p className="text-xs text-gray-400 italic text-center py-4">No assets found matching "{rosterSearch}"</p>
          ) : (
            filteredVehicles.map(v => (
              <div 
                key={v.id} 
                onClick={() => setSelectedVehicleId(v.id)}
                className={`p-3 border rounded cursor-pointer transition-all ${selectedVehicleId === v.id ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="font-bold text-gray-900">{v.fleet_number}</p>
                <p className="text-xs text-gray-500 uppercase">{v.type || v.asset_type}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: PM DASHBOARD */}
      <div className="flex-1 space-y-6">
        {!selectedVehicle ? (
          <div className="bg-white p-10 text-center rounded-lg border border-gray-200 text-gray-400 italic">
            Select a unit from the roster to view its Preventative Maintenance schedule.
          </div>
        ) : (
          <>
            {/* ODOMETER UPDATE */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-sm text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-widest">{selectedVehicle.fleet_number}</h2>
                <p className="text-gray-400 text-sm">Current Dash Odometer: <span className="font-bold text-white">{selectedVehicle.total_mileage || 0} km</span></p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <input type="number" value={newOdo} onChange={e => setNewOdo(e.target.value)} placeholder="Update Odo..." className="p-2 rounded text-black text-sm flex-1 md:w-32 outline-none focus:ring-2 focus:ring-teal-500" />
                <button onClick={handleUpdateOdo} disabled={!newOdo} className="bg-teal-500 px-4 py-2 rounded font-bold hover:bg-teal-600 disabled:opacity-50 transition-colors text-white">Sync</button>
              </div>
            </div>

            {/* ADD NEW TASK FORM */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-end mb-4 border-b border-gray-100 pb-3">
                <h4 className="font-black text-gray-800 uppercase tracking-widest text-sm">Add Tracking Requirement</h4>
                
                <div className="flex bg-gray-100 p-1 rounded border border-gray-200">
                  <button onClick={() => setTrackingType('KM')} className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-black rounded ${trackingType === 'KM' ? 'bg-teal-600 text-white' : 'text-gray-500'}`}>Distance (KM)</button>
                  <button onClick={() => setTrackingType('DATE')} className={`px-3 py-1.5 text-[10px] uppercase tracking-widest font-black rounded ${trackingType === 'DATE' ? 'bg-teal-600 text-white' : 'text-gray-500'}`}>Calendar (Date)</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <select value={taskCategory} onChange={e=>setTaskCategory(e.target.value)} className="border p-2.5 rounded text-sm outline-none focus:border-teal-500 font-bold text-gray-700 bg-gray-50">
                  <option value="ADMIN">Administrative (Permits, COF)</option>
                  <option value="MECHANICAL">Mechanical (Service, Align)</option>
                </select>
                
                <input type="text" placeholder="Requirement Name (e.g. CVG or Oil)" value={taskName} onChange={e=>setTaskName(e.target.value)} className="border p-2.5 rounded text-sm outline-none focus:border-teal-500" />
                
                {trackingType === 'KM' ? (
                  <>
                    <input type="number" placeholder="Interval (km)" value={taskInterval} onChange={e=>setTaskInterval(e.target.value)} className="border p-2.5 rounded text-sm outline-none focus:border-teal-500" />
                    <input type="number" placeholder="Last Done (Odo)" value={taskLastOdo} onChange={e=>setTaskLastOdo(e.target.value)} className="border p-2.5 rounded text-sm outline-none focus:border-teal-500" />
                  </>
                ) : (
                  <>
                    <input type="number" placeholder="Interval (Days)" value={taskIntervalDays} onChange={e=>setTaskIntervalDays(e.target.value)} className="border p-2.5 rounded text-sm outline-none focus:border-teal-500" />
                    <input type="date" value={taskLastDate} onChange={e=>setTaskLastDate(e.target.value)} className="border p-2.5 rounded text-sm outline-none focus:border-teal-500 text-gray-600" />
                  </>
                )}
              </div>
              <div className="flex justify-end">
                <button onClick={handleAddTask} disabled={!taskName} className="bg-gray-800 text-white px-6 py-2.5 rounded text-sm font-bold hover:bg-black disabled:opacity-50 transition-colors uppercase tracking-widest">Save Tracker</button>
              </div>
            </div>

            {/* SPLIT LISTS: ADMIN vs MECHANICAL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-fit">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  <div>
                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Administrative</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">COF, Permits, CVG</p>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-4 bg-gray-50/50">
                  {adminTasks.length === 0 ? <p className="text-sm text-gray-400 italic text-center py-4">No admin tasks assigned.</p> : null}
                  {adminTasks.map(renderTaskCard)}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-fit">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-xl">🔧</span>
                  <div>
                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Mechanical</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Servicing, Oil, Alignments</p>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-4 bg-gray-50/50">
                  {mechTasks.length === 0 ? <p className="text-sm text-gray-400 italic text-center py-4">No mechanical tasks assigned.</p> : null}
                  {mechTasks.map(renderTaskCard)}
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      {/* 🚀 NEW: LOG DONE MODAL */}
      {logDoneTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in text-gray-900">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-teal-500">
            <div className="bg-teal-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-widest uppercase text-sm">
                Log Requirement Complete
              </h3>
              <button onClick={() => setLogDoneTarget(null)} className="text-teal-200 hover:text-white font-bold text-xl leading-none">✕</button>
            </div>
            
            <div className="p-6 bg-teal-50/30">
              <h4 className="font-black text-lg text-gray-800 mb-2">{logDoneTarget.service_name}</h4>
              <p className="text-sm text-gray-600 mb-4">
                Confirm the exact {logDoneTarget.tracking_type === 'DATE' ? 'date' : 'odometer'} this requirement was fulfilled to reset the tracking interval.
              </p>

              {logDoneTarget.tracking_type === 'DATE' ? (
                <div>
                  <label className="block text-xs font-black text-teal-800 uppercase tracking-widest mb-2">Completion Date *</label>
                  <input 
                    type="date" 
                    value={logDoneDate} 
                    onChange={e => setLogDoneDate(e.target.value)} 
                    className="w-full p-3 border-2 border-teal-200 rounded-lg focus:border-teal-500 outline-none text-sm text-gray-800 font-bold bg-white shadow-inner" 
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-black text-teal-800 uppercase tracking-widest mb-2">Completion Odometer (km) *</label>
                  <input 
                    type="number" 
                    value={logDoneOdo} 
                    onChange={e => setLogDoneOdo(e.target.value)} 
                    className="w-full p-3 border-2 border-teal-200 rounded-lg focus:border-teal-500 outline-none text-sm text-gray-800 font-bold bg-white shadow-inner" 
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setLogDoneTarget(null)} className="px-4 py-2 text-gray-500 font-bold text-sm hover:bg-gray-200 rounded transition-colors">Cancel</button>
              <button onClick={executeLogDone} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-black text-sm rounded shadow-md transition-colors active:scale-95 uppercase tracking-widest">
                Save & Reset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}