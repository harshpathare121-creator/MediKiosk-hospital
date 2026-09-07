
/* MediKiosk adaptive current-issue questionnaire */
const MK_SYMPTOM_FLOWS = {
  pain: {
    label:"Pain",
    questions:[
      ["location","Where exactly is the pain?","text"],
      ["onset","When did it start?","choice",["Today","1–3 days ago","4–7 days ago","More than a week ago","I don't know"]],
      ["pattern","How does the pain behave?","choice",["Constant","Comes and goes","With movement/activity","At certain times"]],
      ["severity","How severe is it from 1 to 10?","scale"],
      ["betterWorse","Does anything make it better or worse?","text"],
      ["associated","Do you have any other symptoms with it?","multi",["Fever","Vomiting","Nausea","Dizziness","Breathing difficulty","Swelling","None of these"]]
    ]
  },
  headache:{
    label:"Headache",
    questions:[
      ["location","Where do you feel the headache?","choice",["Front/forehead","Back of head","One side","Around the eyes","All over","Other"]],
      ["onset","When did it start?","choice",["Today","1–3 days ago","4–7 days ago","More than a week ago","I don't know"]],
      ["pattern","How does it behave?","choice",["Constant","Comes and goes","Worse with activity","Mostly morning","Mostly night"]],
      ["severity","How severe is it from 1 to 10?","scale"],
      ["associated","Do you have any of these?","multi",["Nausea","Vomiting","Fever","Blurred vision","Dizziness","Sensitivity to light","Weakness/numbness","None of these"]]
    ]
  },
  fever:{
    label:"Fever",
    questions:[
      ["onset","When did the fever start?","choice",["Today","1–3 days ago","4–7 days ago","More than a week ago","I don't know"]],
      ["temperature","Do you know your temperature?","text"],
      ["pattern","How does it behave?","choice",["Constant","Comes and goes","Mostly at night","Not sure"]],
      ["associated","Do you have any of these?","multi",["Cough","Cold/runny nose","Sore throat","Body ache","Chills","Vomiting","Loose motions","Rash","None of these"]]
    ]
  },
  stomach:{
    label:"Stomach / abdominal problem",
    questions:[
      ["location","Where exactly is the problem?","choice",["Upper abdomen","Lower abdomen","Right side","Left side","All over","Not sure"]],
      ["onset","When did it start?","choice",["Today","1–3 days ago","4–7 days ago","More than a week ago","I don't know"]],
      ["pattern","How does it behave?","choice",["Constant","Comes and goes","After eating","Around bowel movement","Not sure"]],
      ["severity","How severe is it from 1 to 10?","scale"],
      ["associated","Do you have any of these?","multi",["Vomiting","Nausea","Loose motions","Constipation","Fever","Blood in stool","Loss of appetite","None of these"]]
    ]
  },
  breathing:{
    label:"Breathing problem",
    questions:[
      ["onset","When did the breathing problem start?","choice",["Suddenly today","1–3 days ago","More than 3 days ago","Repeated/long-term","I don't know"]],
      ["activity","When does it happen?","choice",["Even at rest","Walking/exercising","At night/lying down","Certain activities","Not sure"]],
      ["severity","How severe is it right now?","choice",["Mild","Moderate","Severe","Very severe"]],
      ["associated","Do you also have any of these?","multi",["Chest pain","Cough","Fever","Wheezing","Dizziness","Bluish lips/face","None of these"]]
    ]
  },
  injury:{
    label:"Injury",
    questions:[
      ["location","Where is the injury?","text"],
      ["cause","How did the injury happen?","text"],
      ["onset","When did it happen?","choice",["Today","1–3 days ago","4–7 days ago","More than a week ago"]],
      ["severity","How severe is the pain from 1 to 10?","scale"],
      ["associated","What do you notice?","multi",["Swelling","Bleeding","Bruising","Difficulty moving","Numbness","Deformity","None of these"]]
    ]
  },
  general:{
    label:"General problem",
    questions:[
      ["onset","When did your current problem start?","choice",["Today","1–3 days ago","4–7 days ago","More than a week ago","I don't know"]],
      ["severity","How severe is your main problem from 1 to 10?","scale"],
      ["change","Is it getting better, worse, or staying the same?","choice",["Getting better","Getting worse","About the same","Comes and goes","Not sure"]],
      ["associated","Any other symptoms you want the doctor to know?","text"]
    ]
  }
};

let mkAdaptive = {flow:null, step:0, answers:{}};

function mkClassifyIssue(text){
  const t=String(text||"").toLowerCase();
  if(/head|migraine|headache|forehead/.test(t)) return "headache";
  if(/fever|temperature|chills/.test(t)) return "fever";
  if(/stomach|abdomen|abdominal|tummy|belly|gastric/.test(t)) return "stomach";
  if(/breath|breathing|shortness|asthma|wheez/.test(t)) return "breathing";
  if(/injury|fell|fall|accident|sprain|fracture|hurt|hit|wound/.test(t)) return "injury";
  if(/pain|ache|hurt|sore|cramp/.test(t)) return "pain";
  return "general";
}

