// student.js - submit and track logic
(function(){
  const { $, toast, populateSelect, formatDateTime } = window.OGRUI;
  const meta = OGRStorage.readMeta();

  // Populate selects
  document.addEventListener('DOMContentLoaded', ()=>{
    const deptSel = $('#department');
    const catSel = $('#category');
    if(deptSel) populateSelect(deptSel, meta.departments, 'Select department');
    if(catSel) populateSelect(catSel, meta.categories, 'Select category');

    // Handle submit form
    const form = document.getElementById('grievanceForm');
    if(form){
      form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const data = {
          studentName: $('#studentName').value.trim(),
          studentEmail: $('#studentEmail').value.trim(),
          department: $('#department').value,
          category: $('#category').value,
          subject: $('#subject').value.trim(),
          description: $('#description').value.trim()
        };
        if(!data.studentName || !data.studentEmail || !data.department || !data.category || !data.subject || !data.description){
          toast('Please fill in all required fields','danger'); return;
        }
        const item = OGRStorage.createGrievance(data);
        const res = document.getElementById('submitResult');
        res.classList.remove('hidden');
        res.innerHTML = `<strong>Submitted!</strong> Your Ticket ID is <code>${item.id}</code>. Use the Track tab to view updates.`;
        form.reset();
        toast('Grievance submitted');
        location.hash = '#track';
      });
    }

    // Handle track form
    const tForm = document.getElementById('trackForm');
    if(tForm){
      tForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        const id = document.getElementById('ticketId').value.trim();
        const item = OGRStorage.getGrievance(id);
        const out = document.getElementById('trackResult');
        if(!item){
          out.classList.remove('hidden');
          out.innerHTML = `<div class="alert danger">No grievance found for Ticket ID <code>${id}</code>.</div>`;
          // hide attachments panel if previously visible
          const att = document.getElementById('trackAttachments');
          if(att) att.classList.add('hidden');
          return;
        }
        out.classList.remove('hidden');
        out.innerHTML = `
          <div class="card">
            <div class="badge"><strong>Status:</strong> <span class="status-chip status-${item.status.replaceAll(' ','-')}">${item.status}</span></div>
            <h3 style="margin:8px 0 0">${item.subject}</h3>
            <p class="muted">${item.category} • ${item.department}</p>
            <p>${item.description}</p>
            ${item.notes ? `<div class="tag" style="margin-top:8px">Admin Notes: ${item.notes}</div>` : ''}
          </div>
        `;

        // Attachments section (backend-powered)
        const att = document.getElementById('trackAttachments');
        const listEl = document.getElementById('attachList');
        const uploadBtn = document.getElementById('attachUpload');
        const fileInput = document.getElementById('attachFile');
        if(att && window.OGRApi){
          att.classList.remove('hidden');
          const refreshList = async () => {
            try{
              const files = await OGRApi.listAttachments(item.id);
              listEl.innerHTML = files.length ? files.map(f=>
                `<li><a href="${OGRApi.downloadAttachmentUrl(item.id, f.filename)}" target="_blank">${f.filename}</a> <span class="muted" style="font-size:12px">(${Math.round(f.size/1024)} KB)</span></li>`
              ).join('') : '<li class="muted">No files yet.</li>';
            }catch(err){
              listEl.innerHTML = '<li class="muted">Unable to load attachments (is API running?).</li>';
            }
          };
          refreshList();
          uploadBtn.onclick = async ()=>{
            if(!fileInput.files || !fileInput.files[0]){ toast('Choose a file first','danger'); return; }
            try{
              await OGRApi.uploadAttachment(item.id, fileInput.files[0]);
              fileInput.value = '';
              toast('Uploaded');
              refreshList();
            }catch(err){ toast('Upload failed','danger'); }
          };
        }
      });
    }

    // Activate tab by hash
    if(location.hash){ window.OGRUI.setActiveTab(location.hash); }
  });
})();
