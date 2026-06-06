/*******************************
* ATS Resume Builder — Single File
* - Auto-generate from JD
* - Expand skills/projects
* - ATS estimator & suggestions
* - Inline editing of preview
* - PDF / DOC fallback / TXT / JSON exports
*******************************/

// ---------- Helpers & Data ----------
const ACTION_VERBS = ["Led","Owned","Built","Designed","Developed","Implemented","Optimized","Automated","Streamlined","Launched","Architected","Delivered","Enhanced","Analyzed","Deployed","Improved","Reduced","Increased","Mentored","Collaborated","Integrated"];
const SKILL_EXPANDER = {
react: ["React (Hooks, Context)", "Component-driven UI", "SPA patterns"],
node: ["Node.js (Express)", "REST APIs", "Middleware"],
javascript: ["ES6+", "Async/Await", "Modular JS"],
typescript: ["Type-safe code", "Generics", "Strict mode"],
sql: ["SQL Joins/CTEs", "Query tuning"],
mongodb: ["MongoDB (Mongoose)", "Aggregation"],
aws: ["AWS (S3, EC2)", "IAM", "CI/CD basics"],
docker: ["Docker, containerization"]
};

// Bug 2 Fix: Removed all pre-filled default values
const DEFAULT = {
name: "",
role: "",
email: "",
phone: "",
location: "",
skills: "",
projects: [],
experiences: [],
education: [],
summary: ""
};

let state = JSON.parse(JSON.stringify(DEFAULT));

// DOM aliases
const $ = id => document.getElementById(id);
const previewEl = $('preview');
const atsBadge = $('atsBadge');
const matchedListEl = $('matchedList');
const missingListEl = $('missingList');

