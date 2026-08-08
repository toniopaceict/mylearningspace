(function () {
  "use strict";
  let started = false;
  let dataState = { resources: [], assignments: [], can_upload: false, storage: null };
  let visibleRows = [];
  const selectedResources = new Set();
  const resourceSortState = { key: "", direction: 1 };
  const resourceSortCollator = new Intl.Collator("en-GB", { numeric: true, sensitivity: "base" });

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (started || typeof window.getGlipWebAppUrl !== "function") return;
    started = true;
    byId("uploadClassResourceBtn")?.addEventListener("click", upload);
    byId("classResourceFile")?.addEventListener("change", function () {
      resetUploadMessages();
      updateFileName();
    });
    byId("selectAllResourceAssignments")?.addEventListener("click", function () { setAllAssignments(true); });
    byId("clearResourceAssignments")?.addEventListener("click", function () { setAllAssignments(false); });
    byId("classResourceSearch")?.addEventListener("input", render);
    byId("classResourceFilter")?.addEventListener("change", render);
    byId("clearClassResourceFilters")?.addEventListener("click", clearFilters);
    byId("selectAllVisibleResources")?.addEventListener("click", selectAllVisible);
    byId("clearSelectedResources")?.addEventListener("click", clearSelected);
    byId("downloadSelectedResources")?.addEventListener("click", downloadSelected);
    byId("deleteSelectedResources")?.addEventListener("click", confirmDeleteSelected);
    document.querySelectorAll("#classResourcesTable th[data-sort-key]").forEach(function (heading) {
      heading.addEventListener("click", function () { setResourceSort(heading.dataset.sortKey || ""); });
      heading.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setResourceSort(heading.dataset.sortKey || "");
        }
      });
    });

    applyRoleLayout();
    const cached = window.GLIPStoragePageCache?.get("listMyClassResources");
    if (cached) applyResult(cached);
    load(true);
  }

  function load(showSpinner) {
    if (showSpinner && !dataState.resources.length) loading(true);
    return window.GLIPStorageDownload.post({
      action: "listMyClassResources",
      student_id: sessionStorage.getItem("glipStudentId") || "",
      teacher_id: sessionStorage.getItem("glipTeacherId") || ""
    }).then(function (result) {
      if (!result || result.status !== "success") throw new Error(result && result.message || "Could not load resources.");
      window.GLIPStoragePageCache?.set("listMyClassResources", result);
      applyResult(result);
      return result;
    }).finally(function () { loading(false); });
  }

  function applyResult(result) {
    dataState = result;
    populateAssignments(); populateFilter(); renderUsage(result.storage || {}); render();
  }

  function populateAssignments() {
    const list = byId("resourceAssignmentList"), panel = byId("teacherResourceUploadPanel");
    if (!list || !panel) return;
    panel.hidden = !dataState.can_upload;
    const query = new URLSearchParams(location.search).get("assignment") || "";
    list.innerHTML = (dataState.assignments || []).map(function (item) {
      const checked = query && String(item.class_teacher_id) === query ? " checked" : "";
      return '<label class="resource-assignment-option"><input type="checkbox" value="' + esc(item.class_teacher_id) + '"' + checked + '>' +
        '<span>' + esc(formatLevel(item.level) + " – " + formatClassLabel(item.class_label) + " – " + item.subject_name) + '</span></label>';
    }).join("") || '<p class="meta">No active teaching assignments are available.</p>';
  }

  function populateFilter() {
    const select = byId("classResourceFilter"); if (!select || isStudentLike()) return;
    const current = select.value, options = {};
    (dataState.resources || []).forEach(function (row) {
      options[String(row.class_teacher_id)] = formatLevel(row.level) + " – " + formatClassLabel(row.class_label) + " – " + row.subject_name;
    });
    select.innerHTML = '<option value="">All classes</option>' + Object.keys(options).sort(function(a,b){return options[a].localeCompare(options[b],"en-GB");}).map(function(id){return '<option value="'+esc(id)+'">'+esc(options[id])+'</option>';}).join("");
    if (options[current]) select.value = current;
  }

  function renderUsage(storage) {
    const el = byId("classResourcesStorageUsage");
    if (!el) return;
    if (isStudentLike()) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    if (!storage) {
      el.textContent = "";
      return;
    }
    el.textContent = "Storage used: " + mb(storage.used_bytes) + " MB of " + mb(storage.limit_bytes, 0) + " MB";
  }

  function filteredRows() {
    const query = String(byId("classResourceSearch")?.value || "").trim().toLowerCase();
    const assignment = isStudentLike() ? "" : (byId("classResourceFilter")?.value || "");
    return (dataState.resources || []).filter(function(row){
      if (assignment && String(row.class_teacher_id) !== assignment) return false;
      if (!query) return true;
      return [row.file_name,row.subject_name,row.class_label,row.teacher_display_name,formatLevel(row.level)].some(function(v){return String(v||"").toLowerCase().includes(query);});
    });
  }

  function render() {
    const body = byId("classResourcesBody"), table = byId("classResourcesTable"); if (!body || !table) return;
    visibleRows = sortResourceRows(filteredRows());
    if (isStudentLike()) {
      body.innerHTML = visibleRows.length ? visibleRows.map(function (row) {
        const checked = selectedResources.has(String(row.resource_id)) ? " checked" : "";
        return '<tr data-resource-row="'+esc(row.resource_id)+'"><td class="resource-select-column"><input type="checkbox" class="resource-row-select" value="'+esc(row.resource_id)+'"'+checked+' aria-label="Select '+esc(row.file_name)+'"></td><td>'+esc(formatLevel(row.level))+'</td><td>'+esc(row.subject_name)+'</td><td>'+esc(formatClassLabel(row.class_label))+'</td><td>'+esc(row.teacher_display_name || "")+'</td><td class="resource-file-cell">'+esc(row.file_name)+'</td></tr>';
      }).join("") : '<tr><td colspan="6" class="text-center">No resources match your search.</td></tr>';
      body.querySelectorAll(".resource-row-select").forEach(function(input){input.addEventListener("change",function(){ if(input.checked) selectedResources.add(input.value); else selectedResources.delete(input.value); updateBulkControls(); });});
    } else {
      body.innerHTML = visibleRows.length ? visibleRows.map(function(row){
        const checked = selectedResources.has(String(row.resource_id)) ? " checked" : "";
        return '<tr data-resource-row="'+esc(row.resource_id)+'"><td class="resource-select-column"><input type="checkbox" class="resource-row-select" value="'+esc(row.resource_id)+'"'+checked+' aria-label="Select '+esc(row.file_name)+'"></td>'+ '<td>'+esc(formatLevel(row.level))+'</td><td>'+esc(row.subject_name)+'</td><td>'+esc(formatClassLabel(row.class_label))+'</td><td class="resource-file-cell">'+esc(row.file_name)+'</td></tr>';
      }).join("") : '<tr><td colspan="5" class="text-center">No resources match the current selection.</td></tr>';
      body.querySelectorAll(".resource-row-select").forEach(function(input){input.addEventListener("change",function(){ if(input.checked) selectedResources.add(input.value); else selectedResources.delete(input.value); updateBulkControls(); });});
    }
    table.style.visibility = "visible";
    updateResourceSortIndicators();
    updateBulkControls();
  }

  function setResourceSort(key){
    if(!key) return;
    if(resourceSortState.key===key) resourceSortState.direction*=-1;
    else { resourceSortState.key=key; resourceSortState.direction=1; }
    render();
  }

  function sortResourceRows(rows){
    if(!resourceSortState.key) return rows.slice();
    const key=resourceSortState.key, direction=resourceSortState.direction;
    return rows.slice().sort(function(a,b){
      const av=resourceSortValue(a,key), bv=resourceSortValue(b,key);
      return resourceSortCollator.compare(av,bv)*direction;
    });
  }

  function resourceSortValue(row,key){
    if(key==="level") return formatLevel(row.level);
    if(key==="subject") return String(row.subject_name||"");
    if(key==="class") return formatClassLabel(row.class_label);
    if(key==="teacher") return String(row.teacher_display_name||"");
    if(key==="file") return String(row.file_name||"");
    return "";
  }

  function updateResourceSortIndicators(){
    document.querySelectorAll("#classResourcesTable th[data-sort-key]").forEach(function(heading){
      const indicator=heading.querySelector(".resource-sort-indicator");
      if(!indicator) return;
      indicator.textContent=resourceSortState.key===heading.dataset.sortKey ? (resourceSortState.direction===1?"▲":"▼") : "↕";
    });
  }

  function selectAllVisible(){ visibleRows.forEach(function(r){selectedResources.add(String(r.resource_id));}); render(); }
  function clearSelected(){ selectedResources.clear(); render(); }
  function updateBulkControls(){
    const count = selectedResources.size;
    const download = byId("downloadSelectedResources");
    const remove = byId("deleteSelectedResources");
    if (download) download.disabled = !count;
    if (remove) remove.disabled = !count || isStudentLike();
    const label=byId("selectedResourceCount"); if(label) label.textContent=count+" selected";
  }

  function selectedRows(){return (dataState.resources||[]).filter(function(r){return selectedResources.has(String(r.resource_id));});}

  function downloadSelected(){
    const rows=selectedRows(); if(!rows.length) return;
    tableMessage("Preparing selected resources...","info");
    if(rows.length===1){
      window.GLIPStorageDownload.downloadFile(rows[0].file_id)
        .then(function(){
          selectedResources.clear();
          render();
          tableMessage("File downloaded.","success");
        })
        .catch(function(e){tableMessage(e.message,"error");});
      return;
    }
    window.GLIPStorageDownload.post({action:"downloadSelectedClassResources",teacher_id:teacherId(),student_id:sessionStorage.getItem("glipStudentId")||"",resource_ids:rows.map(function(r){return r.resource_id;})})
      .then(function(result){
        window.GLIPStorageDownload.downloadBase64(result);
        selectedResources.clear();
        render();
        tableMessage("Selected resources downloaded.","success");
      })
      .catch(function(e){tableMessage(e.message,"error");});
  }

  function confirmDeleteSelected(){
    const rows=selectedRows(); if(!rows.length) return;
    const doDelete=function(){deleteSelected(rows);};
    if(typeof window.showGlipConfirmModal==="function"){
      window.showGlipConfirmModal({title:"Delete resources",bodyHtml:"<p>Delete <strong>"+rows.length+" selected resource"+(rows.length===1?"":"s")+"</strong>?</p><p>The files will no longer be available to students.</p>",noConfirmationInput:true,dangerous:true,extraButtonText:"Delete",extraButtonAction:doDelete});
    } else doDelete();
  }

  function deleteSelected(rows){
    const ids=rows.map(function(r){return String(r.resource_id);});
    setDeleting(true, ids.length);
    tableMessage(ids.length===1?"Deleting resource from Google Drive...":"Deleting resources from Google Drive...","info");

    // Deliberately not optimistic: destructive Drive operations must be
    // confirmed by the server before the browser removes any table rows.
    window.GLIPStorageDownload.post({action:"deleteClassResources",teacher_id:teacherId(),resource_ids:ids})
      .then(function(result){
        if(!result||result.status!=="success")throw new Error(result&&result.message||"Could not delete resources.");
        ids.forEach(function(id){selectedResources.delete(id);});
        invalidateResourceCaches();
        if(result.storage){dataState.storage=result.storage;renderUsage(result.storage);}
        return load(false);
      })
      .then(function(){
        tableMessage(ids.length===1?"Resource deleted and table updated.":ids.length+" resources deleted and table updated.","success");
      })
      .catch(function(error){
        // Nothing was removed optimistically, so the existing row remains visible.
        render();
        tableMessage(error.message||"Could not delete resources.","error");
      })
      .finally(function(){setDeleting(false,0);});
  }

  async function upload(){
    resetUploadMessages();
    const assignmentIds=Array.from(document.querySelectorAll("#resourceAssignmentList input[type=checkbox]:checked")).map(function(i){return i.value;});
    const input=byId("classResourceFile"), file=input&&input.files?input.files[0]:null;
    if(!assignmentIds.length){uploadMessage("Select at least one class before uploading.","error");return;}
    if(!file){uploadMessage("Choose a file before uploading.","error");return;}
    if(file.size>10*1024*1024){uploadMessage("The file is too large. The maximum size is 10 MB.","error");return;}
    setUploading(true);
    try{
      const result=await window.GLIPStorageDownload.post({action:"uploadClassResources",teacher_id:teacherId(),class_teacher_ids:assignmentIds,file_name:file.name,file_size_bytes:file.size,mime_type:file.type||"application/octet-stream",file_base64:await toBase64(file)});
      if(!result||result.status!=="success")throw new Error(result&&result.message||"Upload failed.");
      uploadMessage(result.message||"Resource uploaded successfully.","success");
      input.value=""; hideFileStatus();
      setUploadStage("Updating the resources table...");
      invalidateResourceCaches();
      if(result.storage){dataState.storage=result.storage;renderUsage(result.storage);}
      await load(false);
      uploadMessage("Resources table updated.","success");
      setUploadStage("");
      setAllAssignments(false);
    }catch(error){uploadMessage(error.message,"error");}
    finally{setUploading(false);}
  }

  function resetUploadMessages(){
    uploadMessage("", "");
    setUploadStage("");
  }
  function isStudent(){
    return String(sessionStorage.getItem("glipUserType") || "").toLowerCase() === "student";
  }

  function isSupportOnly(){
    if (window.GLIPTeachingRole && typeof window.GLIPTeachingRole.isSupportOnly === "function") {
      return window.GLIPTeachingRole.isSupportOnly();
    }

    return String(sessionStorage.getItem("glipSupportOnly") || "").toLowerCase() === "true";
  }

  function isStudentLike(){
    return isStudent() || isSupportOnly();
  }
  function applyRoleLayout(){
    const student = isStudentLike();
    const filterGroup = byId("studentResourceFilterGroup");
    const deleteButton = byId("deleteSelectedResources");
    const storageUsage = byId("classResourcesStorageUsage");
    if(filterGroup){ filterGroup.hidden=student; filterGroup.style.display=student?"none":""; }
    byId("teacherResourceBulkToolbar")?.toggleAttribute("hidden", false);
    if(deleteButton){ deleteButton.hidden=student; deleteButton.style.display=student?"none":""; }
    byId("teacherResourceHeader")?.toggleAttribute("hidden", student);
    byId("studentResourceHeader")?.toggleAttribute("hidden", !student);
    if(storageUsage){ storageUsage.hidden=student; storageUsage.style.display=student?"none":""; }
    const intro = byId("availableResourcesIntro");
    if (intro) intro.textContent = student ? "Search and download the resources available to your class." : "View, download or delete the resources shared with your classes.";
    const subtitle = byId("classResourcesSubtitle");
    if (subtitle) subtitle.textContent = student ? "Files shared with your class" : "Files shared with your classes";
  }

  function updateFileName(){
    const input=byId("classResourceFile"), file=input&&input.files?input.files[0]:null, status=byId("classResourceFileStatus"), name=byId("classResourceFileName");
    if(!status||!name)return;
    if(file){status.hidden=false;name.textContent=file.name;}else{status.hidden=true;name.textContent="";}
  }
  function hideFileStatus(){const status=byId("classResourceFileStatus"),name=byId("classResourceFileName");if(status)status.hidden=true;if(name)name.textContent="";}
  function setUploadStage(text){const el=byId("classResourceUploadStage");if(el){el.textContent=text||"";el.hidden=!text;}}
  function setUploading(value){const b=byId("uploadClassResourceBtn"),p=byId("classResourceUploadProgress");if(b){b.disabled=value;b.textContent=value?"Uploading...":"Upload resource";}if(p)p.classList.toggle("show",value||!!byId("classResourceUploadStage")?.textContent);}
  function setAllAssignments(v){document.querySelectorAll("#resourceAssignmentList input[type=checkbox]").forEach(function(i){i.checked=v;});}
  function clearFilters(){if(byId("classResourceSearch"))byId("classResourceSearch").value="";if(!isStudentLike()&&byId("classResourceFilter"))byId("classResourceFilter").value="";render();}
  function invalidateResourceCaches(){window.GLIPStoragePageCache?.clear(["listMyClassResources","getTeacherStorageDashboard"]);}

  function setDeleting(value,count){
    const progress=byId("classResourcesDeleteProgress");
    const label=byId("classResourcesDeleteStage");
    document.querySelectorAll("#teacherResourceBulkToolbar button, #classResourcesBody input[type=checkbox]").forEach(function(el){
      if(value){el.disabled=true;}
      else if(el.id==="downloadSelectedResources"||el.id==="deleteSelectedResources"){el.disabled=!selectedResources.size;}
      else{el.disabled=false;}
    });
    if(progress)progress.classList.toggle("show",value);
    if(label){
      label.hidden=!value;
      label.textContent=value?("Deleting "+count+" resource"+(count===1?"":"s")+"..."):"";
    }
  }
  function toBase64(file){return new Promise(function(resolve,reject){const r=new FileReader();r.onload=function(){resolve(String(r.result).split(",")[1]||"");};r.onerror=reject;r.readAsDataURL(file);});}
  function uploadMessage(v,t){const el=byId("classResourceUploadMessage");if(el){el.textContent=v||"";el.className="panel-message text-center "+(t||"");}}
  function tableMessage(v,t){const el=byId("classResourcesMessage");if(el){el.textContent=v||"";el.className="panel-message text-center "+(t||"");}}
  function loading(v){const el=byId("classResourcesLoading");if(el)el.style.display=v?"block":"none";}
  function teacherId(){return sessionStorage.getItem("glipTeacherId")||"";}
  function formatLevel(v){const m=String(v||"").match(/\d+/);return m?"Level "+Number(m[0]):String(v||"");}
  function formatClassLabel(v){return String(v||"").replace(/_(\d{2,4})$/, "-$1");}
  function mb(v,d){return (Number(v||0)/1024/1024).toFixed(d===undefined?1:d);}
  function byId(id){return document.getElementById(id);}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
})();
