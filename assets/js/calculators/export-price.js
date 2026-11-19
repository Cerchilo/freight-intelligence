(() => {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const ids = [
        "productName", "reference", "quantity", "unitPrice", "packingCost",
        "inlandTransport", "loadingCost", "exportClearance", "originHandling",
        "onboardLoading", "freightCost", "insuranceCost", "profitMargin",
        "otherSellerCost"
    ];
    const fields = Object.fromEntries(ids.map((id) => [id, $(id)]));
    const currency = $("currency");
    const mode = $("transportMode");
    const term = $("selectedTerm");
    const errorBox = $("exportError");
    const downloadButton = $("downloadExportBtn");
    const printButton = $("printExportBtn");

    const termOrder = ["EXW", "FCA", "FOB", "CFR", "CIF"];
    const termNames = {
        EXW: "Ex Works",
        FCA: "Free Carrier",
        FOB: "Free On Board",
        CFR: "Cost and Freight",
        CIF: "Cost, Insurance and Freight"
    };
    const termDescriptions = {
        EXW: "Goods made available to the buyer at the named place.",
        FCA: "Seller delivers the goods to the buyer's nominated carrier at the named place.",
        FOB: "Seller's estimated price up to delivery on board at the named port of shipment.",
        CFR: "Seller's estimated price including carriage to the named destination port.",
        CIF: "Seller's estimated price including carriage and cargo insurance to the named destination port."
    };

    let lastResult = null;

    $("currentYear").textContent = new Date().getFullYear();

    function currencyCode() {
        return currency.value;
    }

    function formatMoney(value) {
        try {
            return new Intl.NumberFormat("en", {
                style: "currency",
                currency: currencyCode(),
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
        } catch {
            return `${currencyCode()} ${Number(value).toFixed(2)}`;
        }
    }

    function value(id) {
        return Number(fields[id].value);
    }

    function readData() {
        const data = {};
        ids.forEach((id) => {
            if (id === "productName" || id === "reference") data[id] = fields[id].value.trim();
            else data[id] = value(id);
        });
        data.currency = currencyCode();
        data.mode = mode.value;
        data.term = term.value;
        return data;
    }

    function validate(data) {
        if (!data.productName) return "Enter a product or shipment description.";
        if (!Number.isFinite(data.quantity) || data.quantity <= 0) return "Quantity must be greater than zero.";
        if (!Number.isFinite(data.unitPrice) || data.unitPrice < 0) return "Enter a valid product value per unit.";
        const costFields = [
            ["Export packing & marking", data.packingCost],
            ["Inland transport", data.inlandTransport],
            ["Loading / handling", data.loadingCost],
            ["Export clearance", data.exportClearance],
            ["Origin terminal handling", data.originHandling],
            ["On-board loading", data.onboardLoading],
            ["Main freight", data.freightCost],
            ["Insurance premium", data.insuranceCost],
            ["Other seller costs", data.otherSellerCost]
        ];
        for (const [label, amount] of costFields) {
            if (!Number.isFinite(amount) || amount < 0) return `${label} must be zero or a positive amount.`;
        }
        if (!Number.isFinite(data.profitMargin) || data.profitMargin < 0 || data.profitMargin > 500) {
            return "Profit markup must be between 0% and 500%.";
        }
        if (data.mode === "air" && ["FOB", "CFR", "CIF"].includes(data.term)) {
            return "FOB, CFR and CIF are sea / inland waterway terms. Select EXW or FCA for this air / multimodal calculator.";
        }
        return null;
    }

    function updateCurrencyLabels() {
        const code = currencyCode();
        $("currencyUnit").textContent = code;
        document.querySelectorAll(".currency-suffix").forEach((node) => { node.textContent = code; });
        $("resultCurrency").textContent = code;
    }

    function updateModeOptions() {
        const isAir = mode.value === "air";
        ["FOB", "CFR", "CIF"].forEach((code) => {
            const option = term.querySelector(`option[value="${code}"]`);
            option.disabled = isAir;
        });
        if (isAir && ["FOB", "CFR", "CIF"].includes(term.value)) term.value = "FCA";
        $("termModeNote").innerHTML = isAir
            ? '<i class="bi bi-info-circle"></i><span>Air / multimodal transport selected. FOB, CFR and CIF are disabled because they are sea and inland waterway terms. Use FCA or EXW, or select sea transport for FOB / CFR / CIF.</span>'
            : '<i class="bi bi-info-circle"></i><span>FOB, CFR and CIF are intended for sea and inland waterway transport. For air or multimodal shipments, use FCA or another suitable Incoterm.</span>';
        $("ladderModeLabel").textContent = isAir ? "AIR / MULTIMODAL" : "SEA";
        renderLadder(lastResult ? lastResult.ladder : null);
        invalidateResult();
    }

    function includedCostTotals(data) {
        const productBase = data.unitPrice * data.quantity + data.packingCost;
        const inland = data.inlandTransport + data.loadingCost;
        const origin = data.exportClearance + data.originHandling + data.onboardLoading;
        const fcaBase = productBase + inland + data.exportClearance;
        const fobBase = fcaBase + data.originHandling + data.onboardLoading;
        const cfrBase = fobBase + data.freightCost;
        const cifBase = cfrBase + data.insuranceCost;
        const extra = data.otherSellerCost;

        return {
            EXW: productBase + extra,
            FCA: fcaBase + extra,
            FOB: fobBase + extra,
            CFR: cfrBase + extra,
            CIF: cifBase + extra,
            productBase, inland, origin, extra
        };
    }

    function calculate() {
        clearError();
        const data = readData();
        const message = validate(data);
        if (message) {
            showError(message);
            return;
        }

        const totals = includedCostTotals(data);
        const applicableTerms = data.mode === "air" ? ["EXW", "FCA"] : termOrder;
        const ladder = {};
        applicableTerms.forEach((code) => {
            const cost = totals[code];
            ladder[code] = { cost, markup: cost * data.profitMargin / 100, price: cost * (1 + data.profitMargin / 100) };
        });

        const selected = ladder[data.term];
        if (!selected) {
            showError("The selected Incoterm is not available for this transport mode.");
            return;
        }

        const baseForTerm = {
            EXW: { productBase: totals.productBase, inland: 0, origin: 0, freight: 0, insurance: 0, other: totals.extra },
            FCA: { productBase: totals.productBase, inland: totals.inland, origin: data.exportClearance, freight: 0, insurance: 0, other: totals.extra },
            FOB: { productBase: totals.productBase, inland: totals.inland, origin: data.exportClearance + data.originHandling + data.onboardLoading, freight: 0, insurance: 0, other: totals.extra },
            CFR: { productBase: totals.productBase, inland: totals.inland, origin: data.exportClearance + data.originHandling + data.onboardLoading, freight: data.freightCost, insurance: 0, other: totals.extra },
            CIF: { productBase: totals.productBase, inland: totals.inland, origin: data.exportClearance + data.originHandling + data.onboardLoading, freight: data.freightCost, insurance: data.insuranceCost, other: totals.extra }
        };
        const breakdown = baseForTerm[data.term];
        const costSubtotal = selected.cost;
        const markupAmount = selected.markup;
        const finalPrice = selected.price;

        lastResult = {
            ...data, totals, ladder, breakdown, costSubtotal, markupAmount,
            finalPrice, perUnit: finalPrice / data.quantity
        };
        render(lastResult);
        downloadButton.disabled = false;
        printButton.disabled = false;
    }

    function render(result) {
        const code = result.term;
        $("resultTermTitle").textContent = `${code} export price`;
        $("resultTermDescription").textContent = termDescriptions[code];
        $("exportPrice").textContent = result.finalPrice.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        $("resultCurrency").textContent = result.currency;
        $("resultProductBase").textContent = formatMoney(result.breakdown.productBase);
        $("resultInland").textContent = formatMoney(result.breakdown.inland);
        $("resultOrigin").textContent = formatMoney(result.breakdown.origin);
        $("resultFreight").textContent = formatMoney(result.breakdown.freight);
        $("resultInsurance").textContent = formatMoney(result.breakdown.insurance);
        $("resultOther").textContent = formatMoney(result.breakdown.other);
        $("resultSubtotal").textContent = formatMoney(result.costSubtotal);
        $("resultMarkup").textContent = formatMoney(result.markupAmount);
        $("resultTermShort").textContent = code;
        $("resultTotal").textContent = formatMoney(result.finalPrice);
        $("perUnitPrice").textContent = `Estimated price per unit: ${formatMoney(result.perUnit)} · Quantity: ${result.quantity}`;
        renderLadder(result.ladder);
    }

    function renderLadder(ladder) {
        termOrder.forEach((code) => {
            const row = document.querySelector(`.ladder-row[data-term="${code}"]`);
            const amount = $(`ladder${code}`);
            const isUnavailableForAir = mode.value === "air" && ["FOB", "CFR", "CIF"].includes(code);
            row.classList.toggle("is-included", Boolean(ladder && ladder[code]) && !isUnavailableForAir);
            row.classList.toggle("is-selected", Boolean(ladder && term.value === code));
            if (isUnavailableForAir) amount.textContent = "Not applicable";
            else if (ladder && ladder[code]) amount.textContent = formatMoney(ladder[code].price);
            else amount.textContent = "—";
        });
        $("ladderFootnote").textContent = ladder
            ? "Each price is a cumulative seller-cost estimate plus the entered markup. The selected named place and actual contractual allocation must be confirmed."
            : "Load sample data or enter costs and calculate to populate the indicative price ladder.";
    }

    function invalidateResult() {
        if (!lastResult) return;
        lastResult = null;
        downloadButton.disabled = true;
        printButton.disabled = true;
        $("exportPrice").textContent = "0.00";
        $("resultSubtotal").textContent = formatMoney(0);
        $("resultTotal").textContent = formatMoney(0);
        $("perUnitPrice").textContent = "Estimated price per unit: —";
        renderLadder(null);
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.style.display = "block";
    }
    function clearError() {
        errorBox.textContent = "";
        errorBox.style.display = "none";
    }

    function reset() {
        Object.values(fields).forEach((field) => {
            if (field.id === "quantity") field.value = "1";
            else if (["packingCost", "inlandTransport", "loadingCost", "exportClearance", "originHandling", "onboardLoading", "freightCost", "insuranceCost", "profitMargin", "otherSellerCost"].includes(field.id)) field.value = "0";
            else field.value = "";
        });
        currency.value = "USD";
        mode.value = "sea";
        term.value = "FOB";
        updateCurrencyLabels();
        updateModeOptions();
        lastResult = null;
        clearError();
        resetResultDisplay();
    }

    function resetResultDisplay() {
        $("resultTermTitle").textContent = "FOB export price";
        $("resultTermDescription").textContent = "Seller's estimated price up to the named port of shipment.";
        $("exportPrice").textContent = "0.00";
        $("resultCurrency").textContent = currencyCode();
        ["resultProductBase", "resultInland", "resultOrigin", "resultFreight", "resultInsurance", "resultOther", "resultSubtotal", "resultMarkup", "resultTotal"].forEach((id) => $(id).textContent = formatMoney(0));
        $("resultTermShort").textContent = term.value;
        $("perUnitPrice").textContent = "Estimated price per unit: —";
        downloadButton.disabled = true;
        printButton.disabled = true;
        renderLadder(null);
    }

    function loadSample() {
        fields.productName.value = "Cotton garments";
        fields.reference.value = "EXP-SAMPLE-001";
        fields.quantity.value = "100";
        fields.unitPrice.value = "12";
        fields.packingCost.value = "150";
        fields.inlandTransport.value = "250";
        fields.loadingCost.value = "50";
        fields.exportClearance.value = "100";
        fields.originHandling.value = "180";
        fields.onboardLoading.value = "70";
        fields.freightCost.value = "900";
        fields.insuranceCost.value = "120";
        fields.profitMargin.value = "10";
        fields.otherSellerCost.value = "30";
        currency.value = "USD";
        mode.value = "sea";
        term.value = "CIF";
        updateCurrencyLabels();
        updateModeOptions();
        calculate();
    }

    function reportText() {
        if (!lastResult) return "";
        const r = lastResult;
        const lines = [
            "FREIGHT INTELLIGENCE CENTRE",
            "EXPORT PRICE ESTIMATE",
            "================================",
            `Product: ${r.productName}`,
            `Reference: ${r.reference || "Not specified"}`,
            `Quantity: ${r.quantity}`,
            `Transport mode: ${r.mode}`,
            `Incoterm: ${r.term} — ${termNames[r.term]} (confirm Incoterms® version and named place / port)`,
            `Currency: ${r.currency}`,
            "",
            `Product value + packing: ${formatMoney(r.breakdown.productBase)}`,
            `Inland transport & loading: ${formatMoney(r.breakdown.inland)}`,
            `Export clearance & origin charges: ${formatMoney(r.breakdown.origin)}`,
            `Main freight: ${formatMoney(r.breakdown.freight)}`,
            `Insurance: ${formatMoney(r.breakdown.insurance)}`,
            `Other seller costs: ${formatMoney(r.breakdown.other)}`,
            `Cost subtotal: ${formatMoney(r.costSubtotal)}`,
            `Profit markup (${r.profitMargin}%): ${formatMoney(r.markupAmount)}`,
            "",
            `ESTIMATED ${r.term} PRICE: ${formatMoney(r.finalPrice)}`,
            `ESTIMATED PRICE PER UNIT: ${formatMoney(r.perUnit)}`,
            "",
            "Planning estimate only. Confirm the contract's named place / port, Incoterms® version, cost allocation and risk transfer before quoting commercially."
        ];
        return lines.join("\n");
    }

    function downloadReport() {
        if (!lastResult) return;
        const blob = new Blob([reportText()], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "export-price-estimate.txt";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function printReport() {
        if (!lastResult) return;
        const safeText = reportText().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const printWindow = window.open("", "_blank", "width=800,height=700");
        if (!printWindow) {
            showError("The print window was blocked. Allow pop-ups for this page and try again.");
            return;
        }
        printWindow.document.write(`<!doctype html><html><head><title>Export Price Estimate</title><style>body{font:14px Arial,sans-serif;color:#182536;padding:32px;line-height:1.6}pre{white-space:pre-wrap;font:13px/1.7 Arial,sans-serif}</style></head><body><h1>Export Price Estimate</h1><pre>${safeText}</pre></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    $("calculateExportBtn").addEventListener("click", calculate);
    $("resetExportBtn").addEventListener("click", reset);
    $("sampleExportBtn").addEventListener("click", loadSample);
    downloadButton.addEventListener("click", downloadReport);
    printButton.addEventListener("click", printReport);
    currency.addEventListener("change", () => { updateCurrencyLabels(); invalidateResult(); });
    mode.addEventListener("change", updateModeOptions);
    term.addEventListener("change", () => { invalidateResult(); renderLadder(null); });
    Object.values(fields).forEach((field) => {
        field.addEventListener("input", invalidateResult);
        field.addEventListener("change", invalidateResult);
    });

    updateCurrencyLabels();
    updateModeOptions();
    resetResultDisplay();
})();