// ---------- Text utilities ----------
function toKeywords(text){
return (text||"").toLowerCase().replace(/[^a-z0-9+.# ]/g," ").split(/\s+/).filter(w => w.length>2);
}
function uniq(arr){ return Array.from(new Set(arr)); }
function pickAction(){ return ACTION_VERBS[Math.floor(Math.random()*ACTION_VERBS.length)]; }

// Expand skill into descriptive lines
function expandSkillText(skill){
const key = skill.trim().toLowerCase();
const found = Object.keys(SKILL_EXPANDER).find(k=> key.includes(k));
if(found) return SKILL_EXPANDER[found];
return [skill.trim()];
}

// Expand project into bullets
function expandProject(p){
const tech = (p.tech || "").split(",").map(s=>s.trim()).filter(Boolean);
const bullets = [];
bullets.push(`${pickAction()} ${p.name} — ${p.brief}.`);
if(tech.length) bullets.push(`Implemented core features using ${tech.join(", ")}.`);
bullets.push("Focused on performance, accessibility, and responsive UI.");
bullets.push("Added monitoring, error handling, and documentation to improve maintainability.");
return bullets;
}

// Expand experience if empty
function expandExperience(e, skillsCsv){
const skills = uniq((skillsCsv||"").split(",").map(s=>s.trim()).filter(Boolean));
const bullets = [];
bullets.push(`${pickAction()} features end-to-end — requirements, design, implementation, testing, and release.`);
if(skills.length) bullets.push(`Worked with ${skills.slice(0,4).join(", ")}${skills.length>4 ? ", etc." : ""}.`);
bullets.push("Improved performance and reduced defects via testing and automation.");
bullets.push("Collaborated across design, QA, and backend to ship on schedule.");
return bullets;
}

// Generate a concise summary
function genSummary(name, role, skillsCsv){
const skills = uniq((skillsCsv||"").split(",").map(s=>s.trim()).filter(Boolean));
if(!role && !skills.length) return "";
const rolePart = role || "Professional";
const skillPart = skills.length ? ` with hands-on experience across ${skills.slice(0,6).join(", ")}${skills.length>6? ", etc." : ""}` : "";
return `${rolePart}${skillPart}. Strong ownership and bias for delivery.`;
}

// ---------- ATS Scoring ----------
const IMPORTANT = new Set(["react","next","javascript","typescript","node","python","java","sql","mongodb","mysql","docker","aws","devops","testing","automation","git","ci","cd","ml","ai","opencv","langchain","rag"]);

function scoreATS(resumeText, jd){
const rWords = new Set(toKeywords(resumeText));
const jdWords = uniq(toKeywords(jd)).filter(w=>w.length>3);
const matched=[], missing=[];
jdWords.forEach(w => rWords.has(w) ? matched.push(w) : missing.push(w));
const total = jdWords.length + jdWords.filter(w=>IMPORTANT.has(w)).length;
const got = matched.length + matched.filter(w=>IMPORTANT.has(w)).length;
const score = total ? Math.round((got/total)*100) : 100;
return { score: Math.min(score,99), matched: uniq(matched).slice(0,50), missing: uniq(missing).slice(0,50) };
}

// ---------- Bug 1 Fix: Check if resume is empty ----------
function isResumeEmpty(){
  return !previewEl.innerText.trim();
}

// ---------- Generate Resume HTML ----------
function buildResumeHtml(data){
// Check if any meaningful data exists
const hasContent = data.name || data.role || data.email || data.phone || data.location || data.skills || (data.experiences||[]).length || (data.projects||[]).length || (data.education||[]).length;
if(!hasContent) return "";

const lines = [];

// header — only show non-empty parts
if(data.name) lines.push(`<div class="heading">${escapeHtml(data.name)}</div>`);
if(data.role) lines.push(`<div class="meta">${escapeHtml(data.role)}</div>`);
const contactParts = [data.location, data.phone, data.email].filter(Boolean);
if(contactParts.length) lines.push(`<div class="meta">${contactParts.map(s=>escapeHtml(s)).join(" | ")}</div>`);

// summary — only if there's content
const summaryText = data.summary || genSummary(data.name, data.role, data.skills);
if(summaryText) {
  lines.push(`<div class="section-title">Summary</div>`);
  lines.push(`<div>${escapeHtml(summaryText)}</div>`);
}

// skills (expanded) — only if there are skills
const skillList = uniq((data.skills||"").split(",").map(s=>s.trim()).filter(Boolean));
if(skillList.length) {
  const expanded = skillList.flatMap(s=>expandSkillText(s));
  lines.push(`<div class="section-title">Skills</div>`);
  lines.push(`<div>${expanded.map(s=>escapeHtml(s)).join(" • ")}</div>`);
}

// experience — only if there are entries
if((data.experiences||[]).length){
  lines.push(`<div class="section-title">Experience</div>`);
  (data.experiences||[]).forEach((exp)=>{
    const h = exp.highlights && exp.highlights.filter(x=>x.trim()).length ? exp.highlights : expandExperience(exp, data.skills);
    lines.push(`<div><strong>${escapeHtml(exp.title)} — ${escapeHtml(exp.company)}</strong> <span class="tiny text-muted">${escapeHtml(exp.start)} – ${escapeHtml(exp.end)}</span></div>`);
    lines.push(`<ul>${h.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`);
  });
}

// projects — only if there are entries
if((data.projects||[]).length){
  lines.push(`<div class="section-title">Projects</div>`);
  data.projects.forEach(p=>{
    const bullets = expandProject(p);
    lines.push(`<div><strong>${escapeHtml(p.name)}</strong> ${p.tech?`<span class="tiny text-muted">— [${escapeHtml(p.tech)}]</span>`: ""}</div>`);
    lines.push(`<ul>${bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>`);
  });
}

// education — only if there are entries
if((data.education||[]).length){
  lines.push(`<div class="section-title">Education</div>`);
  (data.education||[]).forEach(ed => {
    lines.push(`<div>${escapeHtml(ed.degree)} , ${escapeHtml(ed.school)} — ${escapeHtml(ed.year)}</div>`);
  });
}

return lines.join("");
}

// Simple escape to avoid injection in contentEditable
function escapeHtml(str){
if(!str && str!==0) return "";
return String(str).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// ---------- UI wiring ----------
function readFormToState(){
state.name = $('name').value || DEFAULT.name;
state.role = $('role').value || DEFAULT.role;
state.email = $('email').value || DEFAULT.email;
state.phone = $('phone').value || DEFAULT.phone;
state.location = $('location').value || DEFAULT.location;
state.skills = $('skills').value || DEFAULT.skills;
// projects: parse lines into objects {name, brief, tech}
const projRaw = ($('projects').value||"").split('\n').map(l=>l.trim()).filter(Boolean);
state.projects = projRaw.map(line=>{
  let [nameAndBrief, techPart] = line.split('—').map(s=>s.trim());
  if(!techPart) {
    const parts = line.split('|').map(s=>s.trim());
    if(parts.length>1){ nameAndBrief = parts[0]; techPart = parts.slice(1).join(', '); }
  }
  let name = nameAndBrief;
  let brief = (nameAndBrief || "");
  return { name: name, brief: brief, tech: techPart || "" };
});

state.experiences = state.experiences && state.experiences.length ? state.experiences : DEFAULT.experiences;
state.education = state.education && state.education.length ? state.education : DEFAULT.education;
state.summary = state.summary || "";
}

function renderPreview(){
const html = buildResumeHtml(state);
previewEl.innerHTML = html;
previewEl.contentEditable = html ? "true" : "false";
updateATS();
}

// ---------- ATS helpers ----------
function updateATS(){
const resumeText = previewEl.innerText || "";
const jd = $('jd').value || "";
if(!resumeText.trim()){
  atsBadge.textContent = "ATS: —";
  atsBadge.className = "badge bg-warning text-dark";
  matchedListEl.textContent = "—";
  missingListEl.textContent = "—";
  return;
}
const res = scoreATS(resumeText, jd);
atsBadge.textContent = `ATS: ${res.score}/100`;
atsBadge.className = res.score >= 85 ? "badge bg-success" : "badge bg-warning text-dark";
matchedListEl.textContent = res.matched.join(", ") || "—";
missingListEl.textContent = res.missing.join(", ") || "—";
state.atsScore = res.score;
state.atsMatched = res.matched;
state.atsMissing = res.missing;
}

// Auto-add keywords from JD to skills
function autoAddKeywords(){
const jd = $('jd').value || "";
if(!jd.trim()) { alert("Paste the job description first."); return; }
const jdKs = uniq(toKeywords(jd));
const curSkills = uniq((state.skills||"").toLowerCase().split(',').map(s=>s.trim()).filter(Boolean));
const missing = jdKs.filter(k=>k.length>3 && !curSkills.includes(k));
if(!missing.length){ alert("No missing keywords found or skills already include JD keywords."); return; }
const toAdd = missing.slice(0,10).join(", ");
state.skills = (state.skills ? state.skills + ", " : "") + toAdd;
 $('skills').value = state.skills;
generatePreviewFromForm();
alert(`Added keywords: ${toAdd}`);
}

// ---------- Auto-generate CV from JD ----------
function generateFromJD(){
const jd = $('jd').value || "";
if(!jd.trim()){ alert("Please paste the job description first."); return; }
const words = toKeywords(jd);
const freq = {};
words.forEach(w=> freq[w] = (freq[w]||0)+1);
const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
const stop = new Set(["experience","years","year","position","role","responsible","ability","work","team","strong","skills","good","candidate"]);
const skillSeeds = sorted.filter(w => !stop.has(w) && w.length>3).slice(0,8);
const jdLines = jd.split('\n').map(l=>l.trim()).filter(Boolean);
const guessTitle = jdLines.length ? jdLines[0].slice(0,80) : state.role;

state.role = guessTitle || state.role;
 $('role').value = state.role;
state.skills = skillSeeds.join(", ");
 $('skills').value = state.skills;

state.experiences = [{
  title: state.role,
  company: "Auto-generated — Target role",
  start: "2021",
  end: "Present",
  highlights: [
    `${pickAction()} and delivered solutions aligned with the job requirements.`,
    `Worked with ${skillSeeds.slice(0,4).join(", ")} across feature development and maintenance.`,
    `Improved reliability and performance through tests and automation.`
  ]
}];

state.projects = skillSeeds.length ? skillSeeds.slice(0,3).map((s,idx)=>({
  name: `${s.charAt(0).toUpperCase()+s.slice(1)} Project ${idx+1}`,
  brief: `Implemented core ${s} functionality per JD requirements.`,
  tech: s
})) : [{ name: "Project 1", brief: "Auto-implemented project based on JD", tech: "" }];

state.summary = genSummary(state.name||DEFAULT.name, state.role, state.skills);

 $('projects').value = state.projects.map(p => `${p.name} — ${p.brief}${p.tech? " — " + p.tech : ""}`).join("\n");
generatePreviewFromForm();
alert("Auto-generation from JD complete. Review & edit the preview as needed.");
}

// ---------- Form -> Preview ----------
function generatePreviewFromForm(){
readFormToState();
const projRaw = ($('projects').value||"").split('\n').map(l=>l.trim()).filter(Boolean);
state.projects = projRaw.map(line=>{
  const parts = line.split('—').map(s=>s.trim());
  const name = parts[0] || line;
  const brief = parts.slice(1).join(' — ') || name;
  let tech = "";
  const techMatch = brief.match(/\[(.*)\]$/);
  if(techMatch) tech = techMatch[1];
  return { name, brief, tech };
});

if(!state.summary || !state.summary.trim()) state.summary = genSummary(state.name||DEFAULT.name, state.role||DEFAULT.role, state.skills||DEFAULT.skills);

state.experiences = (state.experiences && state.experiences.length) ? state.experiences : DEFAULT.experiences;
state.experiences = state.experiences.map(e=>({
  title: e.title || "Role",
  company: e.company || "Company",
  start: e.start || "2022",
  end: e.end || "Present",
  highlights: (e.highlights && e.highlights.length) ? e.highlights : expandExperience(e, state.skills)
}));

renderPreview();
}

// ---------- Exports ----------
async function exportPDF(){
// Bug 1 Fix: Check if resume is empty before exporting
if(isResumeEmpty()){ alert("Please fill the form first."); return; }
try{
  const el = previewEl;
  const canvas = await html2canvas(el, { scale:2, useCORS:true, backgroundColor:"#ffffff" });
  const img = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit:'pt', format:'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = Math.min(pageW/imgW, (pageH-40)/imgH);
  const x = (pageW - imgW*ratio)/2;
  pdf.addImage(img, 'PNG', x, 20, imgW*ratio, imgH*ratio);
  pdf.save("resume.pdf");
}catch(err){ console.error("PDF export error:", err); alert("PDF export failed — check console."); }
}

function exportTXT(){
// Bug 1 Fix: Check if resume is empty before exporting
if(isResumeEmpty()){ alert("Please fill the form first."); return; }
try{
  const txt = previewEl.innerText;
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "resume.txt"; a.click(); URL.revokeObjectURL(a.href);
}catch(err){ console.error("TXT export error:", err); alert("TXT export failed."); }
}

function exportJSON(){
// Bug 1 Fix: Check if resume is empty before exporting
if(isResumeEmpty()){ alert("Please fill the form first."); return; }
try{
  const blob = new Blob([JSON.stringify({ preview: previewEl.innerText }, null, 2)], { type: "application/json" });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "resume.json"; a.click(); URL.revokeObjectURL(a.href);
}catch(err){ console.error("JSON export error:", err); alert("JSON export failed."); }
}

function exportDOC(){
// Bug 1 Fix: Check if resume is empty before exporting
if(isResumeEmpty()){ alert("Please fill the form first."); return; }
try{
  const html = `
    <html><head><meta charset="utf-8"></head><body>
    ${previewEl.innerHTML}
    </body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "resume.doc"; a.click(); URL.revokeObjectURL(a.href);
}catch(err){ console.error("DOC export error:", err); alert("DOC export failed."); }
}

// ---------- Bind events ----------
document.addEventListener('DOMContentLoaded', ()=>{
 $('generateBtn').addEventListener('click', generatePreviewFromForm);
 $('genFromJD').addEventListener('click', generateFromJD);
 $('autoAddKeywords').addEventListener('click', autoAddKeywords);

// Bug 4 Fix: Reset clears form, preview, and ATS display completely
 $('resetBtn').addEventListener('click', ()=>{
  state = JSON.parse(JSON.stringify(DEFAULT));
  $('name').value = "";
  $('role').value = "";
  $('email').value = "";
  $('phone').value = "";
  $('location').value = "";
  $('skills').value = "";
  $('projects').value = "";
  $('jd').value = "";
  previewEl.innerHTML = "";
  previewEl.contentEditable = "false";
  atsBadge.textContent = "ATS: —";
  atsBadge.className = "badge bg-warning text-dark";
  matchedListEl.textContent = "—";
  missingListEl.textContent = "—";
});

 $('exportPDF').addEventListener('click', exportPDF);
 $('exportTXT').addEventListener('click', exportTXT);
 $('exportJSON').addEventListener('click', exportJSON);
 $('exportDOC').addEventListener('click', exportDOC);

// Inline editing: update ATS on blur or input
previewEl.addEventListener('input', ()=> { updateATS(); });

// Bug 2 Fix: Do NOT pre-fill form fields or auto-generate on load
// Keep placeholders visible, preview empty
previewEl.innerHTML = "";
atsBadge.textContent = "ATS: —";
matchedListEl.textContent = "—";
missingListEl.textContent = "—";
});

// Expose some functions for console debugging
window._atsBuilder = { state, generateFromJD, generatePreviewFromForm, exportPDF, exportDOC, exportTXT, exportJSON };