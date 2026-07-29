import React, { useState } from 'react';
// 🚀 Make sure to import your Supabase client
import { supabase } from './supabaseClient'; 

const inspectionItems = [
  "Check Ignition Key (Bent, Worn etc)",
  "Check Windscreen integrity (cracks/chips)",
  "Check Windshield Wipers / Washers (front and rear)",
  "Visual Inspection for Exterior Damage",
  "Check Service Sticker (on windscreen) for scheduled service date/mileage",
  "Leaks under the vehicle",
  "Check inside the engine compartment for any leaks and loose items",
  "Check Oil Level",
  "Check Washer Fluid Level",
  "Check Coolant Level",
  "Check Power Steering Fluid Level",
  "Start Engine and Check Transmission Fluid",
  "Check Tires for Wear and Pressure, inc. spare",
  "Check Hooter",
  "Check Heater / Defroster / Air conditioner",
  "Check Headlights / Turn Signal Lights / Hazard Lights / Tail Lights / Reverse Lights",
  "Check Mirrors for Damage and Adjustments",
  "Check First Aid Kit",
  "Check Fire Extinguisher",
  "Check High Visibility Vest and Leather Gloves",
  "Check Bio-Hazard Kit (if supplied)",
  "Check Wheel chocks, Warning Signs, Jack and Wheel spanner",
  "Check LED Torch (wind-up)"
];

export default function LightVehicleInspection() {
  const [metaData, setMetaData] = useState({
    auditTitle: '',
    documentNo: '',
    clientSite: '',
    conductedOn: new Date().toISOString().split('T')[0],
    preparedBy: '',
    location: '',
    odometer: ''
  });

  const [checklist, setChecklist] = useState(
    inspectionItems.map((item, index) => ({
      id: index,
      label: item,
      status: '', 
      comment: '',
      photo: null // Will now hold the actual file object
    }))
  );

  // 🚀 New state to handle the loading button during upload
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMetaChange = (e) => {
    const { name, value } = e.target;
    setMetaData(prev => ({ ...prev, [name]: value }));
  };

  const updateItemStatus = (id, status) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, status } : item
    ));
  };

  const updateItemComment = (id, comment) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, comment } : item
    ));
  };

  // 🚀 New function to capture the file input
  const updateItemPhoto = (id, file) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, photo: file } : item
    ));
  };

  const calculateScore = () => {
    const scoredItems = checklist.filter(item => item.status === 'Safe' || item.status === 'At Risk');
    const safeItems = scoredItems.filter(item => item.status === 'Safe');
    if (scoredItems.length === 0) return 0;
    return Math.round((safeItems.length / scoredItems.length) * 100);
  };

  // 🚀 The main Supabase submission function
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const finalScore = calculateScore();

      // 1. Insert Metadata into parent table
      const { data: inspectionRecord, error: inspectionError } = await supabase
        .from('light_vehicle_inspections')
        .insert({
          audit_title: metaData.auditTitle,
          document_no: metaData.documentNo,
          odometer_reading: metaData.odometer,
          prepared_by: metaData.preparedBy,
          location: metaData.location,
          total_score: finalScore
        })
        .select()
        .single();

      if (inspectionError) throw inspectionError;

      const newInspectionId = inspectionRecord.id;

      // 2. Loop through items to upload photos and build line items
      const lineItemsToInsert = await Promise.all(
        checklist.map(async (item) => {
          let photoUrl = null;

          // If there is a photo, upload it to Supabase Storage first
          if (item.photo) {
            const fileExt = item.photo.name.split('.').pop();
            const fileName = `${newInspectionId}-${item.id}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('inspection_photos')
              .upload(fileName, item.photo);

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from('inspection_photos')
                .getPublicUrl(fileName);
              photoUrl = publicUrlData.publicUrl;
            }
          }

          return {
            inspection_id: newInspectionId,
            item_label: item.label,
            status: item.status,
            comments: item.comment,
            photo_url: photoUrl
          };
        })
      );

      // 3. Insert all line items into the database
      const { error: lineItemsError } = await supabase
        .from('inspection_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      alert('Inspection submitted successfully!');
      
      // Optional: Reset form here
      
    } catch (error) {
      console.error('Error submitting inspection:', error);
      alert('Failed to submit inspection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black text-gray-800">Light Vehicle Safety Inspection</h1>
          <div className="text-right">
            <p className="text-sm text-gray-500 font-bold uppercase">Audit Score</p>
            <p className={`text-3xl font-black ${calculateScore() >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
              {calculateScore()}%
            </p>
          </div>
        </div>

        {/* METADATA SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Audit Title (Vehicle Reg)</label>
            <input type="text" name="auditTitle" value={metaData.auditTitle} onChange={handleMetaChange} className="w-full p-2 border rounded" placeholder="e.g. Isuzu MM49DWGP" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Document No.</label>
            <input type="text" name="documentNo" value={metaData.documentNo} onChange={handleMetaChange} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Prepared By</label>
            <input type="text" name="preparedBy" value={metaData.preparedBy} onChange={handleMetaChange} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Odometer Reading</label>
            <input type="number" name="odometer" value={metaData.odometer} onChange={handleMetaChange} className="w-full p-2 border rounded" placeholder="5000" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
            <input type="text" name="location" value={metaData.location} onChange={handleMetaChange} className="w-full p-2 border rounded" />
          </div>
        </div>
      </div>

      {/* CHECKLIST SECTION */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Inspection Checklist</h2>
        
        <div className="space-y-4">
          {checklist.map((item) => (
            <div key={item.id} className="p-4 border rounded-lg bg-gray-50">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <p className="font-semibold text-gray-700 flex-1">{item.label}</p>
                
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => updateItemStatus(item.id, 'Safe')}
                    className={`px-4 py-2 rounded font-bold text-sm transition-colors ${item.status === 'Safe' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-green-100'}`}
                  >
                    Safe
                  </button>
                  <button 
                    onClick={() => updateItemStatus(item.id, 'At Risk')}
                    className={`px-4 py-2 rounded font-bold text-sm transition-colors ${item.status === 'At Risk' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-red-100'}`}
                  >
                    At Risk
                  </button>
                  <button 
                    onClick={() => updateItemStatus(item.id, 'N/A')}
                    className={`px-4 py-2 rounded font-bold text-sm transition-colors ${item.status === 'N/A' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                  >
                    N/A
                  </button>
                </div>
              </div>

              {/* CONDITIONAL "AT RISK" INPUTS */}
              {item.status === 'At Risk' && (
                <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in-down">
                  <label className="block text-xs font-bold text-red-500 uppercase mb-2">Issue Details Required</label>
                  <textarea 
                    value={item.comment}
                    onChange={(e) => updateItemComment(item.id, e.target.value)}
                    placeholder="Describe the issue and recommend taking a picture..."
                    className="w-full p-3 border border-red-200 rounded-lg focus:ring-red-500 mb-2"
                    rows="2"
                  ></textarea>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {/* 🚀 Show filename if attached, otherwise show instructions */}
                        <p className="text-sm text-gray-500 font-bold">
                          {item.photo ? `Selected: ${item.photo.name}` : 'Click to upload photo evidence'}
                        </p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => updateItemPhoto(item.id, e.target.files[0])} // 🚀 Capture the file
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting} // 🚀 Prevent double clicks
            className={`text-white px-8 py-3 rounded-lg font-black uppercase tracking-wider shadow-md transition-colors ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#f97316] hover:bg-orange-600'}`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Inspection'}
          </button>
        </div>
      </div>
    </div>
  );
}