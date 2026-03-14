import {toggleSkillDetails} from "./popup-detail.js";
import {copyCommand,downloadCollection,downloadSkill} from "./popup-download.js";

const state={currentOwner:"",currentRepo:"",currentTree:[],currentTreeSha:"",defaultBranch:"",currentRepoUpdated:false,currentSkillsData:[],historyData:[],collections:[],openCollectionIds:new Set(),activeView:"main",modalSkill:null};
let customMessages=null;
let refs={};

document.addEventListener("DOMContentLoaded",async()=>{
  refs=collectRefs();
  await initI18n();
  localizeHtmlPage();
  bindEvents();
  await loadSettings();
  showView("main");
  await loadCollections();
  await loadSkills();
});

function collectRefs(){
  return{
    settingsBtn:document.getElementById("settingsBtn"),
    tabCurrent:document.getElementById("tabCurrent"),
    tabHistory:document.getElementById("tabHistory"),
    tabCollections:document.getElementById("tabCollections"),
    backBtn:document.getElementById("backBtn"),
    saveTokenBtn:document.getElementById("saveTokenBtn"),
    clearHistoryBtn:document.getElementById("clearHistoryBtn"),
    createCollectionBtn:document.getElementById("createCollectionBtn"),
    collectionModalCreateBtn:document.getElementById("collectionModalCreateBtn"),
    closeCollectionModalBtn:document.getElementById("closeCollectionModalBtn"),
    mainView:document.getElementById("mainView"),
    settingsView:document.getElementById("settingsView"),
    historyView:document.getElementById("historyView"),
    collectionsView:document.getElementById("collectionsView"),
    tokenInput:document.getElementById("tokenInput"),
    autoDetectCheck:document.getElementById("autoDetectCheck"),
    langSelect:document.getElementById("langSelect"),
    status:document.getElementById("status"),
    skillsList:document.getElementById("skillsList"),
    currentSearchInput:document.getElementById("currentSearchInput"),
    historyList:document.getElementById("historyList"),
    collectionsList:document.getElementById("collectionsList"),
    searchInput:document.getElementById("searchInput"),
    tokenWarning:document.getElementById("tokenWarning"),
    linkToSettings:document.getElementById("linkToSettings"),
    collectionNameInput:document.getElementById("collectionNameInput"),
    collectionModal:document.getElementById("collectionModal"),
    collectionModalBody:document.getElementById("collectionModalBody"),
    collectionModalNameInput:document.getElementById("collectionModalNameInput"),
    collectionModalSkillName:document.getElementById("collectionModalSkillName")
  };
}

async function initI18n(){
  const {langOverride}=await chrome.storage.local.get("langOverride");
  if(langOverride&&langOverride!=="system"){
    try{
      const url=chrome.runtime.getURL(`_locales/${langOverride}/messages.json`);
      const response=await fetch(url);
      customMessages=await response.json();
    }catch(error){
      console.error("Failed to load custom locale",error);
      customMessages=null;
    }
    return;
  }
  customMessages=null;
}

function getI18nMsg(key){
  if(customMessages?.[key]?.message){
    return customMessages[key].message;
  }
  return chrome.i18n.getMessage(key)||"";
}

