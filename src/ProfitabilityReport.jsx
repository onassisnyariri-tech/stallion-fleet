import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

export default function ProfitabilityReport({ companyId }) {
  const [reportData, setReportData] = useState(null);
  const [tripsList, setTripsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historicalFuelPrice, setHistoricalFuelPrice] = useState(22.50);

  const COLORS = [
    '#0891b2', '#06b6d4', '#22d3ee', '#67e8f9', '#0ea5e9', '#38bdf8', 
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#6366f1'
  ];

  useEffect(() => {
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const fetchReport = async () => {
    if (!companyId) return;
    setIsLoading(true);

    const { data: aggData } = await supabase
      .from('trip_profitability_report')
      .select('*')
      .eq('company_id', companyId)
      .single();

    const { data: rawTrips } = await supabase
      .from('trips')
      .select('*')
      .eq('company_id', companyId)
      .order('id', { ascending: false });

    if (aggData) setReportData(aggData);
    if (rawTrips) setTripsList(rawTrips);
    
    setIsLoading(false);
  };

  // NATIVE PRINT FUNCTION
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500 font-bold animate-pulse">Calculating Fleet Financials...</div>;
  }

  if (!reportData) {
    return (
      <div className="p-10 text-center text-gray-500 font-bold bg-gray-800 rounded-2xl border-2 border-gray-700 max-w-4xl mx-auto mt-10">
        No trips logged yet. Complete a trip in the dispatch tab to generate profitability reports.
      </div>
    );
  }

  let dynamicFuelCosts = {
    toLoad: 0, toDepot: 0, toBorder: 0, 
    toOffload: 0, returnBorder: 0, returnDepot: 0
  };

  tripsList.forEach(t => {
    const price = t.fuel_price_per_litre > 0 ? Number(t.fuel_price_per_litre) : historicalFuelPrice;
    dynamicFuelCosts.toLoad += Number(t.fuel_to_load || 0) * price;
    dynamicFuelCosts.toDepot += Number(t.fuel_to_depot || 0) * price;
    dynamicFuelCosts.toBorder += Number(t.fuel_to_border || 0) * price;
    dynamicFuelCosts.toOffload += Number(t.fuel_to_offload || 0) * price;
    dynamicFuelCosts.returnBorder += Number(t.fuel_return_border || 0) * price;
    dynamicFuelCosts.returnDepot += Number(t.fuel_return_depot || 0) * price;
  });

  const fullBreakdown = [
    { name: 'Fuel: To Loading', value: dynamicFuelCosts.toLoad },
    { name: 'Fuel: To Depot', value: dynamicFuelCosts.toDepot },
    { name: 'Fuel: To Border', value: dynamicFuelCosts.toBorder },
    { name: 'Fuel: To Offload', value: dynamicFuelCosts.toOffload },
    { name: 'Fuel: Ret. Border', value: dynamicFuelCosts.returnBorder },
    { name: 'Fuel: Ret. Depot', value: dynamicFuelCosts.returnDepot },
    { name: 'Tolls', value: Number(reportData.total_tolls || 0) },
    { name: 'Border Fees', value: Number(reportData.total_border_fees || 0) },
    { name: 'Driver Pay', value: Number(reportData.total_driver_costs || 0) },
    { name: 'Maintenance', value: Number(reportData.total_maintenance_apportioned || 0) },
    { name: 'Tyre Wear', value: Number(reportData.total_tyre_apportioned || 0) },
    { name: 'Overhead', value: Number(reportData.total_overhead_apportioned || 0) }
  ].filter(item => item.value > 0);

  const totalOperatingCost = fullBreakdown.reduce((sum, item) => sum + item.value, 0);
  const netProfit = Number(reportData.gross_revenue) - totalOperatingCost;
  const marginPercentage = reportData.gross_revenue > 0 ? ((netProfit / reportData.gross_revenue) * 100).toFixed(1) : 0;
  const trueOpCostPerKm = reportData.total_fleet_distance > 0 ? (totalOperatingCost / reportData.total_fleet_distance).toFixed(2) : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border-2 border-gray-700 p-4 rounded-xl shadow-2xl print:hidden">
          <p className="text-gray-300 font-bold uppercase text-xs tracking-wider mb-1">{payload[0].name}</p>
          <p className="text-white font-black text-xl">R {payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in font-sans pb-20 print:p-0 print:pb-0">
      
      <style>
        {`
          @media print {
            body { background-color: #111827 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            nav { display: none !important; }
            @page { margin: 10mm; }
          }
        `}
      </style>

      {/* HEADER SECTION */}
      <div className="mb-8 flex justify-between items-end border-b border-gray-700 pb-4 print:border-b-2 print:border-gray-500">
        <div>
          <h2 className="text-3xl font-black tracking-widest text-white uppercase border-l-4 border-indigo-500 pl-4">
            Financial Report
          </h2>
          <p className="text-gray-400 mt-2 text-sm font-bold tracking-wider">
            Aggregated from {reportData.total_trips_logged} trips | {Number(reportData.total_fleet_distance).toLocaleString()} Total KM
          </p>
        </div>
        
        <div className="flex gap-4 items-end print:hidden">
          <div className="bg-gray-800 border-2 border-cyan-800/50 p-2 rounded-xl">
            <label className="block text-[10px] font-bold text-cyan-400 uppercase mb-1">Historical Fuel Fallback (R/L)</label>
            <input 
              type="number" 
              value={historicalFuelPrice} 
              onChange={(e) => setHistoricalFuelPrice(Number(e.target.value))}
              className="w-full bg-gray-900 text-white p-2 border border-gray-700 rounded text-sm font-bold outline-none focus:border-cyan-500"
            />
          </div>
          <button 
            onClick={handlePrint} 
            className="bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest py-3 px-6 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all h-14 cursor-pointer"
          >
            <span>📄</span> SAVE PDF
          </button>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-2xl print:p-0 print:bg-transparent" style={{ minWidth: '1000px' }}> 
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-2xl border-2 border-gray-700 shadow-lg relative overflow-hidden print:border-gray-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Gross Revenue</p>
            <h3 className="text-4xl font-black text-white">R {Number(reportData.gross_revenue).toLocaleString()}</h3>
            <p className="text-green-400 text-sm font-bold mt-2 text-right">R {reportData.revenue_per_km} / km</p>
          </div>

          <div className="bg-gray-800 p-6 rounded-2xl border-2 border-gray-700 shadow-lg relative overflow-hidden print:border-gray-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Operating Costs</p>
            <h3 className="text-4xl font-black text-white">R {totalOperatingCost.toLocaleString()}</h3>
            <p className="text-red-400 text-sm font-bold mt-2 text-right">R {trueOpCostPerKm} / km</p>
          </div>

          <div className="bg-gray-800 p-6 rounded-2xl border-2 border-gray-700 shadow-lg relative overflow-hidden print:border-gray-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">Net Margin</p>
            <h3 className="text-4xl font-black text-white">R {netProfit.toLocaleString()}</h3>
            <p className="text-indigo-400 text-sm font-bold mt-2 text-right">{marginPercentage}% Margin</p>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl border-2 border-gray-700 shadow-lg mb-8 print:border-gray-500 print:break-inside-avoid">
          <h3 className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-6 border-b border-gray-700 pb-2 print:border-gray-500">Full Operating Margin Breakdown (ZAR)</h3>
          
          {fullBreakdown.length > 0 ? (
            <div className="flex justify-center items-center py-4">
              <PieChart width={700} height={400}>
                <Pie
                  data={fullBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={110}
                  outerRadius={150}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {fullBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  wrapperStyle={{ color: '#9ca3af', fontWeight: 'bold', fontSize: '12px' }}
                />
              </PieChart>
            </div>
          ) : (
            <div className="h-87.5 flex items-center justify-center">
              <p className="text-gray-500 font-bold">No cost data available yet.</p>
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl border-2 border-gray-700 shadow-lg mb-8 print:border-gray-500 print:break-inside-avoid">
          <h3 className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-4 border-b border-gray-700 pb-2 print:border-gray-500">Trip-by-Trip Financials (ZAR)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900 text-indigo-400 uppercase text-[10px] tracking-wider print:bg-gray-800">
                <tr>
                  <th className="p-3 rounded-tl-lg">Ref #</th>
                  <th className="p-3">Dist.</th>
                  <th className="p-3 text-green-400">Revenue</th>
                  <th className="p-3 text-cyan-400">Total Fuel</th>
                  <th className="p-3">Tolls</th>
                  <th className="p-3">Border</th>
                  <th className="p-3">Driver</th>
                  <th className="p-3">Maint</th>
                  <th className="p-3">Tyres</th>
                  <th className="p-3 rounded-tr-lg">Overhd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 print:divide-gray-500">
                {tripsList.map((t) => {
                  const activePrice = t.fuel_price_per_litre > 0 ? Number(t.fuel_price_per_litre) : historicalFuelPrice;
                  const tripTotalFuelCost = (Number(t.fuel_to_load || 0) + Number(t.fuel_to_depot || 0) + Number(t.fuel_to_border || 0) + Number(t.fuel_to_offload || 0) + Number(t.fuel_return_border || 0) + Number(t.fuel_return_depot || 0)) * activePrice;
                  
                  return (
                    <tr key={t.id} className="hover:bg-gray-750 transition-colors">
                      <td className="p-3 font-bold text-white">{t.trip_ref}</td>
                      <td className="p-3">{t.distance_km}</td>
                      <td className="p-3 text-green-400 font-bold">R{t.revenue}</td>
                      <td className="p-3 text-cyan-400 font-bold">R{tripTotalFuelCost || 0}</td>
                      <td className="p-3">R{t.cost_tolls}</td>
                      <td className="p-3">R{t.cost_border}</td>
                      <td className="p-3">R{t.cost_driver}</td>
                      <td className="p-3 text-gray-500">R{t.cost_maintenance}</td>
                      <td className="p-3 text-gray-500">R{t.cost_tyres}</td>
                      <td className="p-3 text-gray-500">R{t.cost_overhead}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-2xl border-2 border-cyan-900/50 shadow-lg print:border-gray-500 print:break-inside-avoid">
          <h3 className="text-cyan-400 font-bold text-sm uppercase tracking-widest mb-4 border-b border-gray-700 pb-2 print:border-gray-500">Trip-by-Trip Fuel Burn (Litres)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900 text-cyan-400 uppercase text-[10px] tracking-wider print:bg-gray-800">
                <tr>
                  <th className="p-3 rounded-tl-lg">Ref #</th>
                  <th className="p-3">To Loading</th>
                  <th className="p-3">To Depot</th>
                  <th className="p-3">To Border</th>
                  <th className="p-3">To Offload</th>
                  <th className="p-3">Ret. Border</th>
                  <th className="p-3">Ret. Depot</th>
                  <th className="p-3 rounded-tr-lg text-white font-bold bg-gray-700/30 print:bg-gray-600">Total (L)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 print:divide-gray-500">
                {tripsList.map((t) => {
                  const totalLitres = Number(t.fuel_to_load || 0) + Number(t.fuel_to_depot || 0) + Number(t.fuel_to_border || 0) + Number(t.fuel_to_offload || 0) + Number(t.fuel_return_border || 0) + Number(t.fuel_return_depot || 0);
                  return (
                    <tr key={`fuel-${t.id}`} className="hover:bg-gray-750 transition-colors">
                      <td className="p-3 font-bold text-white">{t.trip_ref}</td>
                      <td className="p-3">{t.fuel_to_load || 0} L</td>
                      <td className="p-3">{t.fuel_to_depot || 0} L</td>
                      <td className="p-3">{t.fuel_to_border || 0} L</td>
                      <td className="p-3">{t.fuel_to_offload || 0} L</td>
                      <td className="p-3">{t.fuel_return_border || 0} L</td>
                      <td className="p-3">{t.fuel_return_depot || 0} L</td>
                      <td className="p-3 font-bold text-white bg-gray-900/50 print:bg-gray-700">{totalLitres || 0} L</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div> 
    </div>
  );
}