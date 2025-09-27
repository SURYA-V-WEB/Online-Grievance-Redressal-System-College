// admin.js - admin login and dashboard
(function(){
  const { $, $all, toast, populateSelect, formatDateTime } = window.OGRUI;
  let currentEditId = null;

  function renderFilters(){
    const meta = OGRStorage.readMeta();
    const fDept = $('#filterDepartment');
    const fCat = $('#filterCategory');
    if(fDept){
      fDept.innerHTML = '<option value="">All Departments</option>';
      meta.departments.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; fDept.appendChild(o); });
    }
    if(fCat){
      fCat.innerHTML = '<option value="">All Categories</option>';
      meta.categories.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; fCat.appendChild(o); });
    }
  }

  function renderTable(){
    const tbody = document.querySelector('#grievanceTable tbody');
    if(!tbody) return;
    const list = OGRStorage.listGrievances();
    const status = $('#filterStatus').value;
    const dept = $('#filterDepartment').value;
    const cat = $('#filterCategory').value;
    const q = ($('#searchText').value || '').toLowerCase();

    const filtered = list.filter(x=>
      (!status || x.status===status) &&
      (!dept || x.department===dept) &&
      (!cat || x.category===cat) &&
      (!q || x.subject.toLowerCase().includes(q) || x.description.toLowerCase().includes(q))
    );

    tbody.innerHTML = filtered.map(item=>`
      <tr>
        <td>
          <div><code>${item.id}</code></div>
          <div class="muted" style="font-size:12px">${formatDateTime(item.createdAt)}</div>
        </td>
        <td>
          <div>${item.studentName}</div>
          <div class="muted" style="font-size:12px">${item.studentEmail}</div>
        </td>
        <td>${item.department}</td>
        <td>${item.category}</td>
        <td>${item.subject}</td>
        <td><span class="status-chip status-${item.status.replaceAll(' ','-')}">${item.status}</span></td>
        <td>${formatDateTime(item.updatedAt)}</td>
        <td>
          <button class="icon-btn" data-edit="${item.id}">Edit</button>
        </td>
      </tr>
    `).join('');
  }

  function openDrawer(id){
    currentEditId = id;
    const item = OGRStorage.getGrievance(id);
    if(!item) return;
    const meta = OGRStorage.readMeta();
    populateSelect($('#editDepartment'), meta.departments, 'Select department');
    populateSelect($('#editCategory'), meta.categories, 'Select category');
    $('#editStatus').value = item.status;
    $('#editDepartment').value = item.department;
    $('#editCategory').value = item.category;
    $('#editNotes').value = item.notes || '';
    $('#editDrawer').classList.remove('hidden');
    document.body.classList.add('drawer-open');

    // Attachments (backend-powered)
    const listEl = $('#editAttachList');
    const fileInput = $('#editAttachFile');
    const uploadBtn = $('#editAttachUpload');
    if(window.OGRApi){
      const refreshList = async ()=>{
        try{
          const files = await OGRApi.listAttachments(currentEditId);
          listEl.innerHTML = files.length ? files.map(f=>
            `<li><a href="${OGRApi.downloadAttachmentUrl(currentEditId, f.filename)}" target="_blank">${f.filename}</a> <span class="muted" style="font-size:12px">(${Math.round(f.size/1024)} KB)</span></li>`
          ).join('') : '<li class="muted">No files yet.</li>';
        }catch(err){ listEl.innerHTML = '<li class="muted">Unable to load attachments (is API running?).</li>'; }
      };
      refreshList();
      if(uploadBtn){
        uploadBtn.onclick = async ()=>{
          if(!fileInput.files || !fileInput.files[0]){ toast('Choose a file','danger'); return; }
          try{
            await OGRApi.uploadAttachment(currentEditId, fileInput.files[0]);
            fileInput.value = '';
            toast('File uploaded');
            refreshList();
          }catch(err){ toast('Upload failed','danger'); }
        };
      }
    } else {
      listEl.innerHTML = '<li class="muted">API client not loaded.</li>';
    }
  }

  function closeDrawer(){
    $('#editDrawer').classList.add('hidden');
    currentEditId = null;
    document.body.classList.remove('drawer-open');
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // login
    const loginForm = $('#adminLoginForm');
    const dash = $('#dashboardSection');
    const login = $('#loginSection');
    const pass = $('#adminPass');

    if(loginForm){
      loginForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        if(pass.value !== 'admin123'){
          $('#loginError').textContent = 'Invalid credentials. Use password: admin123';
          $('#loginError').classList.remove('hidden');
          return;
        }
        login.classList.add('hidden');
        dash.classList.remove('hidden');
        renderFilters();
        renderTable();
        toast('Logged in');
      });
    }

    // filters
    $all('#filterStatus, #filterDepartment, #filterCategory, #searchText').forEach(el=>{
      el.addEventListener('input', renderTable);
      el.addEventListener('change', renderTable);
    });

    // table actions
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-edit]');
      if(btn){ openDrawer(btn.getAttribute('data-edit')); }
      if(e.target.id==='closeDrawer'){ closeDrawer(); }
    });

    // save edit
    const saveBtn = $('#saveEdit');
    if(saveBtn){
      saveBtn.addEventListener('click', ()=>{
        if(!currentEditId) return;
        const patch = {
          status: $('#editStatus').value,
          department: $('#editDepartment').value,
          category: $('#editCategory').value,
          notes: $('#editNotes').value.trim()
        };
        OGRStorage.updateGrievance(currentEditId, patch);
        toast('Updated');
        closeDrawer();
        renderTable();
      });
    }

    // export
    const exportBtn = $('#exportJSON');
    if(exportBtn){ exportBtn.addEventListener('click', ()=> OGRStorage.exportJSON()); }

    // logout
    const logoutBtn = $('#logoutBtn');
    if(logoutBtn){ logoutBtn.addEventListener('click', ()=>{ location.reload(); }); }
  });
})();
