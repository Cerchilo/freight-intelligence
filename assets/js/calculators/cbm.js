
/* =========================================
   FREIGHT INTELLIGENCE CENTRE
   CBM CALCULATOR
========================================= */

(() => {
    "use strict";

    const cargoItems = document.getElementById("cargoItems");
    const addItemBtn = document.getElementById("addItemBtn");
    const calculateBtn = document.getElementById("calculateBtn");
    const resetBtn = document.getElementById("resetBtn");
    const copyResultBtn = document.getElementById("copyResultBtn");
    const calculationError = document.getElementById("calculationError");

    const totalCbmElement = document.getElementById("totalCbm");
    const totalPackagesElement = document.getElementById("totalPackages");
    const totalWeightElement = document.getElementById("totalWeight");
    const averageCbmElement = document.getElementById("averageCbm");
    const itemBreakdownElement = document.getElementById("itemBreakdown");

    const currentYearElement = document.getElementById("currentYear");

    let lastCalculation = null;
    let rowCounter = 0;

    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    // Convert dimensions to metres.
    const unitConversion = {
        mm: 0.001,
        cm: 0.01,
        m: 1
    };

    // Create a cargo row.
    function createCargoRow() {
        rowCounter++;

        const row = document.createElement("tr");
        row.dataset.rowId = rowCounter;

        row.innerHTML = `
            <td>
                <input
                    type="text"
                    class="cargo-input cargo-name-input"
                    data-field="name"
                    placeholder="e.g. Cartons"
                    aria-label="Cargo name"
                    value="Cargo ${rowCounter}"
                >
            </td>

            <td>
                <input
                    type="number"
                    class="cargo-input"
                    data-field="length"
                    placeholder="0"
                    min="0"
                    step="any"
                    aria-label="Length"
                >
            </td>

            <td>
                <input
                    type="number"
                    class="cargo-input"
                    data-field="width"
                    placeholder="0"
                    min="0"
                    step="any"
                    aria-label="Width"
                >
            </td>

            <td>
                <input
                    type="number"
                    class="cargo-input"
                    data-field="height"
                    placeholder="0"
                    min="0"
                    step="any"
                    aria-label="Height"
                >
            </td>

            <td>
                <select class="cargo-select" data-field="unit" aria-label="Dimension unit">
                    <option value="cm" selected>CM</option>
                    <option value="mm">MM</option>
                    <option value="m">M</option>
                </select>
            </td>

            <td>
                <input
                    type="number"
                    class="cargo-input"
                    data-field="quantity"
                    value="1"
                    min="1"
                    step="1"
                    aria-label="Quantity"
                >
            </td>

            <td>
                <input
                    type="number"
                    class="cargo-input"
                    data-field="weight"
                    placeholder="0"
                    min="0"
                    step="any"
                    aria-label="Weight per package in kilograms"
                >
            </td>

            <td>
                <button
                    type="button"
                    class="remove-item-btn"
                    aria-label="Remove cargo item"
                    title="Remove item"
                >
                    <i class="bi bi-trash3"></i>
                </button>
            </td>
        `;

        cargoItems.appendChild(row);
    }

    // Add initial row.
    createCargoRow();

    // Add new cargo item.
    addItemBtn.addEventListener("click", () => {
        createCargoRow();
        clearError();
    });

    // Remove cargo item.
    cargoItems.addEventListener("click", (event) => {
        const removeButton = event.target.closest(".remove-item-btn");

        if (!removeButton) return;

        const row = removeButton.closest("tr");

        if (cargoItems.querySelectorAll("tr").length === 1) {
            showError("At least one cargo item is required.");
            return;
        }

        row.remove();
        calculateCargo();
    });

    // Get values from a row.
    function getRowData(row, index) {
        const getValue = (field) => {
            const element = row.querySelector(`[data-field="${field}"]`);

            if (!element) return "";

            return element.value.trim();
        };

        const name = getValue("name") || `Cargo ${index + 1}`;
        const length = Number(getValue("length"));
        const width = Number(getValue("width"));
        const height = Number(getValue("height"));
        const quantity = Number(getValue("quantity"));
        const weight = Number(getValue("weight"));
        const unit = getValue("unit");

        return {
            name,
            length,
            width,
            height,
            quantity,
            weight,
            unit
        };
    }

    // Validate cargo inputs.
    function validateCargoItems(items) {
        if (items.length === 0) {
            return "Please add at least one cargo item.";
        }

        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const label = item.name || `Cargo ${index + 1}`;

            if (
                !Number.isFinite(item.length) ||
                !Number.isFinite(item.width) ||
                !Number.isFinite(item.height) ||
                item.length <= 0 ||
                item.width <= 0 ||
                item.height <= 0
            ) {
                return `Enter valid length, width and height for ${label}.`;
            }

            if (
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
            ) {
                return `Quantity for ${label} must be a whole number greater than zero.`;
            }

            if (
                !Number.isFinite(item.weight) ||
                item.weight < 0
            ) {
                return `Enter a valid non-negative weight for ${label}.`;
            }

            if (!unitConversion[item.unit]) {
                return `Select a valid measurement unit for ${label}.`;
            }
        }

        return null;
    }

    // Calculate individual and total CBM.
    function calculateCargo() {
        clearError();

        const rows = Array.from(cargoItems.querySelectorAll("tr"));

        const items = rows.map((row, index) => {
            return getRowData(row, index);
        });

        const validationMessage = validateCargoItems(items);

        if (validationMessage) {
            showError(validationMessage);
            return;
        }

        let totalCbm = 0;
        let totalPackages = 0;
        let totalWeight = 0;

        const calculatedItems = items.map((item) => {
            const conversion = unitConversion[item.unit];

            const lengthInMetres = item.length * conversion;
            const widthInMetres = item.width * conversion;
            const heightInMetres = item.height * conversion;

            const cbmPerPackage =
                lengthInMetres *
                widthInMetres *
                heightInMetres;

            const itemTotalCbm = cbmPerPackage * item.quantity;
            const itemTotalWeight = item.weight * item.quantity;

            totalCbm += itemTotalCbm;
            totalPackages += item.quantity;
            totalWeight += itemTotalWeight;

            return {
                ...item,
                cbmPerPackage,
                itemTotalCbm,
                itemTotalWeight
            };
        });

        const averageCbm = totalPackages > 0
            ? totalCbm / totalPackages
            : 0;

        lastCalculation = {
            totalCbm,
            totalPackages,
            totalWeight,
            averageCbm,
            items: calculatedItems
        };

        displayResults(lastCalculation);
    }

    // Display results.
    function displayResults(result) {
        totalCbmElement.textContent = result.totalCbm.toFixed(3);
        totalPackagesElement.textContent = result.totalPackages.toLocaleString("en-IN");
        totalWeightElement.textContent = result.totalWeight.toFixed(2);
        averageCbmElement.textContent = result.averageCbm.toFixed(3);

        itemBreakdownElement.innerHTML = "";

        result.items.forEach((item) => {
            const breakdownRow = document.createElement("div");
            breakdownRow.className = "breakdown-item";

            const name = document.createElement("span");
            name.textContent = `${item.name} (${item.quantity} pkg)`;

            const value = document.createElement("strong");
            value.textContent = `${item.itemTotalCbm.toFixed(3)} CBM`;

            breakdownRow.appendChild(name);
            breakdownRow.appendChild(value);

            itemBreakdownElement.appendChild(breakdownRow);
        });
    }

    // Show validation error.
    function showError(message) {
        calculationError.textContent = message;
        calculationError.style.display = "block";
    }

    function clearError() {
        calculationError.textContent = "";
        calculationError.style.display = "none";
    }

    // Calculate button.
    calculateBtn.addEventListener("click", calculateCargo);

    // Reset everything.
    resetBtn.addEventListener("click", () => {
        cargoItems.innerHTML = "";
        rowCounter = 0;

        createCargoRow();

        lastCalculation = null;

        totalCbmElement.textContent = "0.000";
        totalPackagesElement.textContent = "0";
        totalWeightElement.textContent = "0.00";
        averageCbmElement.textContent = "0.000";

        itemBreakdownElement.textContent =
            "Add cargo details to see the breakdown.";

        itemBreakdownElement.className = "breakdown-empty";

        clearError();
    });

    // Copy calculation summary.
    copyResultBtn.addEventListener("click", async () => {
        if (!lastCalculation) {
            showError("Please calculate your cargo details before copying the summary.");
            return;
        }

        const result = lastCalculation;

        const lines = [
            "FREIGHT INTELLIGENCE CENTRE - CBM SUMMARY",
            "------------------------------------------",
            `Total CBM: ${result.totalCbm.toFixed(3)} m³`,
            `Total packages: ${result.totalPackages}`,
            `Total gross weight: ${result.totalWeight.toFixed(2)} kg`,
            `Average CBM per package: ${result.averageCbm.toFixed(3)} m³`,
            "",
            "ITEM BREAKDOWN"
        ];

        result.items.forEach((item) => {
            lines.push(
                `${item.name}: ${item.quantity} packages | ` +
                `${item.itemTotalCbm.toFixed(3)} CBM | ` +
                `${item.itemTotalWeight.toFixed(2)} kg`
            );
        });

        try {
            await navigator.clipboard.writeText(lines.join("\n"));

            copyResultBtn.innerHTML =
                '<i class="bi bi-check2"></i> Copied!';

            setTimeout(() => {
                copyResultBtn.innerHTML =
                    '<i class="bi bi-clipboard"></i> Copy Summary';
            }, 1800);

        } catch (error) {
            showError("Unable to copy. Please check your browser clipboard permissions.");
        }
    });

})();
