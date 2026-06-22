import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Ensure this matches your setup

export default function FuelAnalytics() {
  const [fuelData, setFuelData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFuelData();
  }, []);

  const fetchFuelData = async () => {
    // Fetches your fuel entries from Supabase
    const { data, error } = await supabase
      .from('fuel_analytics')
      .select('*');

    if (!error && data) {
      setFuelData(data);
    }
    setLoading(false);
  };

  const deleteFuelEntry = async (entryId) => {
    // 1. Safety confirmation
    if (!window.confirm("Are you sure you want to permanently delete this entry?")) return;

    // 2. Delete from Supabase vault
    const { error } = await supabase
      .from('fuel_analytics')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error("Error deleting entry:", error.message);
      alert("Failed to delete. Check console.");
      return;
    }

    // 3. Remove it from the screen instantly
    setFuelData(currentData => currentData.filter(item => item.id !== entryId));
  };

  if (loading) return <div className="p-8 font-bold">Loading Fuel Analytics...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-green-50">
        <h2 className="text-xl font-black text-green-900 uppercase tracking-wide">Fuel Analytics</h2>
        <p className="text-sm text-green-700 font-medium">Manage and audit fleet fuel transactions</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-200">
              <th className="p-4">Entry ID</th>
              <th className="p-4">Details</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fuelData.length > 0 ? (
              fuelData.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-900">{entry.id}</td>
                  <td className="p-4 text-gray-600 text-sm">
                    {/* It prints all the raw data for this row so you can see what you are deleting */}
                    {JSON.stringify(entry)}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => deleteFuelEntry(entry.id)} 
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded shadow-sm transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="p-8 text-center text-gray-500 font-medium">No fuel entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}