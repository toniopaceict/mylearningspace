(function () {
  "use strict";

  const DESIGNATIONS = ["lead_teacher", "subject_teacher", "support"];
  const CAPABILITIES = Object.freeze({
    VIEW_SUBJECTS: "view_subjects",
    VIEW_CLASS_RESOURCES: "view_class_resources",
    MANAGE_WORK_FOLDERS: "manage_work_folders",
    VIEW_STUDENT_WORK: "view_student_work",
    VIEW_PROGRESS: "view_progress",
    MANAGE_TOPICS: "manage_topics",
    MANAGE_TEACHING_ASSIGNMENTS: "manage_teaching_assignments"
  });

  const DESIGNATION_CAPABILITIES = Object.freeze({
    lead_teacher: [CAPABILITIES.VIEW_SUBJECTS, CAPABILITIES.VIEW_CLASS_RESOURCES, CAPABILITIES.MANAGE_WORK_FOLDERS, CAPABILITIES.VIEW_STUDENT_WORK, CAPABILITIES.VIEW_PROGRESS, CAPABILITIES.MANAGE_TOPICS, CAPABILITIES.MANAGE_TEACHING_ASSIGNMENTS],
    subject_teacher: [CAPABILITIES.VIEW_SUBJECTS, CAPABILITIES.VIEW_CLASS_RESOURCES, CAPABILITIES.MANAGE_WORK_FOLDERS, CAPABILITIES.VIEW_STUDENT_WORK, CAPABILITIES.VIEW_PROGRESS],
    support: [CAPABILITIES.VIEW_SUBJECTS, CAPABILITIES.VIEW_CLASS_RESOURCES]
  });

  function glipUrl(path){ const base=String(window.GLIP_BASE_URL||"").replace(/\/$/,""); return base+(String(path||"").startsWith("/")?path:"/"+path); }
  function key(v){ return String(v || "").trim().toLowerCase(); }
  function truth(v){ return v === true || ["true","yes","1"].includes(key(v)); }
  function level(v){ const m=String(v||"").match(/\d+/); return m ? "level-"+m[0].padStart(2,"0") : ""; }
  function accountRole(){ return key(sessionStorage.getItem("glipRole") || sessionStorage.getItem("glipTeacherRole") || sessionStorage.getItem("glipUserType")); }
  function readPermissions(){ try { const x=JSON.parse(sessionStorage.getItem("glipTeacherPermissions")||"[]"); return Array.isArray(x)?x:[]; } catch(e){ return []; } }
  function permissions(options){ const includeInactive=options&&options.includeInactive; return readPermissions().map(function(p){ return Object.assign({},p,{designation:key(p.designation),active:truth(p.active),archived:truth(p.archived),level:level(p.level||p.level_code),subject_id:String(p.subject_id||p.subject_pk||"").trim(),curriculum_id:String(p.curriculum_id||"").trim(),class_id:String(p.class_id||"").trim()}); }).filter(function(p){ return DESIGNATIONS.includes(p.designation) && (includeInactive || (p.active && !p.archived)); }); }
  function designations(){ return Array.from(new Set(permissions().map(function(p){return p.designation;}))); }
  function isSupportOnly(){ const p=permissions(); return accountRole()==="teacher" && p.length>0 && p.every(function(x){return x.designation==="support";}); }
  function hasCapability(capability){ const role=accountRole(); if(role==="owner"||role==="admin") return true; return permissions().some(function(p){ return (DESIGNATION_CAPABILITIES[p.designation]||[]).includes(capability); }); }
  function matching(subjectId, levelValue, classId, curriculumId){ return permissions().filter(function(p){ if(subjectId && p.subject_id!==String(subjectId)) return false; if(levelValue && p.level!==level(levelValue)) return false; if(classId && p.class_id!==String(classId)) return false; if(curriculumId && p.curriculum_id!==String(curriculumId)) return false; return true; }); }
  function hasCapabilityFor(capability, context){
    const role=accountRole();
    if(role==="owner"||role==="admin") return true;
    const c=context||{};

    // Lead Teacher authority is curriculum-scoped (subject + level), not class-scoped.
    if(capability===CAPABILITIES.MANAGE_TOPICS){
      return matching(c.subject_id,c.level,null,c.curriculum_id).some(function(p){
        return p.designation==="lead_teacher";
      });
    }

    // Storage, student work and progress stay tied to the exact class assignment.
    return matching(c.subject_id,c.level,c.class_id,c.curriculum_id).some(function(p){
      return (DESIGNATION_CAPABILITIES[p.designation]||[]).includes(capability);
    });
  }
  function primaryLevel(){ const stored=level(sessionStorage.getItem("glipLevel")); if(stored) return stored; const p=permissions()[0]; return p?p.level:""; }
  function getSchool(){ const m=location.pathname.match(/\/schools\/([^/]+)\//i); const x=m?m[1]:""; return x&&x!=="management"?x:String(sessionStorage.getItem("glipSchool")||""); }
  function getNavigationItems(){ const school=getSchool(), items=[]; if(accountRole()!=="teacher"||!permissions().length) return items; items.push({text:"⌂ Subjects",url:glipUrl("/schools/"+school+"/subjects-home.html")}); items.push({text:"▧ Resources",url:glipUrl("/schools/management/class-resources.html")}); if(hasCapability(CAPABILITIES.MANAGE_TOPICS)) items.push({text:"▤ Topic Management",url:glipUrl("/schools/management/topic-management.html")}); if(hasCapability(CAPABILITIES.MANAGE_TEACHING_ASSIGNMENTS)) items.push({text:"▦ Teaching Assignments",url:glipUrl("/schools/management/teaching-assignments.html")}); if(hasCapability(CAPABILITIES.MANAGE_WORK_FOLDERS)){ items.push({text:"▣ My GLIP Storage",url:glipUrl("/schools/management/work-folder-management.html")}); items.push({text:"▨ Student Work",url:glipUrl("/schools/management/student-submissions.html")}); } if(hasCapability(CAPABILITIES.VIEW_PROGRESS)) items.push({text:"◔ Progress",url:"#"}); items.push({spacer:true}); return items; }
  function requireCapability(capability, context){ if(hasCapabilityFor(capability,context)||(!context&&hasCapability(capability))) return true; if(typeof window.redirectToSchoolLogin==="function") window.redirectToSchoolLogin(); return false; }

  window.GLIPTeachingRole=Object.freeze({CAPABILITIES:CAPABILITIES,getRole:accountRole,getAccountRole:accountRole,getPermissions:permissions,getDesignations:designations,getPrimaryLevel:primaryLevel,getPrimaryLevelNumber:function(){const m=primaryLevel().match(/\d+/);return m?m[0]:"";},hasAssignments:function(){return permissions().length>0;},hasCapability:hasCapability,hasCapabilityFor:hasCapabilityFor,hasSubjectLevelPermission:function(s,l){return accountRole()==="owner"||accountRole()==="admin"||matching(s,l).length>0;},isTeachingRole:function(){return accountRole()==="teacher"&&!isSupportOnly();},isStudentLikeRole:function(){return accountRole()==="student"||isSupportOnly();},isSupportOnly:isSupportOnly,getNavigationItems:getNavigationItems,requireCapability:requireCapability,normaliseLevel:level});
})();
