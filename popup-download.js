export async function copyCommand(skill,button,helpers){
  const baseUrl=`https://github.com/${skill.owner}/${skill.repo}`;
  const fullUrl=skill.path&&skill.path!=="."?`${baseUrl}/${skill.path}`:baseUrl;
  try{
    await navigator.clipboard.writeText(`npx skills add ${fullUrl}`);
    const originalTitle=button.title;
    helpers.setButtonBusy(button,"✅");
    button.title=helpers.getI18nMsg("copiedState");
    window.setTimeout(()=>{
      helpers.restoreButton(button);
      button.title=originalTitle;
    },1500);
  }catch(error){
    console.error("Could not copy command",error);
    helpers.alertError("copyFailed");
  }
}

export async function downloadSkill(rawSkill,button,listItem,helpers){
  const skill=helpers.normalizeSkill(rawSkill);
  helpers.setButtonBusy(button,"…");
  listItem.classList.add("downloading");
  try{
    const tree=await helpers.getTreeForSkill(skill);
    const zip=new window.JSZip();
    await addSkillFilesToZip(zip,skill,tree,"",helpers);
    await saveZip(zip,`${helpers.sanitizeFileName(getSingleSkillArchiveName(skill))}.zip`);
  }catch(error){
    helpers.alertError(error.message||"downloadFailed");
  }finally{
    helpers.restoreButton(button);
    listItem.classList.remove("downloading");
  }
}

export async function downloadCollection(collection,button,helpers){
  if(!collection.items.length){
    alert(helpers.getI18nMsg("noSkillsInCollection"));
    return;
  }
  helpers.setButtonBusy(button,"…");
  try{
    const zip=new window.JSZip();
    const root=helpers.sanitizeZipSegment(collection.name||"collection");
    for(const rawSkill of collection.items){
      const skill=helpers.normalizeSkill(rawSkill);
      const tree=await helpers.getTreeForSkill(skill);
      await addSkillFilesToZip(zip,skill,tree,`${root}/${buildCollectionSkillFolder(skill,helpers)}`,helpers);
    }
    await saveZip(zip,`${helpers.sanitizeFileName(collection.name||"collection")}.zip`);
  }catch(error){
    helpers.alertError(error.message||"downloadFailed");
  }finally{
    helpers.restoreButton(button);
  }
}

async function addSkillFilesToZip(zip,skill,tree,baseFolder,helpers){
  const files=getSkillFiles(tree,skill.path);
  if(!files.length){
    throw new Error("skillFilesMissing");
  }
  const prefix=skill.path==="."?"":`${skill.path}/`;
  const ref=helpers.getSkillRef(skill);
  const batchSize=8;
  for(let index=0;index<files.length;index+=batchSize){
    const batch=files.slice(index,index+batchSize);
    await Promise.all(batch.map(async(file)=>{
      const response=await fetch(`https://raw.githubusercontent.com/${skill.owner}/${skill.repo}/${ref}/${file.path}`);
      if(!response.ok){
        throw new Error("downloadFailed");
      }
      const blob=await response.blob();
      const relativePath=prefix?file.path.slice(prefix.length):file.path;
      zip.file(baseFolder?`${baseFolder}/${relativePath}`:relativePath,blob);
    }));
  }
}

function getSkillFiles(tree,skillPath){
  const prefix=skillPath==="."?"":`${skillPath}/`;
  return tree.filter((item)=>item.type==="blob"&&(prefix===""||item.path.startsWith(prefix)));
}

function getSingleSkillArchiveName(skill){
  return skill.path==="."?skill.repo:skill.path.split("/").pop();
}

function buildCollectionSkillFolder(skill,helpers){
  const suffix=skill.path==="."?"root":skill.path.replace(/[\\/]+/g,"_");
  return helpers.sanitizeZipSegment(`${skill.owner}_${skill.repo}_${suffix}`);
}

async function saveZip(zip,filename){
  const blob=await zip.generateAsync({type:"blob"});
  const url=URL.createObjectURL(blob);
  await new Promise((resolve,reject)=>{
    chrome.downloads.download({url,filename,saveAs:true},(downloadId)=>{
      URL.revokeObjectURL(url);
      if(chrome.runtime.lastError||typeof downloadId!=="number"){
        reject(new Error("downloadFailed"));
        return;
      }
      resolve(downloadId);
    });
  });
}
