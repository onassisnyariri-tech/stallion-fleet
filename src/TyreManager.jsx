import { useState } from 'react';
import TyreDashboard from './TyreDashboard';
import TripProfitability from './TripProfitability';
import MaintenanceTracker from './MaintenanceTracker';
import ExecutiveDashboard from './ExecutiveDashboard';
import FleetAssets from './FleetAssets';

export default function App() {
  const [activeTab, setActiveTab] = useState('fleet');

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans">
      
      {/* RESPONSIVE NAVIGATION BAR */}
      <div className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 p-4 md:p-6 shrink-0 flex flex-col z-20 sticky top-0 md:relative shadow-sm md:shadow-none">
        
        {/* Logo Area */}
        <div className="mb-4 md:mb-8 flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded flex items-center justify-center text-white font-black text-xl">S</div>
          <div>
            <h1 className="font-black text-gray-900 text-lg md:text-xl tracking-tight leading-none">STALLION</h1>
            <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest">Command Center</p>
          </div>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex md:flex-col overflow-x-auto gap-2 md:gap-2 pb-2 md:pb-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          <button 
            onClick={() => setActiveTab('fleet')} 
            className={`whitespace-nowrap px-4 py-2 md:py-3 font-bold rounded-lg text-sm md:text-base text-left transition-colors ${activeTab === 'fleet' ? 'bg-indigo-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Fleet Assets
          </button>

          <button 
            onClick={() => setActiveTab('tyres')} 
            className={`whitespace-nowrap px-4 py-2 md:py-3 font-bold rounded-lg text-sm md:text-base text-left transition-colors ${activeTab === 'tyres' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Tyre Management
          </button>

          <button 
            onClick={() => setActiveTab('maintenance')} 
            className={`whitespace-nowrap px-4 py-2 md:py-3 font-bold rounded-lg text-sm md:text-base text-left transition-colors ${activeTab === 'maintenance' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Inspections & PM
          </button>

          <button 
            onClick={() => setActiveTab('profitability')} 
            className={`whitespace-nowrap px-4 py-2 md:py-3 font-bold rounded-lg text-sm md:text-base text-left transition-colors ${activeTab === 'profitability' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Trip Ledger
          </button>
          
          <button 
            onClick={() => setActiveTab('executive')} 
            className={`whitespace-nowrap px-4 py-2 md:py-3 font-bold rounded-lg text-sm md:text-base text-left transition-colors ${activeTab === 'executive' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Executive Summary
          </button>
          
        </nav>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-x-hidden p-3 sm:p-4 md:p-8">
        {activeTab === 'fleet' && <FleetAssets />}
        {activeTab === 'tyres' && <TyreDashboard />}
        {activeTab === 'maintenance' && <MaintenanceTracker />}
        {activeTab === 'profitability' && <TripProfitability />}
        {activeTab === 'executive' && <ExecutiveDashboard />}
      </div>
    </div>
  );
}