function localizeHtmlPage(){
  document.querySelectorAll("[data-i18n]").forEach((element)=>{
    const message=getI18nMsg(element.getAttribute("data-i18n"));
    if(message){
      element.textContent=message;
    }
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element)=>{
    const message=getI18nMsg(element.getAttribute("data-i18n-title"));
    if(message){
      element.title=message;
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element)=>{
    const message=getI18nMsg(element.getAttribute("data-i18n-placeholder"));
    if(message){
      element.placeholder=message;
    }
  });
}

function bindEvents(){
  refs.settingsBtn.addEventListener("click",()=>showView("settings"));
  refs.linkToSettings.addEventListener("click",(event)=>{event.preventDefault();showView("settings");});
  refs.tabCurrent.addEventListener("click",async()=>{showView("main");await loadSkills();});
  refs.tabHistory.addEventListener("click",async()=>{showView("history");await loadHistory();});
  refs.tabCollections.addEventListener("click",async()=>{showView("collections");await loadCollections();});
  refs.backBtn.addEventListener("click",()=>showView("main"));
  refs.saveTokenBtn.addEventListener("click",handleSaveSettings);
  refs.clearHistoryBtn.addEventListener("click",handleClearHistory);
  refs.currentSearchInput.addEventListener("input",()=>renderCurrentSkills(filterCurrentSkills(refs.currentSearchInput.value)));
  refs.searchInput.addEventListener("input",()=>renderHistory(filterHistory(refs.searchInput.value)));
  refs.createCollectionBtn.addEventListener("click",()=>handleCreateCollection(refs.collectionNameInput,false));
  refs.collectionNameInput.addEventListener("keydown",(event)=>{if(event.key==="Enter"){handleCreateCollection(refs.collectionNameInput,false);}});
  refs.collectionModalCreateBtn.addEventListener("click",()=>handleCreateCollection(refs.collectionModalNameInput,true));
  refs.collectionModalNameInput.addEventListener("keydown",(event)=>{if(event.key==="Enter"){handleCreateCollection(refs.collectionModalNameInput,true);}});
  refs.closeCollectionModalBtn.addEventListener("click",closeCollectionModal);
  refs.collectionModal.addEventListener("click",(event)=>{if(event.target===refs.collectionModal||event.target.classList.contains("modal-backdrop")){closeCollectionModal();}});
  document.addEventListener("keydown",(event)=>{if(event.key==="Escape"&&!refs.collectionModal.classList.contains("hidden")){closeCollectionModal();}});
}

async function loadSettings(){
  const {githubToken,autoDetect,langOverride}=await chrome.storage.local.get(["githubToken","autoDetect","langOverride"]);
  refs.tokenInput.value=githubToken||"";
  refs.autoDetectCheck.checked=Boolean(autoDetect);
  refs.langSelect.value=langOverride||"system";
  updateTokenWarning(Boolean(githubToken));
}

function updateTokenWarning(hasToken){
  refs.tokenWarning.style.display=hasToken?"none":"block";
}

function showView(viewName){
  state.activeView=viewName;
  refs.mainView.style.display=viewName==="main"?"block":"none";
  refs.historyView.style.display=viewName==="history"?"block":"none";
  refs.collectionsView.style.display=viewName==="collections"?"block":"none";
  refs.settingsView.style.display=viewName==="settings"?"block":"none";
  refs.tabCurrent.classList.toggle("active",viewName==="main");
  refs.tabHistory.classList.toggle("active",viewName==="history");
  refs.tabCollections.classList.toggle("active",viewName==="collections");
}

async function handleSaveSettings(){
  const githubToken=refs.tokenInput.value.trim();
  await chrome.storage.local.set({
    githubToken,
    autoDetect:refs.autoDetectCheck.checked,
    langOverride:refs.langSelect.value
  });
  await initI18n();
  localizeHtmlPage();
  updateTokenWarning(Boolean(githubToken));
  refs.currentSearchInput.value="";
  refs.searchInput.value="";
  await loadCollections();
  showView("main");
  await loadSkills();
  alert(getI18nMsg("settingsSaved"));
}

async function handleClearHistory(){
  if(!confirm(getI18nMsg("confirmClearHistory"))){
    return;
  }
  const response=await sendMessage({type:"CLEAR_HISTORY"});
  if(!response?.success){
    alertError(response?.error||"historyClearedError");
    return;
  }
  state.historyData=[];
  if(state.activeView==="history"){
    renderHistory([]);
  }
  alert(getI18nMsg("historyClearedSuccess"));
}

function createIconButton(icon,title,primary=false){
  const button=document.createElement("button");
  button.type="button";
  button.className=`icon-btn${primary?" primary":""}`;
  button.textContent=icon;
  button.title=title;
  return button;
}

function createLink(url,text){
  const link=document.createElement("a");
  link.href=url;
  link.target="_blank";
  link.textContent=text;
  link.style.color="inherit";
  link.style.textDecoration="none";
  link.addEventListener("mouseenter",()=>{link.style.textDecoration="underline";});
  link.addEventListener("mouseleave",()=>{link.style.textDecoration="none";});
  return link;
}

function createEmptyStateItem(message){
  const listItem=document.createElement("li");
  listItem.className="empty-state";
  listItem.textContent=message;
  return listItem;
}

function createModalEmptyState(message){
  const div=document.createElement("div");
  div.className="empty-state";
  div.textContent=message;
  return div;
}

function formatDate(timestamp){
  const date=new Date(timestamp||0);
  if(Number.isNaN(date.getTime())||!timestamp){
    return "-";
  }
  return date.toLocaleDateString();
}

function sanitizeFileName(value){
  return (value||"download").replace(/[<>:"/\\|?*\u0000-\u001F]/g,"-").trim()||"download";
}

function sanitizeZipSegment(value){
  return sanitizeFileName(value).replace(/\s+/g,"_");
}

function translateError(error){
  return getI18nMsg(error)||error;
}

function alertError(error){
  alert(`${getI18nMsg("errorPrefix")}${translateError(error)}`);
}

function setButtonBusy(button,label){
  if(!button.dataset.originalText){
    button.dataset.originalText=button.textContent;
  }
  button.disabled=true;
  button.textContent=label;
}

function restoreButton(button){
  button.disabled=false;
  button.textContent=button.dataset.originalText||button.textContent;
}

function sendMessage(message){
  return new Promise((resolve)=>{
    chrome.runtime.sendMessage(message,(response)=>resolve(response));
  });
}

async function loadSkills(){
  showView("main");
  state.currentSkillsData=[];
  state.currentRepoUpdated=false;
  refs.status.style.display="block";
  refs.status.textContent=getI18nMsg("detectingRepo");
  refs.skillsList.innerHTML="";
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.url){
    refs.status.textContent=getI18nMsg("cannotReadUrl");
    return;
  }
  const match=tab.url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  if(!match){
    refs.status.textContent=getI18nMsg("notGithubRepo");
    return;
  }
  state.currentOwner=match[1];
  state.currentRepo=match[2].split("/")[0].split("?")[0].split("#")[0];
  refs.status.textContent=getI18nMsg("fetchingTree");
  const response=await sendMessage({type:"FETCH_SKILLS",owner:state.currentOwner,repo:state.currentRepo,tabId:tab.id});
  if(!response){
    refs.status.textContent=getI18nMsg("errorCommBg");
    return;
  }
  if(!response.success){
    refs.status.textContent=`${getI18nMsg("errorPrefix")}${translateError(response.error)}`;
    return;
  }
  state.currentTree=response.tree||[];
  state.currentTreeSha=response.treeSha||"";
  state.defaultBranch=response.defaultBranch||"";
  state.currentRepoUpdated=Boolean(response.isUpdated);
  if(!response.skills?.length){
    state.currentSkillsData=[];
    refs.status.textContent=getI18nMsg("noSkillsFound");
    return;
  }
  state.currentSkillsData=[...(response.skills||[])];
  refs.status.style.display="none";
  renderCurrentSkills(filterCurrentSkills(refs.currentSearchInput.value));
}

async function loadHistory(){
  refs.historyList.innerHTML="";
  refs.historyList.appendChild(createEmptyStateItem(getI18nMsg("loadingHistory")));
  const response=await sendMessage({type:"GET_HISTORY"});
  if(!response?.success){
    refs.historyList.innerHTML="";
    refs.historyList.appendChild(createEmptyStateItem(getI18nMsg("errorLoadingHistory")));
    return;
  }
  state.historyData=[...(response.skills||[])].sort((a,b)=>(b.lastDetected||0)-(a.lastDetected||0));
  renderHistory(filterHistory(refs.searchInput.value));
}

function filterHistory(term){
  const keyword=(term||"").trim().toLowerCase();
  if(!keyword){
    return state.historyData;
  }
  return state.historyData.filter((skill)=>[skill.name,skill.repo,skill.owner,skill.path].filter(Boolean).some((value)=>value.toLowerCase().includes(keyword)));
}

function renderHistory(skills){
  renderSkillList(refs.historyList,skills,{source:"history",emptyMessage:getI18nMsg("noSkillsInHistory")});
}

function filterCurrentSkills(term){
  const keyword=(term||"").trim().toLowerCase();
  if(!keyword){
    return state.currentSkillsData;
  }
  return state.currentSkillsData.filter((skill)=>[skill.name,skill.path,skill.repo,skill.owner].filter(Boolean).some((value)=>value.toLowerCase().includes(keyword)));
}

function renderCurrentSkills(skills){
  renderSkillList(refs.skillsList,skills,{source:"current",showUpdatedBadge:state.currentRepoUpdated,emptyMessage:getI18nMsg("noSkillsFound")});
}

async function loadCollections(){
  if(state.activeView==="collections"){
    refs.collectionsList.innerHTML="";
    refs.collectionsList.appendChild(createEmptyStateItem(getI18nMsg("loadingCollections")));
  }
  const response=await sendMessage({type:"GET_COLLECTIONS"});
  if(!response?.success){
    if(state.activeView==="collections"){
      refs.collectionsList.innerHTML="";
      refs.collectionsList.appendChild(createEmptyStateItem(getI18nMsg("errorLoadingCollections")));
    }
    if(state.modalSkill){
      refs.collectionModalBody.innerHTML="";
      refs.collectionModalBody.appendChild(createModalEmptyState(getI18nMsg("errorLoadingCollections")));
    }
    return;
  }
  state.collections=response.collections||[];
  state.openCollectionIds=new Set([...state.openCollectionIds].filter((id)=>state.collections.some((collection)=>collection.id===id)));
  renderCollections();
  if(state.modalSkill){
    renderCollectionModal();
  }
}

function renderCollections(){
  refs.collectionsList.innerHTML="";
  if(!state.collections.length){
    refs.collectionsList.appendChild(createEmptyStateItem(getI18nMsg("noCollections")));
    return;
  }
  state.collections.forEach((collection)=>refs.collectionsList.appendChild(createCollectionCard(collection)));
}

function renderSkillList(container,skills,options={}){
  container.innerHTML="";
  if(!skills?.length){
    container.appendChild(createEmptyStateItem(options.emptyMessage||getI18nMsg("noSkillsFound")));
    return;
  }
  skills.forEach((skill)=>container.appendChild(createSkillListItem(skill,options)));
}

function createSkillListItem(rawSkill,options={}){
  const skill=normalizeSkill(rawSkill);
  const listItem=document.createElement("li");
  const infoDiv=document.createElement("div");
  infoDiv.className="skill-info";
  const nameDiv=document.createElement("div");
  nameDiv.className="skill-name";
  nameDiv.textContent=skill.name;
  if(options.showUpdatedBadge){
    const badge=document.createElement("span");
    badge.className="updated-badge";
    badge.textContent=getI18nMsg("updatedBadge");
    nameDiv.appendChild(badge);
  }
  infoDiv.appendChild(nameDiv);
  if(options.source!=="current"){
    const repoDiv=document.createElement("div");
    repoDiv.className="skill-repo";
    repoDiv.appendChild(createLink(`https://github.com/${skill.owner}/${skill.repo}`,`${skill.owner}/${skill.repo}`));
    infoDiv.appendChild(repoDiv);
  }
  const pathDiv=document.createElement("div");
  pathDiv.className="skill-path";
  if(options.source==="current"){
    pathDiv.textContent=skill.path;
  }else{
    pathDiv.appendChild(createLink(buildSkillPageUrl(skill),skill.path));
  }
  infoDiv.appendChild(pathDiv);
  if(options.source!=="current"){
    const metaDiv=document.createElement("div");
    metaDiv.className="skill-meta";
    metaDiv.textContent=`${getI18nMsg("updatedPrefix")}${formatDate(skill.lastRepoUpdate||skill.lastDetected)}`;
    infoDiv.appendChild(metaDiv);
  }
  const actionsDiv=document.createElement("div");
  actionsDiv.className="skill-actions";
  const detailsDiv=document.createElement("div");
  detailsDiv.className="skill-details";
  const infoBtn=createIconButton("ℹ️",getI18nMsg("infoBtn"));
  const addBtn=createIconButton("🗂️",getI18nMsg("addToCollectionBtn"));
  const copyBtn=createIconButton("📋",getI18nMsg("copyCommandBtn"));
  const downloadBtn=createIconButton("📦",getI18nMsg("downloadBtn"),true);
  infoBtn.addEventListener("click",()=>toggleSkillDetails(detailsDiv,skill,{getI18nMsg,createLink,getTreeForSkill,getSkillRef}));
  addBtn.addEventListener("click",()=>openCollectionModal(skill));
  copyBtn.addEventListener("click",()=>copyCommand(skill,copyBtn,{getI18nMsg,alertError,setButtonBusy,restoreButton}));
  downloadBtn.addEventListener("click",()=>downloadSkill(skill,downloadBtn,listItem,{normalizeSkill,getTreeForSkill,getSkillRef,sanitizeFileName,sanitizeZipSegment,setButtonBusy,restoreButton,alertError,getI18nMsg}));
  actionsDiv.appendChild(infoBtn);
  actionsDiv.appendChild(addBtn);
  actionsDiv.appendChild(copyBtn);
  if(options.collectionId){
    const removeBtn=createIconButton("🗑️",getI18nMsg("removeFromCollectionBtn"));
    removeBtn.addEventListener("click",()=>removeSkillFromCollection(options.collectionId,skill.id));
    actionsDiv.appendChild(removeBtn);
  }
  actionsDiv.appendChild(downloadBtn);
  const mainDiv=document.createElement("div");
  mainDiv.className="skill-main";
  mainDiv.appendChild(infoDiv);
  mainDiv.appendChild(actionsDiv);
  listItem.appendChild(mainDiv);
  listItem.appendChild(detailsDiv);
  return listItem;
}

function createCollectionCard(collection){
  const listItem=document.createElement("li");
  const infoDiv=document.createElement("div");
  infoDiv.className="collection-info";
  const nameDiv=document.createElement("div");
  nameDiv.className="collection-name";
  nameDiv.textContent=collection.name;
  const countDiv=document.createElement("div");
  countDiv.className="collection-count";
  countDiv.textContent=`${collection.items.length} ${getI18nMsg("collectionCountUnit")}`;
  const metaDiv=document.createElement("div");
  metaDiv.className="collection-meta";
  metaDiv.textContent=`${getI18nMsg("updatedPrefix")}${formatDate(collection.updatedAt)}`;
  infoDiv.appendChild(nameDiv);
  infoDiv.appendChild(countDiv);
  infoDiv.appendChild(metaDiv);
  const isOpen=state.openCollectionIds.has(collection.id);
  const actionsDiv=document.createElement("div");
  actionsDiv.className="collection-actions";
  const toggleBtn=document.createElement("button");
  toggleBtn.className="secondary-btn";
  toggleBtn.textContent=getI18nMsg(isOpen?"hideCollectionBtn":"viewCollectionBtn");
  toggleBtn.addEventListener("click",()=>{
    if(state.openCollectionIds.has(collection.id)){state.openCollectionIds.delete(collection.id);}else{state.openCollectionIds.add(collection.id);}
    renderCollections();
  });
  const renameBtn=createIconButton("✏️",getI18nMsg("renameCollectionBtn"));
  const downloadBtn=createIconButton("📦",getI18nMsg("downloadCollectionBtn"),true);
  const deleteBtn=createIconButton("🗑️",getI18nMsg("deleteCollectionBtn"));
  renameBtn.addEventListener("click",()=>renameCollection(collection));
  downloadBtn.addEventListener("click",()=>downloadCollection(collection,downloadBtn,{normalizeSkill,getTreeForSkill,getSkillRef,sanitizeFileName,sanitizeZipSegment,setButtonBusy,restoreButton,alertError,getI18nMsg}));
  deleteBtn.addEventListener("click",()=>deleteCollection(collection));
  actionsDiv.appendChild(toggleBtn);
  actionsDiv.appendChild(renameBtn);
  actionsDiv.appendChild(downloadBtn);
  actionsDiv.appendChild(deleteBtn);
  const headerDiv=document.createElement("div");
  headerDiv.className="collection-header";
  headerDiv.appendChild(infoDiv);
  headerDiv.appendChild(actionsDiv);
  const detailsDiv=document.createElement("div");
  detailsDiv.className="collection-details";
  detailsDiv.classList.toggle("open",isOpen);
  if(isOpen){
    renderCollectionDetails(detailsDiv,collection);
  }
  listItem.appendChild(headerDiv);
  listItem.appendChild(detailsDiv);
  return listItem;
}

function renderCollectionDetails(container,collection){
  container.innerHTML="";
  if(!collection.items.length){
    const empty=document.createElement("div");
    empty.className="empty-state";
    empty.textContent=getI18nMsg("noSkillsInCollection");
    container.appendChild(empty);
    return;
  }
  const nestedList=document.createElement("ul");
  nestedList.className="collection-skill-list";
  collection.items.forEach((skill)=>nestedList.appendChild(createSkillListItem(skill,{source:"collection",collectionId:collection.id})));
  container.appendChild(nestedList);
}

async function openCollectionModal(rawSkill){
  state.modalSkill=normalizeSkill(rawSkill);
  refs.collectionModalSkillName.textContent=`${state.modalSkill.owner}/${state.modalSkill.repo} · ${state.modalSkill.path}`;
  refs.collectionModal.classList.remove("hidden");
  refs.collectionModal.setAttribute("aria-hidden","false");
  refs.collectionModalNameInput.value="";
  refs.collectionModalBody.innerHTML="";
  refs.collectionModalBody.appendChild(createModalEmptyState(getI18nMsg("loadingCollections")));
  await loadCollections();
}

function closeCollectionModal(){
  state.modalSkill=null;
  refs.collectionModal.classList.add("hidden");
  refs.collectionModal.setAttribute("aria-hidden","true");
  refs.collectionModalNameInput.value="";
  refs.collectionModalBody.innerHTML="";
}

function renderCollectionModal(){
  if(!state.modalSkill){
    return;
  }
  refs.collectionModalBody.innerHTML="";
  if(!state.collections.length){
    refs.collectionModalBody.appendChild(createModalEmptyState(getI18nMsg("collectionModalEmpty")));
    return;
  }
  const list=document.createElement("div");
  list.className="collection-option-list";
  state.collections.forEach((collection)=>{
    const option=document.createElement("label");
    option.className="collection-option";
    const checkbox=document.createElement("input");
    checkbox.type="checkbox";
    checkbox.checked=collection.items.some((item)=>item.id===state.modalSkill.id);
    checkbox.addEventListener("change",async(event)=>{
      event.target.disabled=true;
      await toggleSkillCollectionMembership(state.modalSkill,collection.id,event.target.checked);
    });
    const info=document.createElement("div");
    info.className="collection-option-info";
    const name=document.createElement("span");
    name.className="collection-option-name";
    name.textContent=collection.name;
    const meta=document.createElement("span");
    meta.className="collection-option-meta";
    meta.textContent=`${collection.items.length} ${getI18nMsg("collectionCountUnit")}`;
    info.appendChild(name);
    info.appendChild(meta);
    option.appendChild(checkbox);
    option.appendChild(info);
    list.appendChild(option);
  });
  refs.collectionModalBody.appendChild(list);
}

async function handleCreateCollection(inputElement,addCurrentSkill){
  const name=inputElement.value.trim();
  if(!name){
    alertError("collectionNameRequired");
    return;
  }
  const createResponse=await sendMessage({type:"CREATE_COLLECTION",name});
  if(!createResponse?.success){
    alertError(createResponse?.error||"errorLoadingCollections");
    return;
  }
  inputElement.value="";
  state.openCollectionIds.add(createResponse.collection.id);
  if(addCurrentSkill&&state.modalSkill){
    const addResponse=await sendMessage({type:"ADD_SKILL_TO_COLLECTION",collectionId:createResponse.collection.id,skill:state.modalSkill});
    if(!addResponse?.success){
      alertError(addResponse?.error||"collectionNotFound");
    }
  }
  await loadCollections();
}

async function toggleSkillCollectionMembership(skill,collectionId,shouldAdd){
  const response=await sendMessage(shouldAdd?{type:"ADD_SKILL_TO_COLLECTION",collectionId,skill}:{type:"REMOVE_SKILL_FROM_COLLECTION",collectionId,skillId:skill.id});
  if(!response?.success){
    alertError(response?.error||"collectionNotFound");
  }
  await loadCollections();
}

async function renameCollection(collection){
  const newName=prompt(getI18nMsg("renameCollectionPrompt"),collection.name);
  if(newName===null){
    return;
  }
  const response=await sendMessage({type:"RENAME_COLLECTION",collectionId:collection.id,name:newName});
  if(!response?.success){
    alertError(response?.error||"collectionNameRequired");
    return;
  }
  await loadCollections();
}

async function deleteCollection(collection){
  if(!confirm(`${getI18nMsg("collectionDeleteConfirm")} "${collection.name}"?`)){
    return;
  }
  const response=await sendMessage({type:"DELETE_COLLECTION",collectionId:collection.id});
  if(!response?.success){
    alertError(response?.error||"collectionNotFound");
    return;
  }
  state.openCollectionIds.delete(collection.id);
  await loadCollections();
}

async function removeSkillFromCollection(collectionId,skillId){
  const response=await sendMessage({type:"REMOVE_SKILL_FROM_COLLECTION",collectionId,skillId});
  if(!response?.success){
    alertError(response?.error||"collectionNotFound");
    return;
  }
  await loadCollections();
}

function normalizeSkill(rawSkill){
  const path=rawSkill.path||".";
  return{
    id:rawSkill.id||`${rawSkill.owner||state.currentOwner}/${rawSkill.repo||state.currentRepo}/${path}`,
    owner:rawSkill.owner||state.currentOwner,
    repo:rawSkill.repo||state.currentRepo,
    name:rawSkill.name||(path==="."?"Root":path.split("/").pop()),
    path,
    defaultBranch:rawSkill.defaultBranch||state.defaultBranch,
    treeSha:rawSkill.treeSha||state.currentTreeSha,
    description:rawSkill.description||"",
    lastDetected:rawSkill.lastDetected||Date.now(),
    lastRepoUpdate:rawSkill.lastRepoUpdate||rawSkill.lastDetected||Date.now()
  };
}

function getSkillRef(skill){
  return skill.treeSha||skill.defaultBranch||state.defaultBranch;
}

async function getTreeForSkill(skill){
  const ref=getSkillRef(skill);
  const useCurrentTree=skill.owner===state.currentOwner&&skill.repo===state.currentRepo&&state.currentTree.length>0&&(!skill.treeSha||skill.treeSha===state.currentTreeSha||ref===state.defaultBranch);
  if(useCurrentTree){
    return state.currentTree;
  }
  const response=await sendMessage({type:"GET_TREE_BY_SHA",owner:skill.owner,repo:skill.repo,treeSha:ref});
  if(!response?.success){
    throw new Error(response?.error||"errorFetchTree");
  }
  return response.tree||[];
}

function buildSkillPageUrl(skill){
  const ref=skill.defaultBranch||getSkillRef(skill);
  if(skill.path==="."){
    return `https://github.com/${skill.owner}/${skill.repo}`;
  }
  return `https://github.com/${skill.owner}/${skill.repo}/tree/${ref}/${skill.path}`;
}

// DETAIL_LOGIC
// DOWNLOAD_LOGIC
