import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';

export default function ExecutiveDashboard({ companyId }) {
  const [trips, setTrips] = useState([]);
  const [tyres, setTyres] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [timeFilter, setTimeFilter] = useState('ALL'); // 'MONTH', 'QUARTER', 'YEAR', 'ALL', 'CUSTOM'
  
  // 🚀 NEW: Custom Date Range State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function loadGlobalData() {
      if (!companyId) return;
      
      setIsLoading(true);
      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .eq('company_id', companyId) 
        .order('created_at', { ascending: false });
        
      const { data: tyreData } = await supabase
        .from('tyres')
        .select('*')
        .eq('company_id', companyId); 
      
      if (tripData) setTrips(tripData);
      if (tyreData) setTyres(tyreData);
      setIsLoading(false);
    }
    loadGlobalData();
  }, [companyId]);

  // 🚀 UPDATED: Filter the trips instantly based on the selected time period OR custom range
  const filteredTrips = useMemo(() => {
    if (timeFilter === 'ALL') return trips;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3);

    return trips.filter(t => {
      const entryDate = new Date(t.created_at || t.log_date); 
      
      if (timeFilter === 'YEAR') {
        return entryDate.getFullYear() === currentYear;
      }
      if (timeFilter === 'QUARTER') {
        return entryDate.getFullYear() === currentYear && Math.floor(entryDate.getMonth() / 3) === currentQuarter;
      }
      if (timeFilter === 'MONTH') {
        return entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth;
      }
      
      // 🚀 NEW: Custom Range Logic
      if (timeFilter === 'CUSTOM') {
        // If they haven't picked both dates yet, don't filter anything out
        if (!startDate || !endDate) return true; 
        
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start at the very beginning of the day
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End at the very last millisecond of the day
        
        return entryDate >= start && entryDate <= end;
      }
      
      return true;
    });
  }, [trips, timeFilter, startDate, endDate]);

  // --- FINANCIAL CALCULATIONS (GLOBAL) ---
  const safeNum = (val) => parseFloat(val) || 0;

  const totalRevenue = filteredTrips.reduce((sum, t) => sum + safeNum(t.revenue), 0);
  
  const totalFuelCost = filteredTrips.reduce((sum, t) => {
    const litres = safeNum(t.fuel_to_load) + safeNum(t.fuel_to_depot) + safeNum(t.fuel_to_border) + 
                   safeNum(t.fuel_to_offload) + safeNum(t.fuel_return_border) + safeNum(t.fuel_return_depot);
    return sum + (litres * safeNum(t.fuel_price_per_litre));
  }, 0);

  const totalOperatingCost = filteredTrips.reduce((sum, t) => {
    return sum + safeNum(t.cost_tolls) + safeNum(t.cost_border) + safeNum(t.cost_maintenance) + 
           safeNum(t.cost_tyres) + safeNum(t.cost_driver) + safeNum(t.cost_overhead);
  }, 0);

  const globalTotalCost = totalFuelCost + totalOperatingCost;
  const globalNetProfit = totalRevenue - globalTotalCost;
  const globalMargin = totalRevenue > 0 ? ((globalNetProfit / totalRevenue) * 100).toFixed(1) : 0;

  // --- FLEET HEALTH CALCULATIONS (Current Snapshot) ---
  const activeTyres = tyres.filter(t => t.status === 'ACTIVE');
  const criticalTyres = activeTyres.filter(t => t.tread_depth < 3.0); 
  const totalTyreAssetValue = tyres.reduce((sum, t) => sum + safeNum(t.purchase_price) + safeNum(t.repair_cost), 0);

  const globalTyreMileage = tyres.reduce((sum, t) => sum + safeNum(t.virtual_mileage), 0);
  const globalCPK = globalTyreMileage > 0 ? (totalTyreAssetValue / globalTyreMileage).toFixed(4) : 0;

  if (isLoading) return <div className="p-10 text-center text-gray-500 font-bold animate-pulse">Syncing Enterprise Data...</div>;

  return (
    <div className="p-6 animate-fade-in max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Executive Summary</h1>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Live Global Analytics</p>
        </div>
        
        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
          
          {/* THE TIME SEGMENTED CONTROL */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <div className="flex bg-gray-100 p-1 rounded border border-gray-200 shadow-inner w-full md:w-auto">
              {['MONTH', 'QUARTER', 'YEAR', 'ALL', 'CUSTOM'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-all ${
                    timeFilter === filter 
                      ? 'bg-gray-900 text-white shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {filter === 'ALL' ? 'Total' : filter === 'MONTH' ? 'This Month' : filter === 'QUARTER' ? 'This QTR' : filter === 'CUSTOM' ? 'Custom' : 'This Year'}
                </button>
              ))}
            </div>

            {/* 🚀 NEW: The Custom Date Inputs (Only shows when CUSTOM is selected) */}
            {timeFilter === 'CUSTOM' && (
              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded border border-gray-200 animate-fade-in w-full md:w-auto">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="p-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded outline-none focus:border-indigo-500" 
                />
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">To</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="p-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded outline-none focus:border-indigo-500" 
                />
              </div>
            )}
          </div>

          <div className="text-right hidden md:block mt-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Trips in Period</p>
            <p className="text-xl font-black text-indigo-600 leading-none">{filteredTrips.length}</p>
          </div>
        </div>
      </div>

      {/* TIER 1: THE FINANCIAL GOD-VIEW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-green-500">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Gross Fleet Revenue</p>
          <p className="text-3xl font-black text-gray-800">R {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-red-400">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Total Operating Costs</p>
          <p className="text-3xl font-black text-gray-800">R {globalTotalCost.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-blue-500">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Global Net Profit</p>
          <p className={`text-3xl font-black ${globalNetProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            R {globalNetProfit.toLocaleString()}
          </p>
        </div>
        <div className={`p-6 rounded-xl shadow-sm border-2 flex flex-col justify-center items-center ${globalMargin >= 15 ? 'bg-green-50 border-green-500' : globalMargin > 0 ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'}`}>
          <p className="text-xs font-bold text-gray-600 uppercase mb-1 tracking-wider">Global Profit Margin</p>
          <p className={`text-4xl font-black ${globalMargin >= 15 ? 'text-green-700' : globalMargin > 0 ? 'text-yellow-700' : 'text-red-700'}`}>
            {globalMargin}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* TIER 2: FLEET ASSET HEALTH */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">Rubber Asset Health</h3>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Assets</p>
              <p className="text-2xl font-black text-gray-800">{tyres.length} <span className="text-sm font-normal text-gray-500">Units</span></p>
              <p className="text-xs text-gray-400 mt-1">Value: R {totalTyreAssetValue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Global CPK</p>
              <p className="text-2xl font-black text-indigo-600">R {globalCPK}</p>
              <p className="text-xs text-gray-400 mt-1">Across {globalTyreMileage.toLocaleString()} km</p>
            </div>
            
            <div className="col-span-2 bg-red-50 p-4 rounded border border-red-100 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-red-800 uppercase tracking-wider mb-1">Critical Action Required</p>
                <p className="text-xs text-red-600">Active tyres operating under 3.0mm tread depth</p>
              </div>
              <div className="bg-white border-2 border-red-500 text-red-600 font-black text-2xl w-14 h-14 flex items-center justify-center rounded-full shadow-sm animate-pulse">
                {criticalTyres.length}
              </div>
            </div>
          </div>
        </div>

        {/* TIER 3: RECENT TRIP LEDGER */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Recent Trip Financials</h3>
            {timeFilter !== 'ALL' && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Filtered</span>}
          </div>
          <div className="flex-1 overflow-y-auto max-h-75">
            {filteredTrips.length === 0 ? (
              <p className="p-6 text-center text-gray-400 italic font-medium">No trips found in this period.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 border-b border-gray-100">
                  <tr className="text-[10px] uppercase text-gray-400">
                    <th className="p-3 font-bold">Reference</th>
                    <th className="p-3 font-bold">Revenue</th>
                    <th className="p-3 font-bold">Profit</th>
                    <th className="p-3 font-bold text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.slice(0, 5).map(trip => {
                    const tripFuelCost = (safeNum(trip.fuel_to_load) + safeNum(trip.fuel_to_depot) + safeNum(trip.fuel_to_border) + safeNum(trip.fuel_to_offload) + safeNum(trip.fuel_return_border) + safeNum(trip.fuel_return_depot)) * safeNum(trip.fuel_price_per_litre);
                    const tripOther = safeNum(trip.cost_tolls) + safeNum(trip.cost_border) + safeNum(trip.cost_maintenance) + safeNum(trip.cost_tyres) + safeNum(trip.cost_driver) + safeNum(trip.cost_overhead);
                    const net = safeNum(trip.revenue) - (tripFuelCost + tripOther);
                    const margin = safeNum(trip.revenue) > 0 ? ((net / safeNum(trip.revenue)) * 100).toFixed(1) : 0;
                    
                    return (
                      <tr key={trip.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="p-3 text-xs font-black text-gray-800">{trip.trip_ref}</td>
                        <td className="p-3 text-xs font-bold text-gray-600">R {safeNum(trip.revenue).toLocaleString()}</td>
                        <td className={`p-3 text-xs font-black ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>R {net.toLocaleString()}</td>
                        <td className="p-3 text-xs font-bold text-right">
                          <span className={`px-2 py-1 rounded ${margin >= 15 ? 'bg-green-100 text-green-700' : margin > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}