import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Drivers({ companyId }) {
  const [drivers, setDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialFormState = {
    first_name: '', last_name: '', employee_id: '', phone_number: '', status: 'ACTIVE', date_of_hire: '',
    blood_type: '', medical_allergies: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
    license_number: '', license_type: 'EC', license_country: 'South Africa', license_issue_date: '', license_expiry_date: '',
    passport_number: '', passport_country: '', passport_issue_date: '', passport_expiry_date: '', 
    visa_permit_type: '', visa_permit_country: '', visa_permit_expiry_date: '',
    prdp_type: 'Goods', prdp_expiry_date: '', medical_cert_expiry_date: '', defensive_driving_expiry_date: '', 
    police_clearance_expiry_date: '', hazchem_expiry_date: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Fetch Drivers
  const fetchDrivers = async () => {
    if (!companyId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('company_id', companyId)
      .order('first_name', { ascending: true });
      
    if (error) console.error("Error fetching drivers:", error);
    else setDrivers(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, [companyId]);

  // Handle Form Inputs
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Open Modal for Add or Edit
  const openModal = (driver = null) => {
    if (driver) {
      setFormData(driver);
      setEditingId(driver.id);
    } else {
      setFormData(initialFormState);
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  // Save Driver
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...formData, company_id: companyId };
    
    // Clean empty strings to null for date fields to prevent DB errors
    Object.keys(payload).forEach(key => {
      if (payload[key] === '') payload[key] = null;
    });

    if (editingId) {
      const { error } = await supabase.from('drivers').update(payload).eq('id', editingId).eq('company_id', companyId);
      if (error) alert("Error updating driver: " + error.message);
    } else {
      const { error } = await supabase.from('drivers').insert([payload]);
      if (error) alert("Error adding driver: " + error.message);
    }
    
    setIsModalOpen(false);
    fetchDrivers();
  };

  // Delete Driver
  const handleDelete = async (id, name) => {
    if (!window.confirm(`DANGER: Are you sure you want to permanently delete ${name}?`)) return;
    const { error } = await supabase.from('drivers').delete().eq('id', id).eq('company_id', companyId);
    if (error) alert("Error deleting driver: " + error.message);
    else fetchDrivers();
  };

  // Expiry Logic Checker (Checks if a date is within 30 days)
  const getExpiryStatus = (dateString, label) => {
    if (!dateString) return null;
    const today = new Date();
    const expiry = new Date(dateString);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label, days: diffDays, status: 'EXPIRED', color: 'bg-red-100 text-red-800 border-red-300' };
    if (diffDays <= 30) return { label, days: diffDays, status: 'EXPIRING SOON', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    return null; // Don't flag if it's healthy
  };

  if (isLoading) return <div className="p-10 text-center text-gray-500 font-bold animate-pulse">Loading Driver Roster...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Fleet Drivers</h1>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Personnel & Compliance Roster</p>
        </div>
        <button 
          onClick={() => openModal()} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm shadow-md transition-colors"
        >
          + Add Driver
        </button>
      </div>

      {/* DRIVER GRID */}
      {drivers.length === 0 ? (
        <div className="text-center py-20 text-gray-400 italic font-medium bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          No drivers registered yet. Add your first driver to start tracking compliance.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drivers.map(driver => {
            // Check expiries for the card
            const expiries = [
              getExpiryStatus(driver.license_expiry_date, 'License'),
              getExpiryStatus(driver.passport_expiry_date, 'Passport'),
              getExpiryStatus(driver.prdp_expiry_date, 'PrDP'),
              getExpiryStatus(driver.medical_cert_expiry_date, 'Medical'),
              getExpiryStatus(driver.police_clearance_expiry_date, 'Police Clearance'),
              getExpiryStatus(driver.hazchem_expiry_date, 'Hazchem')
            ].filter(Boolean);

            return (
              <div key={driver.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className={`p-4 border-b flex justify-between items-center ${driver.status === 'ACTIVE' ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100'}`}>
                  <div>
                    <h3 className="font-black text-xl text-gray-900">{driver.first_name} {driver.last_name}</h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{driver.employee_id || 'NO ID'} • {driver.license_type || 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${driver.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-200 text-red-900'}`}>
                    {driver.status}
                  </span>
                </div>
                
                <div className="p-4 flex-1 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <span>📞 {driver.phone_number || 'No phone listed'}</span>
                  </div>
                  
                  {/* COMPLIANCE ALERTS */}
                  {expiries.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compliance Alerts</p>
                      {expiries.map((exp, idx) => (
                        <div key={idx} className={`px-3 py-2 rounded border text-xs font-bold flex justify-between items-center ${exp.color}`}>
                          <span>{exp.label}</span>
                          <span>{exp.days < 0 ? 'EXPIRED' : `${exp.days} Days`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                  <button onClick={() => openModal(driver)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded font-bold text-xs uppercase tracking-widest">Edit</button>
                  <button onClick={() => handleDelete(driver.id, `${driver.first_name} ${driver.last_name}`)} className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded font-bold text-xs uppercase tracking-widest">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL SCREEN MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
            
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
              <h2 className="text-2xl font-black text-gray-900">{editingId ? 'Edit Driver Profile' : 'New Driver Registration'}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-800 text-3xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-8 flex-1">
              
              {/* SECTION 1: IDENTITY */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">1. Identity & Employment</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">First Name *</label><input required name="first_name" value={formData.first_name} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Last Name *</label><input required name="last_name" value={formData.last_name} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Employee ID</label><input name="employee_id" value={formData.employee_id || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Phone Number</label><input name="phone_number" value={formData.phone_number || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-bold outline-none focus:border-indigo-500">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="ON LEAVE">ON LEAVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="TERMINATED">TERMINATED</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Date of Hire</label><input type="date" name="date_of_hire" value={formData.date_of_hire || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                </div>
              </div>

              {/* SECTION 2: CORE LICENSING */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">2. Core Driver Licensing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">License Number</label><input name="license_number" value={formData.license_number || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Code / Type</label><input name="license_type" placeholder="e.g. EC, Class 1" value={formData.license_type || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Issuing Country</label><input name="license_country" value={formData.license_country || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Date Issued</label><input type="date" name="license_issue_date" value={formData.license_issue_date || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div className="md:col-span-2"><label className="block text-xs font-black text-orange-600 mb-1">License Expiry Date</label><input type="date" name="license_expiry_date" value={formData.license_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                </div>
              </div>

              {/* SECTION 3: CROSS BORDER */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">3. Cross-Border & Passport</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Passport Number</label><input name="passport_number" value={formData.passport_number || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Passport Country</label><input name="passport_country" value={formData.passport_country || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-black text-orange-600 mb-1">Passport Expiry Date</label><input type="date" name="passport_expiry_date" value={formData.passport_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-xs font-black text-orange-600 mb-1">Work Visa Expiry (If Applicable)</label><input type="date" name="visa_permit_expiry_date" value={formData.visa_permit_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                </div>
              </div>

              {/* SECTION 4: PERMITS & EXPIRIES */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-black text-red-600 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">4. Compliance Expiries (PrDP, Hazchem, Medical)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">PrDP Type (e.g. Goods / Hazchem)</label><input name="prdp_type" value={formData.prdp_type || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-black text-orange-600 mb-1">PrDP Expiry Date</label><input type="date" name="prdp_expiry_date" value={formData.prdp_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                  
                  <div><label className="block text-xs font-black text-orange-600 mb-1">Medical Certificate Expiry</label><input type="date" name="medical_cert_expiry_date" value={formData.medical_cert_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-xs font-black text-orange-600 mb-1">Hazchem Expiry Date</label><input type="date" name="hazchem_expiry_date" value={formData.hazchem_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                  
                  <div><label className="block text-xs font-black text-orange-600 mb-1">Defensive Driving Expiry</label><input type="date" name="defensive_driving_expiry_date" value={formData.defensive_driving_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-xs font-black text-orange-600 mb-1">Police Clearance Expiry</label><input type="date" name="police_clearance_expiry_date" value={formData.police_clearance_expiry_date || ''} onChange={handleChange} className="w-full p-2 border-2 border-orange-200 rounded bg-orange-50 font-bold outline-none focus:border-orange-500" /></div>
                </div>
              </div>

              {/* SECTION 5: EMERGENCY INFO */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">5. Emergency & Medical Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Name</label><input name="emergency_contact_name" value={formData.emergency_contact_name || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Emergency Contact Phone</label><input name="emergency_contact_phone" value={formData.emergency_contact_phone || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Relationship</label><input name="emergency_contact_relation" placeholder="e.g. Wife, Brother" value={formData.emergency_contact_relation || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Blood Type</label><input name="blood_type" placeholder="e.g. O Positive" value={formData.blood_type || ''} onChange={handleChange} className="w-full p-2 border rounded bg-gray-50 font-medium outline-none focus:border-indigo-500" /></div>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 uppercase tracking-widest text-sm">Cancel</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm shadow-lg">
                  {editingId ? 'Update Driver' : 'Save New Driver'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}