// app.js - shared UI helpers
(function(){
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function setActiveTab(hash){
    const tab = (hash || location.hash || '#submit').replace('#','');
    const buttons = $all('.tab-btn');
    const tabs = $all('.tab');
    buttons.forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
    tabs.forEach(t=>t.classList.toggle('active', t.id === `tab-${tab}`));
  }

  function toast(msg, type='success'){
    const el = document.createElement('div');
    el.className = `alert ${type}`;
    el.textContent = msg;
    Object.assign(el.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:9999,minWidth:'240px'});
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 2800);
  }

  function formatDateTime(iso){
    try{
      const d = new Date(iso);
      return d.toLocaleString();
    }catch{ return iso }
  }

  function populateSelect(selectEl, items, placeholder='Select...'){
    selectEl.innerHTML = '';
    const ph = document.createElement('option');
    ph.value=''; ph.textContent = placeholder; ph.disabled=true; ph.selected=true;
    selectEl.appendChild(ph);
    items.forEach(v=>{
      const o = document.createElement('option'); o.textContent = v; o.value=v; selectEl.appendChild(o);
    });
  }

  // wire tabs if any
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab-btn');
    if(!btn) return;
    setActiveTab(`#${btn.dataset.tab}`);
    history.replaceState(null, '', `#${btn.dataset.tab}`);
  });
  window.addEventListener('hashchange', ()=>setActiveTab());
  window.OGRUI = { $, $all, setActiveTab, toast, formatDateTime, populateSelect };
})();
