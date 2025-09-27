// api.js - client for FastAPI backend
(function(){
  const API_BASE = window.API_BASE || 'http://127.0.0.1:8000';

  async function listAttachments(gid){
    const res = await fetch(`${API_BASE}/grievances/${encodeURIComponent(gid)}/attachments`);
    if(!res.ok) throw new Error('Failed to list attachments');
    return res.json();
  }

  async function uploadAttachment(gid, file){
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/grievances/${encodeURIComponent(gid)}/attachments`, {
      method: 'POST',
      body: form
    });
    if(!res.ok) throw new Error('Failed to upload');
    return res.json();
  }

  function downloadAttachmentUrl(gid, filename){
    return `${API_BASE}/grievances/${encodeURIComponent(gid)}/attachments/${encodeURIComponent(filename)}`;
  }

  async function getMeta(){
    const res = await fetch(`${API_BASE}/meta`);
    if(!res.ok) throw new Error('Failed meta');
    return res.json();
  }

  async function createGrievance(payload){
    const res = await fetch(`${API_BASE}/grievances`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('Failed to create');
    return res.json();
  }

  async function getGrievance(gid){
    const res = await fetch(`${API_BASE}/grievances/${encodeURIComponent(gid)}`);
    if(!res.ok) throw new Error('Not found');
    return res.json();
  }

  async function listGrievances(params={}){
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/grievances${q?`?${q}`:''}`);
    if(!res.ok) throw new Error('Failed to list');
    return res.json();
  }

  async function updateGrievance(gid, patch){
    const res = await fetch(`${API_BASE}/grievances/${encodeURIComponent(gid)}`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(patch)
    });
    if(!res.ok) throw new Error('Failed to update');
    return res.json();
  }

  async function upsertGrievance(gid, payload){
    // payload: { student_name, student_email, department, category, subject, description }
    const res = await fetch(`${API_BASE}/grievances/${encodeURIComponent(gid)}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('Failed to upsert');
    return res.json();
  }

  window.OGRApi = {
    API_BASE,
    listAttachments,
    uploadAttachment,
    downloadAttachmentUrl,
    getMeta,
    createGrievance,
    getGrievance,
    listGrievances,
    updateGrievance,
    upsertGrievance,
  };
})();
