// storage.js - localStorage utilities for demo persistence
(function(){
  const KEY = 'ogr.grievances.v1';
  const META_KEY = 'ogr.meta.v1';

  function readAll(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '[]'); }catch{ return [] }
  }
  function writeAll(items){ localStorage.setItem(KEY, JSON.stringify(items)); }

  function readMeta(){
    const def = {
      departments: ['Computer Science','Electronics','Mechanical','Civil','Management','Humanities','MCA','MBA','AI&DS','CSBS','AI&ML'],
      categories: ['Academic','Examination','Infrastructure','Hostel','Transportation','Finance','Other'],
      lastSeq: 0
    };
    try{
      const got = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      return got || def;
    }catch{ return def }
  }
  function writeMeta(meta){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }

  function generateTicketId(){
    const meta = readMeta();
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,'0');
    const d = String(today.getDate()).padStart(2,'0');
    meta.lastSeq = (meta.lastSeq||0) + 1;
    writeMeta(meta);
    return `GRV-${y}${m}${d}-${String(meta.lastSeq).padStart(4,'0')}`;
  }

  function createGrievance(data){
    const items = readAll();
    const now = new Date().toISOString();
    const item = {
      id: generateTicketId(),
      createdAt: now,
      updatedAt: now,
      status: 'Submitted',
      notes: '',
      ...data
    };
    items.unshift(item);
    writeAll(items);
    return item;
  }

  function updateGrievance(id, patch){
    const items = readAll();
    const idx = items.findIndex(x=>x.id===id);
    if(idx===-1) return null;
    items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
    writeAll(items);
    return items[idx];
  }

  function getGrievance(id){
    return readAll().find(x=>x.id===id) || null;
  }

  function listGrievances(){
    return readAll();
  }

  function exportJSON(){
    const data = { meta: readMeta(), grievances: readAll() };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ogr-export.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function ensureSeed(){
    // Seed only once per fresh storage
    const items = readAll();
    if(items.length>0) return;
    const meta = readMeta();
    writeMeta(meta);
  }

  // expose globally
  window.OGRStorage = {
    readMeta, writeMeta, createGrievance, updateGrievance, getGrievance, listGrievances, exportJSON
  };

  ensureSeed();
})();
