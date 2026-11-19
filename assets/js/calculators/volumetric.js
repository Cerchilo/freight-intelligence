
/* =========================================
   FREIGHT INTELLIGENCE CENTRE
   VOLUMETRIC WEIGHT CALCULATOR
========================================= */

(() => {
    "use strict";

    const elements = {
        length: document.getElementById("length"),
        width: document.getElementById("width"),
        height: document.getElementById("height"),
        unit: document.getElementById("dimensionUnit"),
        quantity: document.getElementById("quantity"),
        actualWeight: document.getElementById("actualWeight"),
        divisor: document.getElementById("divisor"),

        calculateButton: document.getElementById("calculateVolumetricBtn"),
        resetButton: document.getElementById("resetVolumetricBtn"),
        copyButton: document.getElementById("copyVolumetricBtn"),

        error: document.getElementById("volumetricError"),

        chargeableWeight: document.getElementById("chargeableWeight"),
        chargeableStatus: document.getElementById("chargeableStatus"),

        actualResult: document.getElementById("resultActualWeight"),
        volumetricResult: document.getElementById("resultVolumetricWeight"),
        volumeResult: document.getElementById("resultVolume"),
        quantityResult: document.getElementById("resultQuantity"),
        divisorResult: document.getElementById("resultDivisor"),
        basisResult: document.getElementById("resultBasis"),

        currentYear: document.getElementById("currentYear")
    };

    // Convert selected dimension units into centimetres.
    const unitToCm = {
        mm: 0.1,
        cm: 1,
        m: 100,
        inch: 2.54
    };

    let lastCalculation = null;

    if (elements.currentYear) {
        elements.currentYear.textContent = new Date().getFullYear();
    }

    function getInputValues() {
        return {
            length: Number(elements.length.value),
            width: Number(elements.width.value),
            height: Number(elements.height.value),
            unit: elements.unit.value,
            quantity: Number(elements.quantity.value),
            actualWeight: Number(elements.actualWeight.value),
            divisor: Number(elements.divisor.value)
        };
    }

    function validateInputs(data) {
        const dimensions = [
            { value: data.length, label: "Length" },
            { value: data.width, label: "Width" },
            { value: data.height, label: "Height" }
        ];

        for (const dimension of dimensions) {
            if (
                !Number.isFinite(dimension.value) ||
                dimension.value <= 0
            ) {
                return `Please enter a valid ${dimension.label.toLowerCase()} greater than zero.`;
            }
        }

        if (!Number.isInteger(data.quantity) || data.quantity < 1) {
            return "Package quantity must be a whole number greater than zero.";
        }

        if (
            !Number.isFinite(data.actualWeight) ||
            data.actualWeight <= 0
        ) {
            return "Please enter the total actual gross weight greater than zero.";
        }

        if (
            !Number.isFinite(data.divisor) ||
            data.divisor <= 0
        ) {
            return "Please enter a valid volumetric divisor greater than zero.";
        }

        if (!unitToCm[data.unit]) {
            return "Please select a valid dimension unit.";
        }

        return null;
    }

    function calculate() {
        clearError();

        const data = getInputValues();
        const errorMessage = validateInputs(data);

        if (errorMessage) {
            showError(errorMessage);
            return;
        }

        // Convert dimensions into centimetres.
        const conversion = unitToCm[data.unit];

        const lengthCm = data.length * conversion;
        const widthCm = data.width * conversion;
        const heightCm = data.height * conversion;

        // Volume of one package in cubic centimetres.
        const volumePerPackageCm3 =
            lengthCm * widthCm * heightCm;

        // Total volume across all packages.
        const totalVolumeCm3 =
            volumePerPackageCm3 * data.quantity;

        // Convert cubic centimetres into cubic metres.
        const totalVolumeM3 = totalVolumeCm3 / 1000000;

        // Volumetric weight formula.
        const volumetricWeight =
            totalVolumeCm3 / data.divisor;

        // Chargeable weight is the higher of the two.
        const isVolumetricHigher =
            volumetricWeight > data.actualWeight;

        const chargeableWeight = Math.max(
            data.actualWeight,
            volumetricWeight
        );

        lastCalculation = {
            ...data,
            totalVolumeM3,
            volumetricWeight,
            chargeableWeight,
            basis: isVolumetricHigher
                ? "Volumetric weight"
                : "Actual weight"
        };

        displayResults(lastCalculation);
    }

    function displayResults(result) {
        elements.chargeableWeight.textContent =
            result.chargeableWeight.toFixed(2);

        elements.actualResult.textContent =
            result.actualWeight.toFixed(2);

        elements.volumetricResult.textContent =
            result.volumetricWeight.toFixed(2);

        elements.volumeResult.textContent =
            `${result.totalVolumeM3.toFixed(3)} m³`;

        elements.quantityResult.textContent =
            result.quantity.toLocaleString("en-IN");

        elements.divisorResult.textContent =
            result.divisor.toLocaleString("en-IN");

        elements.basisResult.textContent = result.basis;

        elements.chargeableStatus.textContent =
            result.basis === "Volumetric weight"
                ? "Volumetric weight is higher"
                : result.volumetricWeight === result.actualWeight
                    ? "Both weights are equal"
                    : "Actual weight is higher";
    }

    function showError(message) {
        elements.error.textContent = message;
        elements.error.style.display = "block";
    }

    function clearError() {
        elements.error.textContent = "";
        elements.error.style.display = "none";
    }

    function resetCalculator() {
        elements.length.value = "";
        elements.width.value = "";
        elements.height.value = "";
        elements.unit.value = "cm";
        elements.quantity.value = "1";
        elements.actualWeight.value = "";
        elements.divisor.value = "6000";

        elements.chargeableWeight.textContent = "0.00";
        elements.chargeableStatus.textContent =
            "Enter shipment details to calculate";

        elements.actualResult.textContent = "0.00";
        elements.volumetricResult.textContent = "0.00";
        elements.volumeResult.textContent = "0.000 m³";
        elements.quantityResult.textContent = "0";
        elements.divisorResult.textContent = "6000";
        elements.basisResult.textContent = "—";

        lastCalculation = null;
        clearError();
    }

    async function copySummary() {
        if (!lastCalculation) {
            showError("Calculate the shipment weight before copying the summary.");
            return;
        }

        const result = lastCalculation;

        const summary = [
            "FREIGHT INTELLIGENCE CENTRE",
            "VOLUMETRIC WEIGHT SUMMARY",
            "--------------------------------",
            `Dimensions: ${result.length} × ${result.width} × ${result.height} ${result.unit}`,
            `Packages: ${result.quantity}`,
            `Actual gross weight: ${result.actualWeight.toFixed(2)} kg`,
            `Total volume: ${result.totalVolumeM3.toFixed(3)} m³`,
            `Volumetric divisor: ${result.divisor} cm³/kg`,
            `Volumetric weight: ${result.volumetricWeight.toFixed(2)} kg`,
            `Chargeable weight: ${result.chargeableWeight.toFixed(2)} kg`,
            `Chargeable basis: ${result.basis}`,
            "",
            "Note: Confirm carrier-specific rounding and billing rules."
        ].join("\n");

        try {
            await navigator.clipboard.writeText(summary);

            elements.copyButton.innerHTML =
                '<i class="bi bi-check2"></i> Copied!';

            setTimeout(() => {
                elements.copyButton.innerHTML =
                    '<i class="bi bi-clipboard"></i> Copy Summary';
            }, 1800);

        } catch (error) {
            showError("Unable to copy. Check your browser clipboard permissions.");
        }
    }

    elements.calculateButton.addEventListener("click", calculate);
    elements.resetButton.addEventListener("click", resetCalculator);
    elements.copyButton.addEventListener("click", copySummary);

})();
