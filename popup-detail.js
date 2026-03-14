export function toggleSkillDetails(container,skill,helpers){
  if(container.classList.contains("open")){
    container.classList.remove("open");
    return;
  }
  container.classList.add("open");
  loadSkillMeta(container,skill,helpers).catch((error)=>{
    console.error("Failed to load skill metadata",error);
    container.innerHTML=`<em style="color:red;">${helpers.getI18nMsg("errorParsingMeta")}</em>`;
  });
}

async function loadSkillMeta(container,skill,helpers){
  if(container.dataset.loaded==="true"){
    return;
  }
  container.innerHTML=`<em>${helpers.getI18nMsg("loadingDetails")}</em>`;
  const ref=helpers.getSkillRef(skill);
  const path=skill.path==="."?"SKILL.md":`${skill.path}/SKILL.md`;
  const response=await fetch(`https://raw.githubusercontent.com/${skill.owner}/${skill.repo}/${ref}/${path}`);
  if(!response.ok){
    throw new Error("errorParsingMeta");
  }
  const text=await response.text();
  const {name,description}=parseSkillFrontmatter(text,helpers.getI18nMsg("noDescription"));
  container.innerHTML="";
  container.dataset.loaded="true";
  const wrapper=document.createElement("div");
  if(name){
    const nameEl=document.createElement("strong");
    nameEl.textContent=name;
    wrapper.appendChild(nameEl);
    wrapper.appendChild(document.createElement("br"));
  }
  const descEl=document.createElement("div");
  descEl.className="skill-desc";
  descEl.textContent=description;
  wrapper.appendChild(descEl);
  const actions=document.createElement("div");
  actions.className="detail-actions";
  const fullBtn=document.createElement("button");
  fullBtn.className="detail-action-btn";
  fullBtn.textContent=helpers.getI18nMsg("viewFullSkillBtn");
  fullBtn.addEventListener("click",()=>showFullSkillMd(container,text,skill,helpers));
  const treeBtn=document.createElement("button");
  treeBtn.className="detail-action-btn";
  treeBtn.textContent=helpers.getI18nMsg("viewFileTreeBtn");
  treeBtn.addEventListener("click",()=>showFileTree(container,skill,helpers));
  actions.appendChild(fullBtn);
  actions.appendChild(treeBtn);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);
}

function parseSkillFrontmatter(content,fallbackDescription){
  const frontmatter=content.match(/^---\n([\s\S]*?)\n---/);
  if(!frontmatter){
    return {name:"",description:fallbackDescription};
  }
  const body=frontmatter[1];
  const nameMatch=body.match(/name:\s*(.+)/);
  const descriptionMatch=body.match(/description:\s*(?:>|\|)?\s*([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|$)/i);
  return {
    name:nameMatch?nameMatch[1].trim():"",
    description:descriptionMatch?descriptionMatch[1].trim():fallbackDescription
  };
}

function showFullSkillMd(container,content,skill,helpers){
  container.innerHTML="";
  const wrapper=document.createElement("div");
  const backBtn=createBackButton(container,skill,helpers);
  const pre=document.createElement("pre");
  pre.style.whiteSpace="pre-wrap";
  pre.style.fontSize="12px";
  pre.style.lineHeight="1.5";
  pre.style.marginTop="8px";
  pre.style.padding="8px";
  pre.style.background="#f8fafc";
  pre.style.borderRadius="6px";
  pre.style.maxHeight="320px";
  pre.style.overflow="auto";
  pre.textContent=content;
  wrapper.appendChild(backBtn);
  wrapper.appendChild(pre);
  container.appendChild(wrapper);
}

async function showFileTree(container,skill,helpers){
  container.innerHTML=`<em>${helpers.getI18nMsg("loadingDetails")}</em>`;
  try{
    const tree=await helpers.getTreeForSkill(skill);
    renderFileTree(container,tree,skill,helpers);
  }catch(error){
    console.error("Failed to load file tree",error);
    container.innerHTML=`<em style="color:red;">${helpers.getI18nMsg("fileTreeLoadError")}</em>`;
  }
}

function renderFileTree(container,tree,skill,helpers){
  container.innerHTML="";
  const wrapper=document.createElement("div");
  const backBtn=createBackButton(container,skill,helpers);
  const treeContainer=document.createElement("div");
  treeContainer.className="file-tree";
  const prefix=skill.path==="."?"":`${skill.path}/`;
  const files=tree.filter((item)=>item.type==="blob"&&(prefix===""||item.path.startsWith(prefix)));
  const structure=buildTreeStructure(files,prefix);
  renderTreeNode(treeContainer,structure,skill,helpers,0);
  wrapper.appendChild(backBtn);
  wrapper.appendChild(treeContainer);
  container.appendChild(wrapper);
}

function createBackButton(container,skill,helpers){
  const backBtn=document.createElement("button");
  backBtn.className="detail-back-btn";
  backBtn.textContent=helpers.getI18nMsg("backToMetaBtn");
  backBtn.addEventListener("click",()=>{
    container.dataset.loaded="";
    loadSkillMeta(container,skill,helpers).catch((error)=>{
      console.error("Failed to reload skill metadata",error);
      container.innerHTML=`<em style="color:red;">${helpers.getI18nMsg("errorParsingMeta")}</em>`;
    });
  });
  return backBtn;
}

function buildTreeStructure(files,prefix){
  const root={children:{}};
  files.forEach((file)=>{
    const relativePath=prefix?file.path.slice(prefix.length):file.path;
    let current=root;
    relativePath.split("/").forEach((part,index,parts)=>{
      if(index===parts.length-1){
        current.children[part]={type:"file",name:part,path:file.path};
        return;
      }
      if(!current.children[part]){
        current.children[part]={type:"folder",name:part,children:{}};
      }
      current=current.children[part];
    });
  });
  return root;
}

function renderTreeNode(container,node,skill,helpers,depth){
  const entries=Object.entries(node.children||{}).sort((a,b)=>{
    if(a[1].type==="folder"&&b[1].type==="file"){return -1;}
    if(a[1].type==="file"&&b[1].type==="folder"){return 1;}
    return a[0].localeCompare(b[0]);
  });
  entries.forEach(([name,child])=>{
    const item=document.createElement("div");
    item.className="tree-item";
    item.style.paddingLeft=`${depth*16}px`;
    if(child.type==="folder"){
      const icon=document.createElement("span");
      icon.textContent="▸ 📁 ";
      const label=document.createElement("span");
      label.textContent=name;
      label.style.color="#0366d6";
      item.appendChild(icon);
      item.appendChild(label);
      let expanded=false;
      const children=document.createElement("div");
      children.style.display="none";
      item.addEventListener("click",(event)=>{
        event.stopPropagation();
        expanded=!expanded;
        icon.textContent=expanded?"▾ 📁 ":"▸ 📁 ";
        children.style.display=expanded?"block":"none";
      });
      container.appendChild(item);
      container.appendChild(children);
      renderTreeNode(children,child,skill,helpers,depth+1);
      return;
    }
    const icon=document.createElement("span");
    icon.textContent="📄 ";
    const link=helpers.createLink(`https://github.com/${skill.owner}/${skill.repo}/blob/${skill.defaultBranch||helpers.getSkillRef(skill)}/${child.path}`,name);
    link.className="tree-link";
    item.appendChild(icon);
    item.appendChild(link);
    container.appendChild(item);
  });
}
