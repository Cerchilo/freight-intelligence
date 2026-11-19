(() => {
    "use strict";

    const byId = (id) => document.getElementById(id);
    const fields = {
        productDescription: byId("productDescription"),
        hsCode: byId("hsCode"),
        originCountry: byId("originCountry"),
        quantity: byId("quantity"),
        assessableValue: byId("assessableValue"),
        rounding: byId("rounding"),
        bcdRate: byId("bcdRate"),
        swsRate: byId("swsRate"),
        aidcRate: byId("aidcRate"),
        healthCessRate: byId("healthCessRate"),
        antiDumping: byId("antiDumping"),
        otherDuty: byId("otherDuty"),
        igstRate: byId("igstRate"),
        compCessRate: byId("compCessRate")
    };

    const outputIds = [
        "landedCost", "resultAssessable", "resultBcd", "resultSws",
        "resultAidc", "resultOtherCess", "resultSpecific", "resultIgst",
        "resultCompCess", "totalDuty", "resultLanded", "igstBaseNote"
    ];
    const output = Object.fromEntries(outputIds.map((id) => [id, byId(id)]));

    const errorBox = byId("importError");
    const calculateButton = byId("calculateImportBtn");
    const resetButton = byId("resetImportBtn");
    const sampleButton = byId("sampleImportBtn");
    const downloadButton = byId("downloadImportBtn");
    const printButton = byId("printImportBtn");

    let lastResult = null;

    byId("currentYear").textContent = new Date().getFullYear();

    const number = (field) => Number(field.value);
    const money = (value) => {
        const decimals = Number(fields.rounding.value);
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    };

    function showError(message) {
        errorBox.textContent = message;
        errorBox.style.display = "block";
    }

    function clearError() {
        errorBox.textContent = "";
        errorBox.style.display = "none";
    }

    function readInputs() {
        return {
            productDescription: fields.productDescription.value.trim(),
            hsCode: fields.hsCode.value.trim(),
            originCountry: fields.originCountry.value.trim(),
            quantity: number(fields.quantity),
            assessableValue: number(fields.assessableValue),
            bcdRate: number(fields.bcdRate),
            swsRate: number(fields.swsRate),
            aidcRate: number(fields.aidcRate),
            healthCessRate: number(fields.healthCessRate),
            antiDumping: number(fields.antiDumping),
            otherDuty: number(fields.otherDuty),
            igstRate: number(fields.igstRate),
            compCessRate: number(fields.compCessRate)
        };
    }

    function validate(data) {
        if (!(data.assessableValue > 0) || !Number.isFinite(data.assessableValue)) {
            return "Enter an assessable value greater than zero.";
        }
        if (!Number.isInteger(data.quantity) || data.quantity < 1) {
            return "Quantity must be a whole number greater than zero.";
        }

        const rateFields = [
            ["BCD", data.bcdRate], ["SWS", data.swsRate],
            ["AIDC", data.aidcRate], ["Other ad valorem duty / cess", data.healthCessRate],
            ["IGST", data.igstRate], ["Compensation cess", data.compCessRate]
        ];
        for (const [label, value] of rateFields) {
            if (!Number.isFinite(value) || value < 0 || value > 100) {
                return `${label} rate must be between 0 and 100%.`;
            }
        }
        const fixedFields = [
            ["Anti-dumping / safeguard / specific duties", data.antiDumping],
            ["Other customs duties / cess", data.otherDuty]
        ];
        for (const [label, value] of fixedFields) {
            if (!Number.isFinite(value) || value < 0) {
                return `${label} must be zero or a positive amount.`;
            }
        }
        return null;
    }

    function calculate() {
        clearError();
        const data = readInputs();
        const error = validate(data);
        if (error) {
            showError(error);
            return;
        }

        // Simplified estimator: ad valorem components are applied to assessable value.
        // SWS is entered as a percentage of BCD for the common illustrative case.
        const bcd = data.assessableValue * data.bcdRate / 100;
        const sws = bcd * data.swsRate / 100;
        const aidc = data.assessableValue * data.aidcRate / 100;
        const otherCess = data.assessableValue * data.healthCessRate / 100;
        const specificDuties = data.antiDumping + data.otherDuty;

        // IGST base estimate includes the entered non-IGST customs components.
        // Product-specific statutory bases/exclusions must be verified separately.
        const igstBase = data.assessableValue + bcd + sws + aidc + otherCess + specificDuties;
        const igst = igstBase * data.igstRate / 100;
        const compensationCess = igstBase * data.compCessRate / 100;

        const totalDuty = bcd + sws + aidc + otherCess + specificDuties + igst + compensationCess;
        const landedCost = data.assessableValue + totalDuty;

        lastResult = {
            ...data, bcd, sws, aidc, otherCess, specificDuties,
            igstBase, igst, compensationCess, totalDuty, landedCost
        };
        render(lastResult);
        downloadButton.disabled = false;
        printButton.disabled = false;
    }

    function render(result) {
        output.landedCost.textContent = money(result.landedCost);
        output.resultAssessable.textContent = money(result.assessableValue);
        output.resultBcd.textContent = money(result.bcd);
        output.resultSws.textContent = money(result.sws);
        output.resultAidc.textContent = money(result.aidc);
        output.resultOtherCess.textContent = money(result.otherCess);
        output.resultSpecific.textContent = money(result.specificDuties);
        output.resultIgst.textContent = money(result.igst);
        output.resultCompCess.textContent = money(result.compensationCess);
        output.totalDuty.textContent = money(result.totalDuty);
        output.resultLanded.textContent = money(result.landedCost);
        output.igstBaseNote.textContent = `Estimated IGST / compensation cess base: ${money(result.igstBase)}`;
    }

    function reset() {
        Object.values(fields).forEach((field) => {
            if (field.tagName === "SELECT") return;
            if (field.id === "quantity") field.value = "1";
            else if (field.id === "bcdRate") field.value = "10";
            else if (field.id === "swsRate") field.value = "10";
            else if (field.id === "igstRate") field.value = "18";
            else if (field.id === "aidcRate" || field.id === "healthCessRate" ||
                     field.id === "antiDumping" || field.id === "otherDuty" ||
                     field.id === "compCessRate") field.value = "0";
            else field.value = "";
        });
        fields.rounding.value = "2";
        outputIds.forEach((id) => {
            if (id === "igstBaseNote") output[id].textContent = "IGST taxable base: —";
            else output[id].textContent = id === "landedCost" || id === "resultLanded" ? "₹0.00" : "₹0.00";
        });
        lastResult = null;
        downloadButton.disabled = true;
        printButton.disabled = true;
        clearError();
    }

    function loadSample() {
        fields.productDescription.value = "Illustrative machinery parts";
        fields.hsCode.value = "8479";
        fields.originCountry.value = "China";
        fields.quantity.value = "10";
        fields.assessableValue.value = "100000";
        fields.rounding.value = "2";
        fields.bcdRate.value = "10";
        fields.swsRate.value = "10";
        fields.aidcRate.value = "0";
        fields.healthCessRate.value = "0";
        fields.antiDumping.value = "0";
        fields.otherDuty.value = "0";
        fields.igstRate.value = "18";
        fields.compCessRate.value = "0";
        calculate();
    }

    function reportText() {
        if (!lastResult) return "";
        const r = lastResult;
        return [
            "FREIGHT INTELLIGENCE CENTRE",
            "INDIA IMPORT DUTY ESTIMATE",
            "================================",
            `Product: ${r.productDescription || "Not specified"}`,
            `HS code / CTH: ${r.hsCode || "Not specified"}`,
            `Country of origin: ${r.originCountry || "Not specified"}`,
            `Quantity: ${r.quantity}`,
            `Assessable value: ${money(r.assessableValue)}`,
            "",
            `BCD (${r.bcdRate}%): ${money(r.bcd)}`,
            `SWS (${r.swsRate}% of BCD): ${money(r.sws)}`,
            `AIDC (${r.aidcRate}% of assessable value): ${money(r.aidc)}`,
            `Other ad valorem duty / cess (${r.healthCessRate}%): ${money(r.otherCess)}`,
            `Specific / other duties: ${money(r.specificDuties)}`,
            `Estimated IGST base: ${money(r.igstBase)}`,
            `IGST (${r.igstRate}%): ${money(r.igst)}`,
            `Compensation cess (${r.compCessRate}%): ${money(r.compensationCess)}`,
            "",
            `Total estimated customs duties and taxes: ${money(r.totalDuty)}`,
            `ESTIMATED LANDED COST: ${money(r.landedCost)}`,
            "",
            "Important: Planning estimate only. Confirm tariff classification, valuation, rates, statutory bases, exemptions and notifications with ICEGATE / Customs or a qualified customs professional.",
            "Official reference: https://www.icegate.gov.in/Webappl/Trade-Guide-on-Imports"
        ].join("\n");
    }

    function downloadReport() {
        if (!lastResult) return;
        const blob = new Blob([reportText()], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "india-import-duty-estimate.txt";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function printReport() {
        if (!lastResult) return;
        const content = reportText().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const printWindow = window.open("", "_blank", "width=800,height=700");
        if (!printWindow) {
            showError("The print window was blocked. Allow pop-ups for this page and try again.");
            return;
        }
        printWindow.document.write(`<!doctype html><html><head><title>Import Duty Estimate</title><style>
            body{font:14px Arial,sans-serif;color:#182536;padding:32px;line-height:1.6}
            pre{white-space:pre-wrap;font:13px/1.7 Arial,sans-serif}
            h1{font-size:20px} .note{margin-top:24px;color:#687789;font-size:12px}
            </style></head><body><h1>India Import Duty Estimate</h1><pre>${content}</pre></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    calculateButton.addEventListener("click", calculate);
    resetButton.addEventListener("click", reset);
    sampleButton.addEventListener("click", loadSample);
    downloadButton.addEventListener("click", downloadReport);
    printButton.addEventListener("click", printReport);

    // Recalculate only when the user explicitly presses Calculate.
    Object.values(fields).forEach((field) => {
        field.addEventListener("input", () => {
            if (lastResult) {
                lastResult = null;
                downloadButton.disabled = true;
                printButton.disabled = true;
            }
        });
        field.addEventListener("change", () => {
            if (lastResult) {
                lastResult = null;
                downloadButton.disabled = true;
                printButton.disabled = true;
            }
        });
    });
})();
