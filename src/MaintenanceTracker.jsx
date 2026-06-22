import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function MaintenanceTracker({ companyId }) { // <-- Added SaaS Prop
  const [vehicles, setVehicles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;
  
  // Form States
  const [newOdo, setNewOdo] = useState('');
  const [taskName, setTaskName] = useState('');
  
  // NEW: The KM / DATE tracking states
  const [trackingType, setTrackingType] = useState('KM'); // 'KM' or 'DATE'
  const [taskInterval, setTaskInterval] = useState(''); // Used for KM
  const [taskLastOdo, setTaskLastOdo] = useState(''); // Used for KM
  const [taskIntervalDays, setTaskIntervalDays] = useState(''); // Used for Date
  const [taskLastDate, setTaskLastDate] = useState(''); // Used for Date

  // Re-run whenever the companyId loads or changes
  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]); 

  const fetchData = async () => {
    // Lock the fetches to only Stallion Trucking data
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
      company_id: companyId, // <-- The magic SaaS key!
      vehicle_id: selectedVehicleId,
      service_name: taskName,
      tracking_type: trackingType
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
    setTaskInterval(''); setTaskLastOdo('');
    setTaskIntervalDays(''); setTaskLastDate('');
    fetchData();
  };

  const handleLogServiceDone = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    let updatePayload = {};

    if (task.tracking_type === 'DATE') {
      updatePayload.last_service_date = new Date().toISOString().split('T')[0];
    } else {
      updatePayload.last_service_odo = selectedVehicle.total_mileage;
    }

    const { error } = await supabase.from('pm_tasks').update(updatePayload).eq('id', taskId);
    
    if (error) return alert(`DATABASE ERROR: Could not log service.\n\nDetails: ${error.message}`);
    fetchData();
  };

  const vehicleTasks = tasks.filter(t => t.vehicle_id === selectedVehicleId);

  return (
    <div className="p-6 animate-fade-in max-w-6xl mx-auto flex flex-col md:flex-row gap-6">
      
      {/* LEFT COLUMN: VEHICLE ROSTER */}
      <div className="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-fit">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
          <h3 className="font-black text-gray-800">Fleet Roster</h3>
          <button onClick={fetchData} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-1 px-2 rounded transition-colors">
            ↻ Sync Live Data
          </button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {vehicles.map(v => (
            <div 
              key={v.id} 
              onClick={() => setSelectedVehicleId(v.id)}
              className={`p-3 border rounded cursor-pointer transition-all ${selectedVehicleId === v.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <p className="font-bold text-gray-900">{v.fleet_number}</p>
              <p className="text-xs text-gray-500 uppercase">{v.type}</p>
            </div>
          ))}
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
                <h2 className="text-2xl font-black">{selectedVehicle.fleet_number}</h2>
                <p className="text-gray-400 text-sm">Current Odometer: <span className="font-bold text-white">{selectedVehicle.total_mileage || 0} km</span></p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <input type="number" value={newOdo} onChange={e => setNewOdo(e.target.value)} placeholder="New Odo..." className="p-2 rounded text-black text-sm flex-1 md:w-32 outline-none focus:ring-2 focus:ring-orange-500" />
                <button onClick={handleUpdateOdo} disabled={!newOdo} className="bg-orange-500 px-4 py-2 rounded font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors">Sync</button>
              </div>
            </div>

            {/* SERVICE LIST */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-black text-gray-800 mb-6">Service Requirements</h3>
              
              <div className="space-y-4 mb-8">
                {vehicleTasks.length === 0 ? <p className="text-sm text-gray-500 italic">No PM tasks assigned to this unit yet.</p> : null}
                
                {vehicleTasks.map(task => {
                  const isDate = task.tracking_type === 'DATE';
                  
                  let statusColor = 'border-green-500 bg-green-50 text-green-800';
                  let barColor = 'bg-green-500';
                  let percentUsed = 0;
                  let remainingStr = '';
                  let subtextStr = '';
                  let overdue = false;

                  if (isDate) {
                    const lastDate = new Date(task.last_service_date);
                    const today = new Date();
                    const nextDue = new Date(lastDate);
                    nextDue.setDate(nextDue.getDate() + (task.interval_days || 0));
                    
                    const diffTime = nextDue - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const totalDays = task.interval_days || 1;
                    const daysPassed = totalDays - diffDays;
                    
                    percentUsed = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
                    overdue = diffDays < 0;

                    if (diffDays < 0) { statusColor = 'border-red-500 bg-red-50 text-red-800'; barColor = 'bg-red-500'; }
                    else if (diffDays <= 14) { statusColor = 'border-yellow-500 bg-yellow-50 text-yellow-800'; barColor = 'bg-yellow-500'; }

                    remainingStr = overdue ? 'OVERDUE' : `${diffDays} days`;
                    subtextStr = overdue ? `By ${Math.abs(diffDays)} days` : 'Remaining';

                  } else {
                    // It's a KM task (or older legacy task without tracking_type)
                    const currentOdo = selectedVehicle.total_mileage || 0;
                    const nextDue = (task.last_service_odo || 0) + (task.interval_km || 0);
                    const kmRemaining = nextDue - currentOdo;
                    
                    percentUsed = Math.min(100, Math.max(0, ((currentOdo - (task.last_service_odo || 0)) / (task.interval_km || 1)) * 100));
                    overdue = kmRemaining < 0;

                    if (kmRemaining < 0) { statusColor = 'border-red-500 bg-red-50 text-red-800'; barColor = 'bg-red-500'; }
                    else if (kmRemaining < 5000) { statusColor = 'border-yellow-500 bg-yellow-50 text-yellow-800'; barColor = 'bg-yellow-500'; }

                    remainingStr = overdue ? 'OVERDUE' : `${kmRemaining.toLocaleString()} km`;
                    subtextStr = overdue ? `By ${Math.abs(kmRemaining).toLocaleString()} km` : 'Remaining';
                  }

                  return (
                    <div key={task.id} className={`p-4 border-l-4 rounded shadow-sm ${statusColor}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-black text-lg">{task.service_name}</h4>
                          {isDate ? (
                             <p className="text-xs opacity-80">Interval: {task.interval_days} Days | Last Checked: {task.last_service_date}</p>
                          ) : (
                             <p className="text-xs opacity-80">Interval: {task.interval_km} km | Last Done: {task.last_service_odo} km</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-black text-xl">{remainingStr}</p>
                          <p className="text-[10px] uppercase font-bold opacity-80">{subtextStr}</p>
                        </div>
                      </div>
                      
                      <div className="w-full h-2 bg-white/50 rounded-full mt-2 mb-3 overflow-hidden">
                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${percentUsed}%` }}></div>
                      </div>

                      <button onClick={() => handleLogServiceDone(task.id)} className="text-xs bg-white border border-current px-3 py-1.5 rounded font-bold hover:bg-black hover:text-white hover:border-black transition-colors">
                        Log Done (Reset to {isDate ? 'Today' : 'Current Odo'})
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* ADD NEW TASK FORM */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex justify-between items-end mb-3">
                  <h4 className="font-bold text-gray-600 text-sm">Add New PM Requirement</h4>
                  
                  {/* KM vs DATE TOGGLE */}
                  <div className="flex bg-gray-100 p-1 rounded border border-gray-200">
                    <button onClick={() => setTrackingType('KM')} className={`px-3 py-1 text-xs font-bold rounded ${trackingType === 'KM' ? 'bg-orange-500 text-white' : 'text-gray-500'}`}>KM Tracked</button>
                    <button onClick={() => setTrackingType('DATE')} className={`px-3 py-1 text-xs font-bold rounded ${trackingType === 'DATE' ? 'bg-orange-500 text-white' : 'text-gray-500'}`}>Date Tracked</button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                  <input type="text" placeholder="Task Name (e.g. Engine Oil)" value={taskName} onChange={e=>setTaskName(e.target.value)} className="flex-1 border p-2 rounded text-sm outline-none focus:border-orange-500" />
                  
                  {trackingType === 'KM' ? (
                    <>
                      <input type="number" placeholder="Interval (km)" value={taskInterval} onChange={e=>setTaskInterval(e.target.value)} className="md:w-32 border p-2 rounded text-sm outline-none focus:border-orange-500" />
                      <input type="number" placeholder="Last Done (Odo)" value={taskLastOdo} onChange={e=>setTaskLastOdo(e.target.value)} className="md:w-36 border p-2 rounded text-sm outline-none focus:border-orange-500" />
                    </>
                  ) : (
                    <>
                      <input type="number" placeholder="Interval (Days)" value={taskIntervalDays} onChange={e=>setTaskIntervalDays(e.target.value)} className="md:w-32 border p-2 rounded text-sm outline-none focus:border-orange-500" />
                      <input type="date" value={taskLastDate} onChange={e=>setTaskLastDate(e.target.value)} className="md:w-36 border p-2 rounded text-sm outline-none focus:border-orange-500 text-gray-600" />
                    </>
                  )}
                  
                  <button onClick={handleAddTask} disabled={!taskName} className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-black disabled:opacity-50 transition-colors">Add Task</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}