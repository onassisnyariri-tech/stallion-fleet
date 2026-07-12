import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function BrandWearComparison({ companyId }) {
  const [wearData, setWearData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (companyId) fetchWearData();
  }, [companyId]);

  const fetchWearData = async () => {
    setIsLoading(true);
    
    // 🚀 UPDATED: Pulling the exact columns from your schema
    const { data: tyres, error } = await supabase
      .from('tyres')
      .select('brand, serial_number, tread_depth, original_tread, virtual_mileage') 
      .eq('company_id', companyId);

    if (error) {
       console.error("Failed to fetch tyre data:", error.message);
       setIsLoading(false);
       return;
    }

    const brandStats = {};

    tyres.forEach(tyre => {
      // 🚀 Clever Fallback: If 'brand' is empty, check if it was typed into 'serial_number'
      let brandName = tyre.brand ? tyre.brand.trim() : '';
      if (!brandName && tyre.serial_number) {
         // Assuming if the serial is text like "Armorsteel", use that. Otherwise, "UNKNOWN"
         brandName = isNaN(tyre.serial_number) ? tyre.serial_number.trim() : 'UNKNOWN BRAND';
      } else if (!brandName) {
         brandName = 'UNKNOWN BRAND';
      }
      
      const startTread = tyre.original_tread || 20; // Default to 20mm if missing
      const currentTread = tyre.tread_depth || 0;
      const distance = tyre.virtual_mileage || 0; // 🚀 UPDATED: Using your exact column

      const treadWorn = startTread - currentTread;

      // Only calculate if the tyre has actually rolled and lost rubber
      if (distance > 0 && treadWorn > 0) {
        if (!brandStats[brandName]) {
          brandStats[brandName] = { totalWorn: 0, totalDistance: 0, count: 0 };
        }
        brandStats[brandName].totalWorn += treadWorn;
        brandStats[brandName].totalDistance += distance;
        brandStats[brandName].count += 1;
      }
    });

    // Calculate Final Standardized Rate (mm worn per 10,000 km)
    const processedData = Object.keys(brandStats).map(brand => {
      const stats = brandStats[brand];
      const wearRate = (stats.totalWorn / stats.totalDistance) * 10000;
      
      return {
        brand: brand.toUpperCase(),
        sampleSize: stats.count,
        wearRate: parseFloat(wearRate.toFixed(2)) 
      };
    });

    // Sort Ascending: Lowest wear rate (Best) goes straight to the top
    processedData.sort((a, b) => a.wearRate - b.wearRate);

    setWearData(processedData);
    setIsLoading(false);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl max-w-4xl mx-auto mt-8">
      <div className="flex justify-between items-end mb-6 border-b border-gray-700 pb-4">
        <div>
          <h2 className="text-2xl font-black tracking-widest text-white uppercase">Brand Wear Analysis</h2>
          <p className="text-gray-400 text-sm font-bold mt-1 uppercase">Metric: Rubber lost per 10,000 km driven</p>
        </div>
        <button onClick={fetchWearData} className="text-xs bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors border border-gray-600 shadow-sm">
          ↻ REFRESH
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-gray-500 font-bold animate-pulse tracking-widest uppercase">
          Crunching Fleet Data...
        </div>
      ) : wearData.length === 0 ? (
        <div className="text-center py-10 bg-gray-900 rounded-xl border border-gray-700 text-gray-500 font-bold italic">
          Not enough distance data logged yet to calculate wear rates.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-700 shadow-inner">
          <table className="w-full text-left bg-gray-900">
            <thead className="bg-gray-950 border-b border-gray-700">
              <tr>
                <th className="p-4 text-gray-400 font-black text-xs uppercase tracking-widest w-16 text-center">Rank</th>
                <th className="p-4 text-gray-400 font-black text-xs uppercase tracking-widest">Tyre Brand</th>
                <th className="p-4 text-gray-400 font-black text-xs uppercase tracking-widest text-center">Sample Size</th>
                <th className="p-4 text-gray-400 font-black text-xs uppercase tracking-widest text-right">Wear Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {wearData.map((data, index) => {
                const isTopRank = index === 0;
                const isWorstRank = index === wearData.length - 1 && wearData.length > 1;

                return (
                  <tr key={data.brand} className={`transition-colors hover:bg-gray-800 ${isTopRank ? 'bg-indigo-900/10' : ''}`}>
                    <td className="p-4 text-center">
                      {isTopRank ? (
                        <span className="bg-indigo-600 text-white font-black text-xs px-2 py-1 rounded shadow-sm">#1</span>
                      ) : (
                        <span className="text-gray-500 font-black text-sm">#{index + 1}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`font-black text-lg ${isTopRank ? 'text-indigo-400' : 'text-gray-200'}`}>
                        {data.brand}
                      </span>
                      {isTopRank && <span className="ml-3 text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 uppercase tracking-widest font-bold">Best Performer</span>}
                      {isWorstRank && <span className="ml-3 text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 uppercase tracking-widest font-bold">High Wear</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-gray-800 border border-gray-700 text-gray-400 font-bold text-xs px-3 py-1 rounded-full">
                        {data.sampleSize} {data.sampleSize === 1 ? 'Tyre' : 'Tyres'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-black text-xl ${isTopRank ? 'text-green-400' : isWorstRank ? 'text-red-400' : 'text-white'}`}>
                          {data.wearRate} <span className="text-xs text-gray-500 ml-1">mm</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}