function mkEsc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function startAdaptiveQuestions(){
  const issue=document.getElementById("currentIssue")?.value.trim();
  if(!issue) return alert("Please describe your current problem first.");
  mkAdaptive={flow:MK_SYMPTOM_FLOWS[mkClassifyIssue(issue)],step:0,answers:{currentIssue:issue}};
  renderAdaptiveQuestion();
}

function renderAdaptiveQuestion(){
  const host=document.getElementById("adaptiveQuestions");
  if(!host||!mkAdaptive.flow)return;
  const q=mkAdaptive.flow.questions[mkAdaptive.step];
  if(!q){
    host.innerHTML='<div class="notice"><b>✓ Questions completed</b><p>Your answers will be included in the doctor summary.</p></div>';
    const h=document.getElementById("history");
    if(h)h.value=buildClinicalSummary();
    return;
  }
  const [id,text,type,options]=q;
  let input="";
  if(type==="text") input=`<input id="mkAq" placeholder="Enter your answer">`;
  if(type==="choice") input=options.map(o=>`<label><input type="radio" name="mkAq" value="${mkEsc(o)}"> ${mkEsc(o)}</label>`).join("");
  if(type==="multi") input=options.map(o=>`<label><input type="checkbox" name="mkAq" value="${mkEsc(o)}"> ${mkEsc(o)}</label>`).join("");
  if(type==="scale") input=Array.from({length:10},(_,i)=>`<label><input type="radio" name="mkAq" value="${i+1}"> ${i+1}</label>`).join("");
  host.innerHTML=`<div class="adaptive-question"><small>Question ${mkAdaptive.step+1} of ${mkAdaptive.flow.questions.length}</small><h4>${mkEsc(text)}</h4><div class="adaptive-options">${input}</div><button type="button" class="primary" onclick="saveAdaptiveAnswer()">${mkAdaptive.step===mkAdaptive.flow.questions.length-1?"Finish":"Next"}</button></div>`;
}

function saveAdaptiveAnswer(){
  const q=mkAdaptive.flow.questions[mkAdaptive.step], type=q[2];
  let value="";
  if(type==="text")value=document.getElementById("mkAq")?.value.trim()||"";
  else if(type==="choice"||type==="scale")value=document.querySelector('input[name="mkAq"]:checked')?.value||"";
  else value=[...document.querySelectorAll('input[name="mkAq"]:checked')].map(x=>x.value);
  if((Array.isArray(value)&&!value.length)||(!Array.isArray(value)&&!value))return alert("Please answer this question.");
  mkAdaptive.answers[q[0]]=value;
  mkAdaptive.step++;
  renderAdaptiveQuestion();
}

function buildClinicalSummary(){
  if(!mkAdaptive.answers.currentIssue)return "";
  const labels={location:"Location",onset:"Started",pattern:"Pattern",severity:"Severity (1–10)",betterWorse:"Better/worse factors",associated:"Other symptoms",temperature:"Temperature",activity:"When it occurs",cause:"Cause",change:"Change since onset"};
  const lines=["CURRENT ISSUE SUMMARY","Main problem: "+mkAdaptive.answers.currentIssue,"Questionnaire: "+mkAdaptive.flow.label];
  Object.keys(labels).forEach(k=>{
    if(mkAdaptive.answers[k]!==undefined&&mkAdaptive.answers[k]!==""){
      const v=Array.isArray(mkAdaptive.answers[k])?mkAdaptive.answers[k].join(", "):mkAdaptive.answers[k];
      lines.push(labels[k]+": "+v);
    }
  });
  return lines.join("\n");
}

function appendAdaptiveToFormData(fd){
  fd.set("history",buildClinicalSummary());
  fd.append("currentIssue",mkAdaptive.answers.currentIssue||"");
  fd.append("adaptiveQuestionnaire",JSON.stringify({questionnaire:mkAdaptive.flow?.label||"General",answers:mkAdaptive.answers,summary:buildClinicalSummary()}));
}

function setupAdaptiveQuestionnaire(){
  const form=document.querySelector("#register .card");
  if(!form||document.getElementById("adaptiveBox"))return;
  const box=document.createElement("div");
  box.id="adaptiveBox";box.className="optional";
  box.innerHTML=`<h3>🩺 Current Health Issue</h3><p>Tell us your main/current problem. Follow-up questions will adapt to your previous response.</p><label>Main/current problem<textarea id="currentIssue" rows="3" placeholder="Example: I have had a headache since yesterday"></textarea></label><button type="button" class="secondary" onclick="startAdaptiveQuestions()">Continue with Questions</button><div id="adaptiveQuestions"></div>`;
  const history=document.getElementById("history");
  if(history)form.insertBefore(box,history.closest("label")||history);else form.appendChild(box);
}
document.addEventListener("DOMContentLoaded",setupAdaptiveQuestionnaire);
