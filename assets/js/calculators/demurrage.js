(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const fields = ["reference","containerType","containerCount","currency","dischargeDate","gateOutDate","emptyReturnDate","demFreeDays","demRate","detFreeDays","detRate"];
  let latestReport = null;

  const number = (id) => Number($(id).value);
  const money = (value) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: $("currency").value, minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(value);
  const dateLabel = (value) => new Date(value + "T00:00:00").toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"});
  // Difference is calendar days; the start date is excluded and the end date is included as elapsed time.
  const dayDifference = (start, end) => {
    const a = new Date(start + "T00:00:00Z");
    const b = new Date(end + "T00:00:00Z");
    return Math.round((b - a) / 86400000);
  };
  const showError = (message) => {
    $("demError").textContent = message;
    $("demError").classList.toggle("is-visible", Boolean(message));
  };
  const validate = () => {
    const count = number("containerCount");
    const demFree = number("demFreeDays");
    const detFree = number("detFreeDays");
    const demRate = number("demRate");
    const detRate = number("detRate");
    if (!fields.every(id => $(id).value !== "")) return "Please complete all fields.";
    if (!Number.isInteger(count) || count < 1 || count > 500) return "Container count must be a whole number between 1 and 500.";
    if (![demFree,detFree].every(v => Number.isInteger(v) && v >= 0 && v <= 365)) return "Free days must be whole numbers between 0 and 365.";
    if (![demRate,detRate].every(v => Number.isFinite(v) && v >= 0)) return "Daily rates must be zero or greater.";
    if (dayDifference($("dischargeDate").value,$("gateOutDate").value) < 0) return "Gate-out date cannot be earlier than the discharge / available date.";
    if (dayDifference($("gateOutDate").value,$("emptyReturnDate").value) < 0) return "Empty return date cannot be earlier than the gate-out date.";
    return "";
  };
  const calculate = () => {
    const error = validate();
    if (error) { showError(error); latestReport = null; return; }
    showError("");
    const count = number("containerCount");
    const demElapsed = dayDifference($("dischargeDate").value,$("gateOutDate").value);
    const detElapsed = dayDifference($("gateOutDate").value,$("emptyReturnDate").value);
    const demDays = Math.max(0,demElapsed-number("demFreeDays"));
    const detDays = Math.max(0,detElapsed-number("detFreeDays"));
    const demTotal = demDays*number("demRate")*count;
    const detTotal = detDays*number("detRate")*count;
    const total = demTotal+detTotal;
    const currency = $("currency").value;
    const result = {
      reference:$("reference").value.trim() || "Not provided",
      containerType:$("containerType").value,count,currency,
      discharge:$("dischargeDate").value,gateOut:$("gateOutDate").value,emptyReturn:$("emptyReturnDate").value,
      demElapsed,detElapsed,demFree:number("demFreeDays"),detFree:number("detFreeDays"),
      demDays,detDays,demRate:number("demRate"),detRate:number("detRate"),demTotal,detTotal,total
    };
    latestReport = result;
    $("emptyState").hidden = true;
    $("resultState").hidden = false;
    $("grandTotal").textContent = money(total);
    $("demTotal").textContent = money(demTotal);
    $("detTotal").textContent = money(detTotal);
    $("containerSummary").textContent = `${count} × ${result.containerType}`;
    $("resultMeta").textContent = `${count} container${count===1?"":"s"} · ${currency}`;
    $("demDays").textContent = `${demDays} chargeable day${demDays===1?"":"s"}`;
    $("detDays").textContent = `${detDays} chargeable day${detDays===1?"":"s"}`;
    $("demDaysMeta").textContent = `${demElapsed} elapsed − ${result.demFree} free`;
    $("detDaysMeta").textContent = `${detElapsed} elapsed − ${result.detFree} free`;
  };
  const reportText = (r) => [
    "FREIGHT INTELLIGENCE CENTRE — DEMURRAGE & DETENTION ESTIMATE",
    `Reference: ${r.reference}`,`Container type: ${r.containerType}`,`Container count: ${r.count}`,
    `Currency: ${r.currency}`,"",
    `Discharge / available date: ${dateLabel(r.discharge)}`,`Gate-out date: ${dateLabel(r.gateOut)}`,`Empty return date: ${dateLabel(r.emptyReturn)}`,"",
    `Demurrage elapsed days: ${r.demElapsed}`,`Demurrage free days: ${r.demFree}`,`Demurrage chargeable days: ${r.demDays}`,`Demurrage rate per day/container: ${r.currency} ${r.demRate.toFixed(2)}`,`Demurrage total: ${r.currency} ${r.demTotal.toFixed(2)}`,"",
    `Detention elapsed days: ${r.detElapsed}`,`Detention free days: ${r.detFree}`,`Detention chargeable days: ${r.detDays}`,`Detention rate per day/container: ${r.currency} ${r.detRate.toFixed(2)}`,`Detention total: ${r.currency} ${r.detTotal.toFixed(2)}`,"",
    `ESTIMATED TOTAL: ${r.currency} ${r.total.toFixed(2)}`,"",
    "Estimate only. Confirm carrier/terminal tariff, free-time rules, local cut-offs and day-count conventions before payment."
  ].join("\n");
  $("calculateBtn").addEventListener("click",calculate);
  $("sampleBtn").addEventListener("click",() => {
    const sample = {reference:"FIC-SAMPLE-001",containerType:"40ft Standard",containerCount:2,currency:"INR",dischargeDate:"2026-11-01",gateOutDate:"2026-11-10",emptyReturnDate:"2026-11-22",demFreeDays:5,demRate:2500,detFreeDays:7,detRate:1800};
    Object.entries(sample).forEach(([id,value]) => $(id).value=value);
    calculate();
  });
  $("resetBtn").addEventListener("click",() => {
    $("reference").value="";$("containerType").value="40ft Standard";$("containerCount").value=1;$("currency").value="INR";
    ["dischargeDate","gateOutDate","emptyReturnDate"].forEach(id => $(id).value="");
    $("demFreeDays").value=5;$("demRate").value=2500;$("detFreeDays").value=7;$("detRate").value=1800;
    latestReport=null;showError("");$("resultState").hidden=true;$("emptyState").hidden=false;
  });
  $("downloadBtn").addEventListener("click",() => {
    if (!latestReport) return;
    const blob = new Blob([reportText(latestReport)],{type:"text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download="demurrage-detention-estimate.txt";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("printBtn").addEventListener("click",()=>{if(latestReport) window.print();});
  fields.forEach(id => $(id).addEventListener("input",()=>{if(latestReport){latestReport=null;$("resultState").hidden=true;$("emptyState").hidden=false;}}));
  $("currentYear").textContent=new Date().getFullYear();
})();