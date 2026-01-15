import React, { useState, useEffect } from 'react';
import { 
  VendorFormData, 
  EquipmentItem, 
  StaffMember, 
  PaperworkFile,
  ExternalSpaceReason
} from './types';
import { 
  EQUIPMENT_TYPES, 
  POWER_SOCKETS, 
  STAFF_ROLES, 
  PAPERWORK_ITEMS, 
  MIN_STAFF_COUNT, 
  MIN_EXPIRY_DATE_FUME,
  MIN_EXPIRY_DATE_FAYRE,
  SPACE_OPTIONS,
  REASON_OPTIONS
} from './constants';
import SectionHeader from './components/SectionHeader';
import FormField from './components/FormField';
import FileInput from './components/FileInput';

// REPLACE THIS WITH YOUR NEW DEPLOYMENT URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8QyE7cmB3_58PalUOMccYXyAm3bPJfZXDJqbjf_GaGD0XmKqTHkqJN9IlvKpdYc0/exec';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);

  const initialFormData: VendorFormData = {
    vendorId: '',
    tradingName: '',
    contactName: '',
    email: '',
    phone: '',
    comingToStateFayre: '',
    standType: '',
    spaceLeft: 'None',
    spaceRight: 'None',
    spaceBehind: 'None',
    externalSpaceReason: '',
    branding: null,
    powerSource: '',
    equipment: [],
    paperwork: PAPERWORK_ITEMS.reduce((acc, item) => {
      acc[item.id] = { file: null, expiry: '' };
      return acc;
    }, {} as { [key: string]: PaperworkFile }),
    paperworkStatus: '',
    menu: {
      dish3: { desc: '', ingredients: '', photo: null },
      dish75: { desc: '', ingredients: '', photo: null },
      dish15: { desc: '', ingredients: '', photo: null }
    },
    staff: [],
    vehicleReg: '',
    instagram: '',
    comments: ''
  };

  const [formData, setFormData] = useState<VendorFormData>(initialFormData);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem('fume_vendor_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // We restore everything except files which can't be serialized to string easily this way
        setFormData(prev => ({ ...prev, ...parsed }));
        if (parsed.externalSpaceReason) {
          setSelectedReasons(parsed.externalSpaceReason.split(', '));
        }
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, []);

  // Save draft on change (de-duplicate file objects for serialization)
  useEffect(() => {
    const { branding, paperwork, menu, ...serializable } = formData;
    const saveObj = {
      ...serializable,
      externalSpaceReason: selectedReasons.join(', '),
      // Store dates but null out files in the saved state
      paperwork: Object.keys(paperwork).reduce((acc, key) => {
        acc[key] = { ...paperwork[key], file: null };
        return acc;
      }, {} as any),
      menu: {
        dish3: { ...menu.dish3, photo: null },
        dish75: { ...menu.dish75, photo: null },
        dish15: { ...menu.dish15, photo: null }
      }
    };
    localStorage.setItem('fume_vendor_draft', JSON.stringify(saveObj));
  }, [formData, selectedReasons]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'FUME2026') {
      setIsAuthenticated(true);
    } else {
      setAuthError('Incorrect password.');
    }
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev => 
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  const validateExpiry = (date: string) => {
    if (!date) return true;
    const minDate = formData.comingToStateFayre === 'Yes' ? MIN_EXPIRY_DATE_FAYRE : MIN_EXPIRY_DATE_FUME;
    return new Date(date) >= new Date(minDate);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.staff.length < MIN_STAFF_COUNT) {
      alert(`Min ${MIN_STAFF_COUNT} staff required.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = { 
        vendorId: formData.vendorId,
        tradingName: formData.tradingName,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        comingToStateFayre: formData.comingToStateFayre,
        standType: formData.standType,
        spaceLeft: formData.spaceLeft,
        spaceRight: formData.spaceRight,
        spaceBehind: formData.spaceBehind,
        externalSpaceReason: selectedReasons.join(', '), 
        powerSource: formData.powerSource,
        equipment: formData.equipment.map(e => `${e.type} (${e.socket})`).join(', '), 
        paperworkStatus: formData.paperworkStatus, 
        staffRoles: formData.staff.map(s => s.role).join(', '), 
        expiryDates: PAPERWORK_ITEMS.map(item => `${item.label}: ${formData.paperwork[item.id].expiry || 'N/A'}`).join(' | '), 
        menuDesc3: `${formData.menu.dish3.desc} (${formData.menu.dish3.ingredients})`,
        menuDesc75: `${formData.menu.dish75.desc} (${formData.menu.dish75.ingredients})`,
        menuDesc15: `${formData.menu.dish15.desc} (${formData.menu.dish15.ingredients})`,
        vehicleReg: formData.vehicleReg,
        instagram: formData.instagram,
        comments: formData.comments,
        staff: formData.staff 
      };

      if (formData.branding) {
        payload.fileData_branding = await fileToBase64(formData.branding);
        payload.fileName_branding = formData.branding.name;
      }

      for (const id of Object.keys(formData.paperwork)) {
        if (formData.paperwork[id].file) {
          payload[`fileData_${id}`] = await fileToBase64(formData.paperwork[id].file!);
          payload[`fileName_${id}`] = formData.paperwork[id].file!.name;
        }
      }

      const dishKeys = ['dish3', 'dish75', 'dish15'] as const;
      for (const key of dishKeys) {
        if (formData.menu[key].photo) {
          const suffix = key.replace('dish', '');
          payload[`fileData_menu${suffix}`] = await fileToBase64(formData.menu[key].photo!);
          payload[`fileName_menu${suffix}`] = formData.menu[key].photo!.name;
        }
      }

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });

      localStorage.removeItem('fume_vendor_draft');
      setSubmitSuccess(true);
      window.scrollTo(0, 0);
    } catch (err) {
      alert("Submission error. Progress saved locally. Try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) return (
    <div className="flex items-center justify-center min-h-screen gradient-bg p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-black text-gray-800 text-center mb-8 uppercase italic tracking-tighter">FUME 2026</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-orange-500" placeholder="Password: FUME2026" required />
          {authError && <p className="text-red-500 text-sm font-bold text-center">{authError}</p>}
          <button type="submit" className="w-full bg-orange-600 text-white font-black py-4 rounded-lg shadow-lg uppercase tracking-widest hover:bg-orange-700 transition-colors">Login</button>
        </form>
      </div>
    </div>
  );

  if (submitSuccess) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg border border-gray-100">
        <div className="text-green-500 text-6xl mb-6 font-bold">✓</div>
        <h2 className="text-3xl font-black mb-4 uppercase italic tracking-tighter">APPLICATION SYNCED</h2>
        <p className="text-gray-600 mb-8 font-medium italic">Data has been successfully pushed to the master sheet and Google Drive.</p>
        <button onClick={() => window.location.reload()} className="bg-orange-600 text-white font-black px-8 py-4 rounded-xl uppercase hover:bg-orange-700 transition-transform active:scale-95">Submit New</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <header className="mb-12 text-center">
        <h1 className="text-7xl font-black text-gray-900 tracking-tighter mb-2 italic uppercase">FUME 2026</h1>
        <p className="text-lg text-gray-500 font-bold uppercase tracking-[0.3em]">Vendor Portal</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader title="Section 1: Vendor Details" />
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Vendor ID" required value={formData.vendorId} onChange={(v) => setFormData({...formData, vendorId: v})} />
            <FormField label="Trading Name" required value={formData.tradingName} onChange={(v) => setFormData({...formData, tradingName: v})} />
            <FormField label="Contact Name" required value={formData.contactName} onChange={(v) => setFormData({...formData, contactName: v})} />
            <FormField label="Email" type="email" required value={formData.email} onChange={(v) => setFormData({...formData, email: v})} />
            <FormField label="Phone" required value={formData.phone} onChange={(v) => setFormData({...formData, phone: v})} />
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase italic">Coming to State Fayre? *</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none font-medium focus:ring-2 focus:ring-orange-500" value={formData.comingToStateFayre} onChange={(e) => setFormData({...formData, comingToStateFayre: e.target.value as any})} required>
                <option value="">Select option...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Need More Info">Need More Info</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader title="Section 2: Stand Design" />
          <div className="p-8 space-y-8">
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl mb-4">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider leading-relaxed">
                Provide dimensions, structure - NO GAZEBO's, and branding assets (logo, etc). 2.3m L/R and 2m Behind is included in pitch fee. £100 for every additional m requested.
                Provide dimensions, structure details *NO GAZEBO's*, and branding assets. 2.3m L/R and 2m behind stand inc in pitch fee - £100 for every additional metre.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase italic">Van / Shack</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none font-medium focus:ring-2 focus:ring-orange-500" value={formData.standType} onChange={(e) => setFormData({...formData, standType: e.target.value as any})} required>
                  <option value="">Select...</option>
                  <option value="Van">Van</option>
                  <option value="Shack">Shack</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['spaceLeft', 'spaceRight', 'spaceBehind'].map((field) => (
                <div key={field}>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">{field.replace('space', 'Space ')}</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-medium focus:ring-2 focus:ring-orange-500" value={(formData as any)[field]} onChange={(e) => setFormData({...formData, [field]: e.target.value})}>
                    {SPACE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-black text-gray-700 mb-3 uppercase italic">Reason for External Space (Multi-select)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {REASON_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => toggleReason(opt)} className={`px-4 py-3 rounded-xl border-2 font-black transition-all text-xs uppercase ${selectedReasons.includes(opt) ? 'border-orange-600 bg-orange-600 text-white shadow-lg' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <FileInput label="Branding Upload" accept=".pdf,image/*" onChange={(f) => setFormData({...formData, branding: f})} />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader title="Section 3: Equipment and Power" />
          <div className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase italic">Power Source</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none font-medium focus:ring-2 focus:ring-orange-500" value={formData.powerSource} onChange={(e) => setFormData({...formData, powerSource: e.target.value as any})} required>
                <option value="">Select...</option>
                <option value="FUME/Venue Supply">FUME/Venue Supply</option>
                <option value="Own Generator">Own Generator</option>
              </select>
            </div>
            <div className="pt-6 border-t border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-gray-800 uppercase italic">Stand Equipment</h3>
                <button type="button" onClick={() => setFormData({...formData, equipment: [...formData.equipment, {id: Math.random().toString(36).substr(2, 9), type: EQUIPMENT_TYPES[0], socket: POWER_SOCKETS[0]}]})} className="bg-orange-600 text-white text-[10px] font-black px-5 py-2 rounded-full shadow-lg hover:scale-105 transition-transform">+ Add Item</button>
              </div>
              <div className="space-y-3">
                {formData.equipment.map((item, index) => (
                  <div key={item.id} className="flex gap-4 items-end bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <select className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none" value={item.type} onChange={(e) => {
                      const newList = [...formData.equipment]; newList[index].type = e.target.value; setFormData({...formData, equipment: newList});
                    }}>{EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                    <select className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none" value={item.socket} onChange={(e) => {
                      const newList = [...formData.equipment]; newList[index].socket = e.target.value; setFormData({...formData, equipment: newList});
                    }}>{POWER_SOCKETS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    <button type="button" onClick={() => setFormData({...formData, equipment: formData.equipment.filter(e => e.id !== item.id)})} className="p-2 text-red-500 hover:scale-125 transition-transform">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader title="Section 4: Paperwork" />
          <div className="p-8 space-y-8">
            <div className={`p-4 rounded-xl font-black text-xs uppercase tracking-widest leading-relaxed shadow-inner ${formData.comingToStateFayre === 'Yes' ? 'bg-orange-50 text-orange-800 border-l-4 border-orange-500' : 'bg-blue-50 text-blue-800 border-l-4 border-blue-500'}`}>
              REQUIRED UNTIL: {formData.comingToStateFayre === 'Yes' ? '1st July 2026' : '14th June 2026'}. <br/>
              Deadline: 14th Feb 2026. Documents must be designed for Allianz Stadium/State Fayre for relevant dates.
              Deadline: 14th Feb 2026. Docs must be designed for Allianz Stadium/State Fayre.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {PAPERWORK_ITEMS.map((item) => (
                <div key={item.id} className="space-y-2">
                  <FileInput label={item.label} accept=".pdf,image/*" onChange={(f) => {
                    const newPaperwork = { ...formData.paperwork }; newPaperwork[item.id].file = f; setFormData({...formData, paperwork: newPaperwork});
                  }} />
                  <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-black text-gray-400 mb-1 tracking-widest">Expiration Date</label>
                    <input type="date" className={`w-full px-3 py-2 border rounded-lg font-bold text-sm outline-none ${formData.paperwork[item.id].expiry && !validateExpiry(formData.paperwork[item.id].expiry) ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-orange-500'}`} value={formData.paperwork[item.id].expiry} onChange={(e) => {
                        const newPaperwork = { ...formData.paperwork }; newPaperwork[item.id].expiry = e.target.value; setFormData({...formData, paperwork: newPaperwork});
                      }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t border-gray-100">
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase italic">Paperwork Finished?</label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none font-medium focus:ring-2 focus:ring-orange-500" value={formData.paperworkStatus} onChange={(e) => setFormData({...formData, paperworkStatus: e.target.value as any})} required>
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="Yes but need to renew documents">Yes but need to renew documents</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader title="Section 5: Menu" />
          <div className="p-8 space-y-10">
            {[
              { key: 'dish3', price: '£3', label: 'Starter' },
              { key: 'dish75', price: '£7.50', label: 'Mid' },
              { key: 'dish15', price: '£15', label: 'Main' }
            ].map((d) => (
              <div key={d.key} className="menu-card grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex flex-col justify-center">
                  <div className="text-5xl font-black text-orange-600 italic tracking-tighter">{d.price}</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{d.label} Item</div>
                </div>
                <div className="md:col-span-2 space-y-4">
                  <FormField label="Item & Ingredients" value={(formData.menu as any)[d.key].desc} onChange={(v) => {
                    const newMenu = { ...formData.menu }; (newMenu as any)[d.key].desc = v; setFormData({...formData, menu: newMenu});
                  }} placeholder="Describe dish and list all ingredients..." />
                  <FileInput label="Dish Photo" accept="image/*" onChange={(f) => {
                    const newMenu = { ...formData.menu }; (newMenu as any)[d.key].photo = f; setFormData({...formData, menu: newMenu});
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader title="Section 6: Staffing" />
          <div className="p-8 space-y-6">
            <div className="bg-black text-white p-5 rounded-xl text-[10px] uppercase font-black text-center italic tracking-widest leading-relaxed">
              FUME Festival requires at least 6 staff working on your stand during the live show to maximise speed and quality of service. Failure to meet this will result in a breach of contracts and fines.
            </div>
            <div className="flex justify-between items-center">
              <h3 className="font-black text-gray-800 uppercase italic">Staff List ({formData.staff.length}/6)</h3>
              <button type="button" onClick={() => setFormData({...formData, staff: [...formData.staff, {id: Math.random().toString(36).substr(2, 9), role: STAFF_ROLES[0]}]})} className="bg-orange-600 text-white text-[10px] font-black px-6 py-2.5 rounded-full shadow-lg hover:scale-105 transition-all">+ Add Staff</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {formData.staff.map((s, index) => (
                <div key={s.id} className="flex gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  <span className="text-[10px] font-black text-gray-400">Staff {index+1}</span>
                  <select className="flex-1 bg-transparent text-xs font-black uppercase outline-none focus:text-orange-600" value={s.role} onChange={(e) => {
                    const newStaff = [...formData.staff]; newStaff[index].role = e.target.value; setFormData({...formData, staff: newStaff});
                  }}>{STAFF_ROLES.map(role => <option key={role} value={role}>{role}</option>)}</select>
                  <button type="button" onClick={() => setFormData({...formData, staff: formData.staff.filter(st => st.id !== s.id)})} className="text-red-500 hover:scale-125 transition-all">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader title="Section 7: Final Details" />
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Vehicle Registration Number" value={formData.vehicleReg} onChange={(v) => setFormData({...formData, vehicleReg: v})} required />
            <FormField label="Instagram Handle" value={formData.instagram} onChange={(v) => setFormData({...formData, instagram: v})} placeholder="@handle" />
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase italic">Questions / Comments *MUST INCLUDE ACCOMMODATION ADDRESS HERE*</label>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase italic">Questions / Comments *Must State Address for Live Days*</label>
              <textarea rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-2xl outline-none font-medium focus:ring-2 focus:ring-orange-500" value={formData.comments} onChange={(e) => setFormData({...formData, comments: e.target.value})} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={isSubmitting || formData.staff.length < 6} className={`w-full py-8 rounded-[40px] text-3xl font-black text-white shadow-2xl transition-all uppercase italic tracking-tighter ${isSubmitting || formData.staff.length < 6 ? 'bg-gray-300 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 active:scale-95'}`}>
          {isSubmitting ? 'UPLOADING DATA...' : 'FINISH ONBOARDING'}
        </button>
      </form>

      <footer className="mt-12 text-center text-[10px] font-black uppercase text-gray-400 italic tracking-[0.5em] pb-12">
        &copy; 2026 FUME Festival Allianz Stadium
      </footer>
    </div>
  );
};

export default App;
