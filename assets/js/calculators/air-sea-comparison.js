(() => {
"use strict";
const $ = id => document.getElementById(id);
const ids = ["origin","destination","cargoDescription","length","width","height","packages","grossWeight","airRate","airDivisor","airFees","airDays","lclRate","lclMinimum","seaFees","seaDays","fcl20","fcl40"];
let lastResult = null;
$("currentYear").textContent = new Date().getFullYear();
const num = id => { const raw = $(id).value.trim(); return raw === "" ? null : Number(raw); };
const currency = () => $("currency").value;
const money = value => new Intl.NumberFormat("en",{style:"currency",currency:currency(),minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
function read(){
 const d={}; ids.forEach(id=>d[id]=["origin","destination","cargoDescription"].includes(id)?$(id).value.trim():num(id)); d.currency=currency(); return d;
}
function validate(d){
 if(!d.origin) return "Enter the shipment origin.";
 if(!d.destination) return "Enter the shipment destination.";
 if(!d.cargoDescription) return "Enter a cargo description.";
 for(const [id,label] of [["length","Length"],["width","Width"],["height","Height"],["grossWeight","Gross weight"],["airDivisor","Air volumetric divisor"]]){
  if(!Number.isFinite(d[id])||d[id]<=0)return `${label} must be greater than zero.`;
 }
 if(!Number.isInteger(d.packages)||d.packages<1)return "Package count must be a whole number greater than zero.";
 for(const [id,label] of [["airRate","Air rate"],["airFees","Other air charges"],["airDays","Air transit time"],["lclRate","LCL rate"],["lclMinimum","LCL minimum"],["seaFees","Other sea charges"],["seaDays","Sea transit time"]]){
  if(!Number.isFinite(d[id])||d[id]<0)return `${label} must be zero or a positive number.`;
 }
 for(const [id,label] of [["fcl20","20ft FCL quote"],["fcl40","40ft FCL quote"]]){
  if(d[id]!==null&&(!Number.isFinite(d[id])||d[id]<=0))return `${label} must be greater than zero when entered.`;
 }
 return null;
}
function calculate(){
 $("airseaError").style.display="none";
 const d=read(), error=validate(d);
 if(error){$("airseaError").textContent=error;$("airseaError").style.display="block";return;}
 const oneCbm=d.length*d.width*d.height/1000000;
 const cbm=oneCbm*d.packages;
 const volumetric=cbm*1000000/d.airDivisor;
 const chargeable=Math.max(d.grossWeight,volumetric);
 const airFreight=chargeable*d.airRate;
 const airTotal=airFreight+d.airFees;
 const billableCbm=Math.max(cbm,d.lclMinimum);
 const lclFreight=billableCbm*d.lclRate;
 const seaOptions=[{name:"LCL",total:lclFreight+d.seaFees,freight:lclFreight,fees:d.seaFees,detail:`${billableCbm.toFixed(3)} billable CBM × ${money(d.lclRate)} / CBM`}];
 if(d.fcl20!==null)seaOptions.push({name:"20ft FCL",total:d.fcl20,freight:d.fcl20,fees:0,detail:"Entered all-in 20ft container quote"});
 if(d.fcl40!==null)seaOptions.push({name:"40ft FCL",total:d.fcl40,freight:d.fcl40,fees:0,detail:"Entered all-in 40ft container quote"});
 seaOptions.sort((a,b)=>a.total-b.total);
 const sea=seaOptions[0], fastest= d.airDays<=d.seaDays?"Air":"Sea";
 const cheapest=airTotal<=sea.total?"Air":`Sea (${sea.name})`;
 const saving=Math.abs(airTotal-sea.total);
 const costWinner=airTotal<=sea.total?"Air":`Sea ${sea.name}`;
 const recommendation=costWinner===fastest?`${costWinner} is both the lower-cost and faster option.`:`${fastest} is faster, while ${costWinner} is the lower-cost option.`;
 lastResult={...d,oneCbm,cbm,volumetric,chargeable,airFreight,airTotal,billableCbm,lclFreight,seaOptions,sea,fastest,cheapest,saving,recommendation};
 render(lastResult);
}
function render(r){
 const airBest=r.airTotal<=r.sea.total, seaBest=r.sea.total<r.airTotal;
 const el=$("airseaResults");
 el.innerHTML=`<section class="airsea-result-card"><div class="airsea-result-head"><span class="panel-step">COMPARISON RESULT</span><h2>${escapeHtml(r.origin)} → ${escapeHtml(r.destination)}</h2><p>${escapeHtml(r.cargoDescription)} · ${r.packages} packages · ${r.cbm.toFixed(3)} CBM · ${r.grossWeight.toFixed(2)} kg gross</p></div>
 <div class="airsea-result-body"><div class="airsea-recommendation"><i class="bi bi-lightbulb"></i> ${r.recommendation}<small>Cost comparison is based on the rates and charges you entered.</small></div>
 <article class="airsea-option ${airBest?"is-best":""}"><div class="airsea-option-top"><h3><i class="bi bi-airplane me-1"></i> Air freight</h3><span>${airBest?"LOWER ESTIMATE":"AIR OPTION"}</span></div><div class="airsea-price">${money(r.airTotal)}</div><p>Estimated air total · ${r.airDays} days transit</p><div class="airsea-metrics"><div class="airsea-metric"><span>Chargeable weight</span><strong>${r.chargeable.toFixed(2)} kg</strong></div><div class="airsea-metric"><span>Volumetric weight</span><strong>${r.volumetric.toFixed(2)} kg</strong></div></div><div class="airsea-cost-line"><span>Air freight (${r.airRate.toFixed(2)} / kg)</span><strong>${money(r.airFreight)}</strong></div><div class="airsea-cost-line"><span>Other air charges</span><strong>${money(r.airFees)}</strong></div></article>
 <article class="airsea-option ${seaBest?"is-best":""}"><div class="airsea-option-top"><h3><i class="bi bi-water me-1"></i> Sea freight · ${r.sea.name}</h3><span>${seaBest?"LOWER ESTIMATE":"SEA OPTION"}</span></div><div class="airsea-price">${money(r.sea.total)}</div><p>Estimated sea total · ${r.seaDays} days transit</p><div class="airsea-metrics"><div class="airsea-metric"><span>Total cargo volume</span><strong>${r.cbm.toFixed(3)} CBM</strong></div><div class="airsea-metric"><span>Billable LCL volume</span><strong>${r.billableCbm.toFixed(3)} CBM</strong></div></div>${r.seaOptions.map(o=>`<div class="airsea-cost-line"><span>${o.name} estimate</span><strong>${money(o.total)}</strong></div>`).join("")}<div class="airsea-cost-line"><span>Selected sea basis</span><strong>${r.sea.name}</strong></div></article>
 <div class="airsea-cost-line mt-3"><span>Estimated cost difference</span><strong>${money(r.saving)}</strong></div>
 <div class="airsea-report-actions"><button class="btn btn-outline-secondary" id="downloadAirSeaBtn"><i class="bi bi-download"></i> Download report</button><button class="btn btn-outline-secondary" id="printAirSeaBtn"><i class="bi bi-printer"></i> Print</button></div>
 </div></section>`;
 $("downloadAirSeaBtn").addEventListener("click",downloadReport);
 $("printAirSeaBtn").addEventListener("click",()=>window.print());
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function downloadReport(){
 if(!lastResult)return;const r=lastResult;
 const lines=["FREIGHT INTELLIGENCE CENTRE","AIR VS SEA COMPARISON REPORT","================================",`Route: ${r.origin} to ${r.destination}`,`Cargo: ${r.cargoDescription}`,`Packages: ${r.packages}`,`Gross weight: ${r.grossWeight} kg`,`Total volume: ${r.cbm.toFixed(3)} CBM`,"",`AIR ESTIMATE: ${money(r.airTotal)}`,`Chargeable weight: ${r.chargeable.toFixed(2)} kg`,`Volumetric weight: ${r.volumetric.toFixed(2)} kg`,`Air freight: ${money(r.airFreight)}`,`Other charges: ${money(r.airFees)}`,`Transit estimate: ${r.airDays} days`,"",`SEA ESTIMATE (${r.sea.name}): ${money(r.sea.total)}`,`Selected sea estimate detail: ${r.sea.detail}`,`Transit estimate: ${r.seaDays} days`,"",`Recommendation: ${r.recommendation}`,"", "Planning estimate only. Rates and schedules are user-entered and must be confirmed with the carrier or freight forwarder."];
 const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="air-vs-sea-comparison.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function reset(){
 const defaults={length:60,width:40,height:40,packages:10,grossWeight:300,airRate:250,airDivisor:6000,airFees:2500,airDays:5,lclRate:900,lclMinimum:1,seaFees:4500,seaDays:24};
 ids.forEach(id=>$(id).value=defaults[id]??"");
 $("origin").value="";$("destination").value="";$("cargoDescription").value="";$("currency").value="INR";
 $("airseaError").style.display="none";lastResult=null;
 $("airseaResults").innerHTML='<section class="airsea-result-card"><div class="airsea-result-head"><span class="panel-step">COMPARISON RESULT</span><h2>Compare your options</h2><p>Enter shipment details and rates, then calculate to see the comparison.</p></div><div class="airsea-empty"><i class="bi bi-bar-chart-line"></i><strong>Your comparison will appear here</strong><span>Air and sea estimates will be calculated using your entered rates.</span></div></section>';
}
$("calculateAirSeaBtn").addEventListener("click",calculate);
$("resetAirSeaBtn").addEventListener("click",reset);
})();
