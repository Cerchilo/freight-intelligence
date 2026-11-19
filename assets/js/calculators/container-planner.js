
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const els = {
        rows: $('cargoRows'), add: $('addCargoBtn'), clear: $('clearCargoBtn'), error: $('plannerError'),
        packages: $('summaryPackages'), cbm: $('summaryCbm'), weight: $('summaryWeight'), average: $('summaryAverage'),
        length: $('containerLength'), width: $('containerWidth'), height: $('containerHeight'), payload: $('containerPayload'),
        containerName: $('selectedContainerName'), optimize: $('optimizeBtn'),
        volumeRing: $('volumeRing'), volumeUtil: $('volumeUtilization'), utilizedVolume: $('utilizedVolume'), capacityVolume: $('capacityVolume'),
        payloadUtil: $('payloadUtilization'), payloadProgress: $('payloadProgress'), loadedWeight: $('loadedWeight'), payloadLimit: $('payloadLimit'),
        loadedPackages: $('loadedPackages'), unplacedPackages: $('unplacedPackages'), remainingVolume: $('remainingVolume'), remainingPayload: $('remainingPayload'),
        status: $('optimizerStatus'), placementRows: $('placementRows'), subtitle: $('visualizationSubtitle'), viewerLoading: $('viewerLoading'),
        resetView: $('viewResetBtn'), showContainer: $('showContainerBtn'), showCargo: $('showCargoBtn'), download: $('downloadReportBtn'), print: $('printReportBtn')
    };

    const containerPresets = {
        '20std': { name: '20ft Standard Container', length: 5.90, width: 2.35, height: 2.39, payload: 28200 },
        '40std': { name: '40ft Standard Container', length: 12.03, width: 2.35, height: 2.39, payload: 26700 },
        '40hc': { name: '40ft High Cube Container', length: 12.03, width: 2.35, height: 2.69, payload: 26500 },
        '20reefer': { name: '20ft Reefer Container', length: 5.45, width: 2.29, height: 2.27, payload: 27000 },
        '40reefer': { name: '40ft Reefer Container', length: 11.56, width: 2.29, height: 2.25, payload: 26000 }
    };

    const unitToM = { mm: 0.001, cm: 0.01, m: 1, inch: 0.0254 };

    let rowId = 0;
    let latestPlan = null;
    let currentPreset = '20std';

    let scene, camera, renderer, controls;
    let containerGroup, cargoGroup, floorGrid;

    let containerVisible = true;
    let cargoVisible = true;
    let resizeObserver;

    $('currentYear').textContent = new Date().getFullYear();

    // =========================================
    // CARGO MANAGEMENT
    // =========================================

    function addCargoRow(values = {}) {
        rowId += 1;

        const tr = document.createElement('tr');
        tr.dataset.rowId = String(rowId);

        const safeName = values.name || `Cargo ${rowId}`;

        tr.innerHTML = `
      <td>
        <input class="planner-field name-field"
          data-field="name" type="text"
          maxlength="60"
          value="${escapeAttr(safeName)}"
          aria-label="Cargo description">
      </td>

      <td>
        <input class="planner-field"
          data-field="length" type="number"
          min="0" step="any"
          placeholder="0" value="${values.length ?? ''}"
          aria-label="Length">
      </td>

      <td>
        <input class="planner-field"
          data-field="width" type="number"
          min="0" step="any"
          placeholder="0" value="${values.width ?? ''}"
          aria-label="Width">
      </td>

      <td>
        <input class="planner-field"
          data-field="height" type="number"
          min="0" step="any"
          placeholder="0" value="${values.height ?? ''}"
          aria-label="Height">
      </td>

      <td>
        <select class="planner-field unit-field"
          data-field="unit" aria-label="Dimension unit">

          <option value="cm" ${(!values.unit || values.unit === 'cm') ? 'selected' : ''}>CM</option>
          <option value="mm" ${values.unit === 'mm' ? 'selected' : ''}>MM</option>
          <option value="m" ${values.unit === 'm' ? 'selected' : ''}>M</option>
          <option value="inch" ${values.unit === 'inch' ? 'selected' : ''}>IN</option>

        </select>
      </td>

      <td>
        <input class="planner-field"
          data-field="quantity" type="number"
          min="1" step="1"
          value="${values.quantity ?? 1}"
          aria-label="Package quantity">
      </td>

      <td>
        <input class="planner-field"
          data-field="weight" type="number"
          min="0" step="any"
          placeholder="0" value="${values.weight ?? ''}"
          aria-label="Weight per package in kilograms">
      </td>

      <td class="check-cell">
        <input class="planner-check"
          data-field="stackable" type="checkbox"
          ${values.stackable === false ? '' : 'checked'}
          aria-label="Stackable cargo">
      </td>

      <td class="check-cell">
        <input class="planner-check"
          data-field="rotate" type="checkbox"
          ${values.rotate === false ? '' : 'checked'}
          aria-label="Rotation allowed">
      </td>

      <td>
        <button type="button"
          class="remove-cargo"
          aria-label="Remove cargo item"
          title="Remove item">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    `;

        els.rows.appendChild(tr);
        refreshCargoSummary();
    }

    function escapeAttr(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    function readCargoRows() {
        return [...els.rows.querySelectorAll('tr')].map((row, index) => {
            const val = (key) =>
                row.querySelector(`[data-field="${key}"]`);

            const number = (key) => Number(val(key).value);

            const unit = val('unit').value;
            const conversion = unitToM[unit] || 0;

            return {
                id: index + 1,
                name: val('name').value.trim() || `Cargo ${index + 1}`,

                length: number('length') * conversion,
                width: number('width') * conversion,
                height: number('height') * conversion,

                rawLength: number('length'),
                rawWidth: number('width'),
                rawHeight: number('height'),

                unit,
                quantity: number('quantity'),
                weight: number('weight'),

                stackable: val('stackable').checked,
                rotate: val('rotate').checked
            };
        });
    }

    function validateCargo(items) {
        if (!items.length) {
            return 'Add at least one cargo item before calculating.';
        }

        let totalPackages = 0;

        for (const item of items) {
            if (![item.length, item.width, item.height]
                .every((n) => Number.isFinite(n) && n > 0)) {
                return `Enter valid positive dimensions for ${item.name}.`;
            }

            if (!Number.isInteger(item.quantity) || item.quantity < 1) {
                return `Quantity for ${item.name} must be a whole number greater than zero.`;
            }

            if (!Number.isFinite(item.weight) || item.weight < 0) {
                return `Enter a valid non-negative package weight for ${item.name}.`;
            }

            totalPackages += item.quantity;
        }

        if (totalPackages > 150) {
            return 'This browser-based 3D planner currently supports up to 150 packages per optimization to keep the interactive packing calculation responsive. Split larger shipments into separate plans.';
        }

        return null;
    }

    function cargoTotals(items) {
        return items.reduce((totals, item) => {
            const volume =
                item.length * item.width * item.height * item.quantity;

            totals.packages += item.quantity;
            totals.cbm += volume;
            totals.weight += item.weight * item.quantity;

            return totals;
        }, { packages: 0, cbm: 0, weight: 0 });
    }

    function refreshCargoSummary() {
        const items = readCargoRows();

        const valid = items.every((item) =>
            item.length > 0 &&
            item.width > 0 &&
            item.height > 0 &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            item.weight >= 0 &&
            Number.isFinite(item.weight)
        );

        const totals = valid
            ? cargoTotals(items)
            : { packages: 0, cbm: 0, weight: 0 };

        els.packages.textContent = totals.packages.toLocaleString('en-IN');
        els.cbm.textContent = totals.cbm.toFixed(3);
        els.weight.textContent = totals.weight.toFixed(2);

        els.average.textContent = totals.packages
            ? (totals.cbm / totals.packages).toFixed(3)
            : '0.000';

        return { items, totals, valid };
    }

    function showError(message) {
        els.error.textContent = message;
        els.error.style.display = 'block';
    }

    function clearError() {
        els.error.textContent = '';
        els.error.style.display = 'none';
    }

    // =========================================
    // CONTAINER MANAGEMENT
    // =========================================

    function getContainer() {
        return {
            name: els.containerName.textContent,
            length: Number(els.length.value),
            width: Number(els.width.value),
            height: Number(els.height.value),
            payload: Number(els.payload.value)
        };
    }

    function clearGroup(group) {
        if (!group) return;

        while (group.children.length) {
            const child = group.children[0];

            group.remove(child);

            child.traverse?.((obj) => {
                if (obj.geometry) obj.geometry.dispose();

                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((material) => {
                            material.map?.dispose();
                            material.dispose();
                        });
                    } else {
                        obj.material.map?.dispose();
                        obj.material.dispose();
                    }
                }
            });
        }
    }

    function invalidatePlan(
        message = 'Cargo or container details changed. Run the optimizer again to refresh the loading plan.'
    ) {
        latestPlan = null;

        disableReports();

        if (cargoGroup) clearGroup(cargoGroup);

        els.subtitle.textContent = 'Plan out of date — optimize again';

        els.volumeUtil.textContent = '0%';
        els.volumeRing.style.background =
            'conic-gradient(var(--fic-orange) 0%, #edf0f4 0)';

        els.utilizedVolume.textContent = '0.000';

        els.payloadUtil.textContent = '0%';
        els.payloadProgress.style.width = '0%';

        els.loadedWeight.textContent = '0.00';
        els.loadedPackages.textContent = '0 / 0';
        els.unplacedPackages.textContent = '0';

        els.remainingVolume.textContent = '0.000 CBM';
        els.remainingPayload.textContent = '0.00 kg';

        els.placementRows.innerHTML = `
      <tr>
        <td colspan="6" class="placement-empty">
          Run the optimizer to generate package placement details.
        </td>
      </tr>`;

        setNeutralStatus(message);
    }

    function setPreset(key) {
        currentPreset = key;

        const preset = containerPresets[key];

        els.containerName.textContent = preset.name;
        els.length.value = preset.length.toFixed(2);
        els.width.value = preset.width.toFixed(2);
        els.height.value = preset.height.toFixed(2);
        els.payload.value = preset.payload;

        document.querySelectorAll('.container-preset').forEach((button) => {
            button.classList.toggle(
                'active',
                button.dataset.container === key
            );
        });

        updateCapacityDisplay();

        if (scene) buildContainerScene(getContainer());

        invalidatePlan(
            'Container specifications changed. Run the optimizer again to refresh the loading plan.'
        );
    }

    function updateCapacityDisplay() {
        const c = getContainer();
        const volume = c.length * c.width * c.height;

        els.capacityVolume.textContent =
            Number.isFinite(volume) ? volume.toFixed(2) : '0.00';

        els.payloadLimit.textContent =
            Number.isFinite(c.payload)
                ? c.payload.toLocaleString('en-IN')
                : '0';
    }

    // =========================================
    // CARGO PACKING ALGORITHM
    // =========================================

    function orientations(item) {
        const dims = [item.length, item.width, item.height];

        const variants = item.rotate ? [
            [dims[0], dims[1], dims[2]],
            [dims[0], dims[2], dims[1]],
            [dims[1], dims[0], dims[2]],
            [dims[1], dims[2], dims[0]],
            [dims[2], dims[0], dims[1]],
            [dims[2], dims[1], dims[0]]
        ] : [dims];

        const seen = new Set();

        return variants.filter((v) => {
            const key = v.map((n) => n.toFixed(5)).join('|');

            if (seen.has(key)) return false;

            seen.add(key);
            return true;
        });
    }

    function intersects(a, b, eps = 1e-5) {
        return (
            a.x < b.x + b.l - eps &&
            a.x + a.l > b.x + eps &&
            a.y < b.y + b.w - eps &&
            a.y + a.w > b.y + eps &&
            a.z < b.z + b.h - eps &&
            a.z + a.h > b.z + eps
        );
    }

    function hasSupport(candidate, placed) {
        if (candidate.z < 1e-5) return true;

        return placed.some((base) =>
            base.stackable &&
            Math.abs(base.z + base.h - candidate.z) < 1e-4 &&
            candidate.x >= base.x - 1e-5 &&
            candidate.y >= base.y - 1e-5 &&
            candidate.x + candidate.l <= base.x + base.l + 1e-5 &&
            candidate.y + candidate.w <= base.y + base.w + 1e-5
        );
    }

    function compareScore(a, b) {
        for (let i = 0; i < a.length; i++) {
            if (Math.abs(a[i] - b[i]) > 1e-6) {
                return a[i] - b[i];
            }
        }

        return 0;
    }

    function packCargo(items, container) {
        const packages = [];

        for (const item of items) {
            for (let i = 0; i < item.quantity; i++) {
                packages.push({
                    ...item,
                    packageNumber: i + 1,
                    volume: item.length * item.width * item.height
                });
            }
        }

        packages.sort((a, b) =>
            (b.volume - a.volume) || (b.weight - a.weight)
        );

        const placed = [];
        const unplaced = [];
        const points = [{ x: 0, y: 0, z: 0 }];

        let loadedWeight = 0;
        const eps = 1e-5;

        for (const pkg of packages) {
            if (loadedWeight + pkg.weight > container.payload + eps) {
                unplaced.push({ ...pkg, reason: 'Payload limit' });
                continue;
            }

            let best = null;
            const variants = orientations(pkg);

            for (const point of points) {
                for (const dims of variants) {
                    const [l, w, h] = dims;

                    if (!pkg.stackable && point.z > eps) continue;

                    if (
                        point.x + l > container.length + eps ||
                        point.y + w > container.width + eps ||
                        point.z + h > container.height + eps
                    ) continue;

                    const candidate = {
                        x: point.x,
                        y: point.y,
                        z: point.z,
                        l, w, h,
                        stackable: pkg.stackable,
                        name: pkg.name,
                        weight: pkg.weight
                    };

                    if (!hasSupport(candidate, placed)) continue;
                    if (placed.some((existing) => intersects(candidate, existing))) continue;

                    const score = [point.z, point.y, point.x, h, l * w];

                    if (!best || compareScore(score, best.score) < 0) {
                        best = { ...candidate, score, original: pkg };
                    }
                }
            }

            if (!best) {
                unplaced.push({
                    ...pkg,
                    reason: 'No available space / stacking constraint'
                });
                continue;
            }

            const record = {
                ...best,
                itemName: pkg.name,
                itemId: pkg.id,
                packageNumber: pkg.packageNumber,
                weight: pkg.weight,
                stackable: pkg.stackable
            };

            delete record.score;
            delete record.original;

            placed.push(record);
            loadedWeight += pkg.weight;

            points.push(
                { x: record.x + record.l, y: record.y, z: record.z },
                { x: record.x, y: record.y + record.w, z: record.z },
                { x: record.x, y: record.y, z: record.z + record.h }
            );

            const unique = new Map();

            for (const p of points) {
                if (
                    p.x < -eps || p.y < -eps || p.z < -eps ||
                    p.x > container.length + eps ||
                    p.y > container.width + eps ||
                    p.z > container.height + eps
                ) continue;

                if (placed.some((box) =>
                    p.x > box.x + eps &&
                    p.x < box.x + box.l - eps &&
                    p.y > box.y + eps &&
                    p.y < box.y + box.w - eps &&
                    p.z > box.z + eps &&
                    p.z < box.z + box.h - eps
                )) continue;

                unique.set(
                    `${p.x.toFixed(4)}|${p.y.toFixed(4)}|${p.z.toFixed(4)}`,
                    p
                );
            }

            points.length = 0;
            points.push(...unique.values());

            points.sort((a, b) =>
                a.z - b.z || a.y - b.y || a.x - b.x
            );
        }

        return {
            placed,
            unplaced,
            loadedWeight,
            packages: packages.length
        };
    }


    // =========================================
    // RUN OPTIMIZER
    // =========================================

    function runOptimizer() {
        clearError();

        const { items } = refreshCargoSummary();
        const validation = validateCargo(items);

        if (validation) {
            showError(validation);
            return;
        }

        const container = getContainer();

        if (
            ![
                container.length,
                container.width,
                container.height,
                container.payload
            ].every((n) => Number.isFinite(n) && n > 0)
        ) {
            showError('Enter valid positive container dimensions and payload.');
            return;
        }

        const totals = cargoTotals(items);
        const plan = packCargo(items, container);

        plan.container = container;
        plan.cargoTotals = totals;
        plan.volumeCapacity =
            container.length * container.width * container.height;

        plan.loadedVolume = plan.placed.reduce(
            (sum, box) => sum + box.l * box.w * box.h,
            0
        );

        plan.loadedPackages = plan.placed.length;

        plan.remainingPayload = Math.max(
            0,
            container.payload - plan.loadedWeight
        );

        plan.remainingVolume = Math.max(
            0,
            plan.volumeCapacity - plan.loadedVolume
        );

        latestPlan = plan;

        renderPlan(plan);

        if (renderer) {
            buildCargoScene(plan);
        }

        enableReports();
    }

    function renderPlan(plan) {
        const volumePct =
            plan.volumeCapacity
                ? (plan.loadedVolume / plan.volumeCapacity) * 100
                : 0;

        const payloadPct =
            plan.container.payload
                ? (plan.loadedWeight / plan.container.payload) * 100
                : 0;

        const clampedVolume = Math.min(100, volumePct);
        const clampedPayload = Math.min(100, payloadPct);

        els.volumeUtil.textContent = `${volumePct.toFixed(1)}%`;

        els.volumeRing.style.background =
            `conic-gradient(var(--fic-orange) ${clampedVolume}%, #edf0f4 ${clampedVolume}% 100%)`;

        els.utilizedVolume.textContent = plan.loadedVolume.toFixed(3);
        els.capacityVolume.textContent = plan.volumeCapacity.toFixed(2);

        els.payloadUtil.textContent = `${payloadPct.toFixed(1)}%`;
        els.payloadProgress.style.width = `${clampedPayload}%`;

        els.loadedWeight.textContent = plan.loadedWeight.toFixed(2);

        els.payloadLimit.textContent =
            plan.container.payload.toLocaleString('en-IN');

        els.loadedPackages.textContent =
            `${plan.loadedPackages} / ${plan.packages}`;

        els.unplacedPackages.textContent =
            String(plan.unplaced.length);

        els.remainingVolume.textContent =
            `${plan.remainingVolume.toFixed(3)} CBM`;

        els.remainingPayload.textContent =
            `${plan.remainingPayload.toFixed(2)} kg`;

        els.subtitle.textContent =
            `${plan.container.name} · ${plan.loadedPackages} packages placed`;

        if (plan.unplaced.length) {
            setStatus(
                'warning',
                `${plan.unplaced.length} package(s) could not be placed. Review the placement table and container specifications.`
            );
        } else if (payloadPct > 90 || volumePct > 90) {
            setStatus(
                'success',
                'All packages placed. Container utilization is high; verify distribution and securement before loading.'
            );
        } else {
            setStatus(
                'success',
                'All packages placed by the heuristic optimizer. Review the 3D arrangement before using this plan.'
            );
        }

        els.placementRows.innerHTML = '';

        const rows = [];

        plan.placed.forEach((box, index) => {
            rows.push({
                ...box,
                status: 'Placed',
                packageLabel: `${box.itemName} #${box.packageNumber}`,
                index: index + 1
            });
        });

        plan.unplaced.forEach((box) => {
            rows.push({
                ...box,
                status: box.reason || 'Not placed',
                packageLabel: `${box.name} #${box.packageNumber}`,
                index: '—'
            });
        });

        if (!rows.length) {
            els.placementRows.innerHTML = `
                <tr>
                    <td colspan="6" class="placement-empty">No packages found.</td>
                </tr>`;
            return;
        }

        rows.forEach((box) => {
            const tr = document.createElement('tr');

            const values = [
                box.index === '—'
                    ? '—'
                    : `PKG-${String(box.index).padStart(3, '0')}`,

                box.packageLabel,

                box.status === 'Placed'
                    ? `${box.x.toFixed(2)}, ${box.y.toFixed(2)}, ${box.z.toFixed(2)} m`
                    : '—',

                box.status === 'Placed'
                    ? `${box.l.toFixed(2)} × ${box.w.toFixed(2)} × ${box.h.toFixed(2)} m`
                    : '—',

                `${box.weight.toFixed(2)} kg`
            ];

            values.forEach((value) => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });

            const statusTd = document.createElement('td');
            const badge = document.createElement('span');

            badge.className =
                `placement-badge ${box.status === 'Placed' ? '' : 'unplaced'}`;

            badge.textContent = box.status;

            statusTd.appendChild(badge);
            tr.appendChild(statusTd);

            els.placementRows.appendChild(tr);
        });
    }

    function setStatus(type, message) {
        const icon =
            type === 'success' ? 'bi-check-circle' :
                type === 'warning' ? 'bi-exclamation-triangle' :
                    type === 'danger' ? 'bi-x-circle' :
                        'bi-info-circle';

        els.status.className = `optimizer-status ${type}`;
        els.status.innerHTML = `<i class="bi ${icon}"></i><span></span>`;
        els.status.querySelector('span').textContent = message;
    }

    function setNeutralStatus(message) {
        setStatus('neutral', message);
    }

    function enableReports() {
        els.download.disabled = false;
        els.print.disabled = false;
    }

    function disableReports() {
        els.download.disabled = true;
        els.print.disabled = true;
    }

    // =========================================
    // THREE.JS INITIALIZATION
    // =========================================

    function initThree() {
        const host = $('container3D');

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x14283d);
        scene.fog = new THREE.Fog(0x14283d, 18, 42);

        camera = new THREE.PerspectiveCamera(
            38,
            host.clientWidth / host.clientHeight,
            0.1,
            150
        );

        camera.position.set(9, 7, 10);

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });

        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2)
        );

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        host.appendChild(renderer.domElement);

        const hemi = new THREE.HemisphereLight(
            0xdceaff,
            0x39404a,
            2.0
        );

        scene.add(hemi);

        const key = new THREE.DirectionalLight(0xffe4c9, 3.1);

        key.position.set(-5, 10, 7);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.left = -15;
        key.shadow.camera.right = 15;
        key.shadow.camera.top = 12;
        key.shadow.camera.bottom = -12;

        scene.add(key);

        const fill = new THREE.DirectionalLight(0x91b9e5, 1.2);
        fill.position.set(8, 5, -7);
        scene.add(fill);

        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x1b2c3c,
            roughness: .92,
            metalness: .08
        });

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(80, 80),
            groundMat
        );

        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -.08;
        ground.receiveShadow = true;

        scene.add(ground);

        floorGrid = new THREE.GridHelper(
            40, 40, 0x53677a, 0x304356
        );

        floorGrid.position.y = -.065;
        scene.add(floorGrid);

        containerGroup = new THREE.Group();
        scene.add(containerGroup);

        cargoGroup = new THREE.Group();
        scene.add(cargoGroup);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = .06;
        controls.minDistance = 3;
        controls.maxDistance = 60;
        controls.maxPolarAngle = Math.PI * .49;

        buildContainerScene(getContainer());

        resizeRenderer();

        resizeObserver = new ResizeObserver(resizeRenderer);
        resizeObserver.observe(host);

        renderer.setAnimationLoop(() => {
            controls.update();
            renderer.render(scene, camera);
        });

        els.viewerLoading.classList.add('hidden');
    }

    function makeBox(
        parent,
        size,
        position,
        material,
        cast = true,
        receive = true
    ) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            material
        );

        mesh.position.set(position.x, position.y, position.z);
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;

        parent.add(mesh);

        return mesh;
    }


    // =========================================
    // CONTAINER 3D MODEL
    // =========================================

    function buildContainerScene(c) {
        if (!containerGroup) return;

        clearGroup(containerGroup);

        const L = c.length;
        const W = c.width;
        const H = c.height;

        const steel = new THREE.MeshStandardMaterial({
            color: 0x687783,
            metalness: .72,
            roughness: .48,
            side: THREE.DoubleSide
        });

        // Semi-transparent side panels.
        // This makes the cargo visible from outside.
        const steelDark = new THREE.MeshStandardMaterial({
            color: 0x526879,
            metalness: .45,
            roughness: .58,
            transparent: true,
            opacity: .22,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x98754f,
            roughness: .86,
            metalness: .04
        });

        const floorBase = new THREE.MeshStandardMaterial({
            color: 0x4a5660,
            metalness: .7,
            roughness: .55
        });

        const railMat = new THREE.MeshStandardMaterial({
            color: 0x89949b,
            metalness: .8,
            roughness: .38
        });

        // Container floor.
        makeBox(
            containerGroup,
            new THREE.Vector3(L, .12, W),
            new THREE.Vector3(L / 2, -.02, W / 2),
            floorBase
        );

        const boardCount = Math.max(12, Math.round(L * 5));

        for (let i = 0; i < boardCount; i++) {
            const x = (i + .5) * L / boardCount;

            makeBox(
                containerGroup,
                new THREE.Vector3(L / boardCount - .012, .035, W - .08),
                new THREE.Vector3(x, .06, W / 2),
                floorMat,
                false,
                true
            );
        }

        // Corrugated side-wall ribs.
        const ribCount = Math.max(18, Math.round(L * 5));

        for (let i = 0; i <= ribCount; i++) {
            const x = i * L / ribCount;

            makeBox(
                containerGroup,
                new THREE.Vector3(.035, H, .045),
                new THREE.Vector3(x, H / 2, .025),
                steel,
                false,
                true
            );

            makeBox(
                containerGroup,
                new THREE.Vector3(.035, H, .045),
                new THREE.Vector3(x, H / 2, W - .025),
                steel,
                false,
                true
            );
        }

        // Semi-transparent side panels.
        makeBox(
            containerGroup,
            new THREE.Vector3(L, H, .025),
            new THREE.Vector3(L / 2, H / 2, .015),
            steelDark,
            false,
            false
        );

        makeBox(
            containerGroup,
            new THREE.Vector3(L, H, .025),
            new THREE.Vector3(L / 2, H / 2, W - .015),
            steelDark,
            false,
            false
        );

        // Horizontal wall rails.
        [0.08, H * .5, H - .08].forEach((y) => {
            makeBox(
                containerGroup,
                new THREE.Vector3(L, .055, .07),
                new THREE.Vector3(L / 2, y, .04),
                railMat,
                false,
                true
            );

            makeBox(
                containerGroup,
                new THREE.Vector3(L, .055, .07),
                new THREE.Vector3(L / 2, y, W - .04),
                railMat,
                false,
                true
            );
        });

        // Closed far end wall.
        makeBox(
            containerGroup,
            new THREE.Vector3(.07, H, W),
            new THREE.Vector3(L - .035, H / 2, W / 2),
            steelDark,
            false,
            true
        );

        // Far end reinforcement ribs.
        for (let i = 0; i <= 14; i++) {
            makeBox(
                containerGroup,
                new THREE.Vector3(.08, H, .035),
                new THREE.Vector3(L - .07, H / 2, i * W / 14),
                steel,
                false,
                true
            );
        }

        // Open door frame.
        const frameX = .02;

        makeBox(
            containerGroup,
            new THREE.Vector3(.12, .12, W + .1),
            new THREE.Vector3(frameX, H + .02, W / 2),
            railMat
        );

        makeBox(
            containerGroup,
            new THREE.Vector3(.12, H, .12),
            new THREE.Vector3(frameX, H / 2, .02),
            railMat
        );

        makeBox(
            containerGroup,
            new THREE.Vector3(.12, H, .12),
            new THREE.Vector3(frameX, H / 2, W - .02),
            railMat
        );

        // Corner castings.
        for (const x of [0.03, L - .03]) {
            for (const z of [.03, W - .03]) {
                makeBox(
                    containerGroup,
                    new THREE.Vector3(.16, .16, .16),
                    new THREE.Vector3(x, H + .08, z),
                    steelDark
                );

                makeBox(
                    containerGroup,
                    new THREE.Vector3(.16, .16, .16),
                    new THREE.Vector3(x, .12, z),
                    steelDark
                );
            }
        }

        // Bottom rails.
        makeBox(
            containerGroup,
            new THREE.Vector3(L, .1, .1),
            new THREE.Vector3(L / 2, .13, .03),
            railMat
        );

        makeBox(
            containerGroup,
            new THREE.Vector3(L, .1, .1),
            new THREE.Vector3(L / 2, .13, W - .03),
            railMat
        );

        fitCameraToContainer(c);
    }

    // =========================================
    // CARGO LABEL TEXTURES
    // =========================================

    function makeLabelTexture(text, color) {
        const canvas = document.createElement('canvas');

        canvas.width = 256;
        canvas.height = 128;

        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#e8dfcf';
        ctx.fillRect(0, 0, 256, 128);

        ctx.strokeStyle = 'rgba(70,54,38,.22)';
        ctx.lineWidth = 4;
        ctx.strokeRect(5, 5, 246, 118);

        ctx.fillStyle = color;
        ctx.font = 'bold 23px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text.slice(0, 18).toUpperCase(), 128, 57, 220);

        ctx.fillStyle = '#6f665b';
        ctx.font = '14px Arial';
        ctx.fillText('FREIGHT / CARGO', 128, 88);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        return texture;
    }

    // =========================================
    // CARGO 3D VISUALIZATION
    // =========================================

    function buildCargoScene(plan) {
        if (!cargoGroup) return;

        clearGroup(cargoGroup);

        const palette = [
            0xb98757,
            0xc99a69,
            0xa9784d,
            0xd0aa7d,
            0xb78d66,
            0x9e7959,
            0xc5a17d
        ];

        plan.placed.forEach((box) => {
            const baseColor = palette[(box.itemId - 1) % palette.length];

            const carton = new THREE.MeshStandardMaterial({
                color: baseColor,
                roughness: .86,
                metalness: .02
            });

            const labelMat = new THREE.MeshStandardMaterial({
                map: makeLabelTexture(box.itemName, '#5a4938'),
                roughness: .95
            });

            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(
                    box.l * .985,
                    box.h * .985,
                    box.w * .985
                ),
                carton
            );

            // Container X = length, Y = height, Z = width.
            mesh.position.set(
                box.x + box.l / 2,
                box.z + box.h / 2 + .08,
                box.y + box.w / 2
            );

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            mesh.userData = {
                label: `${box.itemName} #${box.packageNumber}`,
                weight: box.weight
            };

            cargoGroup.add(mesh);

            // Top seam.
            const seamMat = new THREE.MeshStandardMaterial({
                color: 0x6c523d,
                roughness: .9
            });

            const seam = new THREE.Mesh(
                new THREE.BoxGeometry(box.l * .94, .008, .012),
                seamMat
            );

            seam.position.set(
                mesh.position.x,
                mesh.position.y + box.h * .48,
                mesh.position.z
            );

            cargoGroup.add(seam);

            // Cargo label.
            const label = new THREE.Mesh(
                new THREE.PlaneGeometry(
                    Math.min(box.l * .58, .45),
                    Math.min(box.h * .3, .22)
                ),
                labelMat
            );

            label.position.set(
                mesh.position.x,
                mesh.position.y,
                mesh.position.z + box.w * .495 + .006
            );

            cargoGroup.add(label);

            // Pallet skids for larger packages.
            if (box.l > .65 && box.w > .55 && box.h > .35) {
                const palletMat = new THREE.MeshStandardMaterial({
                    color: 0x8c6845,
                    roughness: .92
                });

                for (const offset of [-.28, .28]) {
                    const skid = new THREE.Mesh(
                        new THREE.BoxGeometry(
                            box.l * .86,
                            .055,
                            Math.min(.09, box.w * .15)
                        ),
                        palletMat
                    );

                    skid.position.set(
                        mesh.position.x,
                        box.z + .15,
                        mesh.position.z + offset * box.w
                    );

                    skid.castShadow = true;
                    cargoGroup.add(skid);
                }
            }
        });

        cargoGroup.visible = cargoVisible;
    }

    // =========================================
    // CAMERA
    // =========================================

    function fitCameraToContainer(c) {
        if (!camera || !controls) return;

        const center = new THREE.Vector3(
            c.length / 2,
            c.height / 2,
            c.width / 2
        );

        const maxDim = Math.max(
            c.length,
            c.width,
            c.height
        );

        controls.target.copy(center);

        // Position camera near the open door (X = 0).
        // This gives a better view into the cargo.
        camera.position.set(
            -c.length * .55,
            c.height * 1.5 + maxDim * .2,
            c.width * 1.7 + maxDim * .35
        );

        camera.near = .1;
        camera.far = Math.max(150, maxDim * 20);

        // Allow zooming out for larger containers.
        controls.maxDistance = Math.max(35, maxDim * 3.5);

        camera.updateProjectionMatrix();
        controls.update();
    }

    function resizeRenderer() {
        if (!renderer || !camera) return;

        const host = $('container3D');

        const width = host.clientWidth;
        const height = host.clientHeight;

        if (!width || !height) return;

        renderer.setSize(width, height, false);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }


    // =========================================
    // REPORT GENERATION
    // =========================================

    function buildReportText(plan) {
        const lines = [
            'FREIGHT INTELLIGENCE CENTRE',
            'CONTAINER & CARGO PLANNER REPORT',
            '================================',

            `Container: ${plan.container.name}`,

            `Internal dimensions: ${plan.container.length.toFixed(2)} × ${plan.container.width.toFixed(2)} × ${plan.container.height.toFixed(2)} m`,

            `Maximum payload: ${plan.container.payload.toFixed(0)} kg`,
            '',

            `Cargo packages: ${plan.packages}`,
            `Packages placed: ${plan.loadedPackages}`,
            `Packages not placed: ${plan.unplaced.length}`,

            `Cargo CBM: ${plan.cargoTotals.cbm.toFixed(3)} m³`,
            `Placed volume: ${plan.loadedVolume.toFixed(3)} m³`,

            `Volume utilization: ${(plan.loadedVolume / plan.volumeCapacity * 100).toFixed(1)}%`,

            `Loaded gross weight: ${plan.loadedWeight.toFixed(2)} kg`,

            `Payload utilization: ${(plan.loadedWeight / plan.container.payload * 100).toFixed(1)}%`,

            '',
            'PACKAGE PLACEMENTS'
        ];

        plan.placed.forEach((b, i) => {
            lines.push(
                `${i + 1}. ${b.itemName} #${b.packageNumber} | Position ${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)} m | ${b.l.toFixed(2)} × ${b.w.toFixed(2)} × ${b.h.toFixed(2)} m | ${b.weight.toFixed(2)} kg`
            );
        });

        if (plan.unplaced.length) {
            lines.push('', 'NOT PLACED');

            plan.unplaced.forEach((b) => {
                lines.push(`${b.name} #${b.packageNumber} | ${b.reason}`);
            });
        }

        lines.push(
            '',
            'DISCLAIMER: Heuristic planning estimate only. Verify equipment specifications, cargo compatibility, floor loading, centre of gravity, lashing and all applicable operational requirements before loading.'
        );

        return lines.join('\n');
    }

    function downloadReport() {
        if (!latestPlan) return;

        const blob = new Blob(
            [buildReportText(latestPlan)],
            { type: 'text/plain;charset=utf-8' }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = 'container-cargo-loading-report.txt';

        document.body.appendChild(a);
        a.click();
        a.remove();

        // Delay revoking the URL so the browser can start the download.
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function printReport() {
        if (!latestPlan) return;

        const text = buildReportText(latestPlan);
        const win = window.open('', '_blank');

        if (!win) {
            showError(
                'Your browser blocked the print window. Allow pop-ups for this page and try again.'
            );
            return;
        }

        const escaped = text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');

        win.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>Container Loading Report</title>
        <style>
          body {
            font: 13px Arial, sans-serif;
            padding: 35px;
            color: #172338;
          }

          pre {
            white-space: pre-wrap;
            line-height: 1.6;
            font: 12px/1.65 monospace;
          }

          h1 {
            font-size: 20px;
          }
        </style>
      </head>
      <body>
        <h1>Container & Cargo Planner Report</h1>
        <pre>${escaped}</pre>
        <script>
          window.onload = () => window.print();
        <\/script>
      </body>
      </html>
    `);

        win.document.close();
    }

    // =========================================
    // EVENT LISTENERS
    // =========================================

    els.add.addEventListener('click', () => {
        addCargoRow();
        invalidatePlan();
        clearError();
    });

    els.rows.addEventListener('click', (event) => {
        const button = event.target.closest('.remove-cargo');

        if (!button) return;

        button.closest('tr').remove();

        if (!els.rows.children.length) {
            addCargoRow();
        }

        invalidatePlan();
        refreshCargoSummary();
        clearError();
    });

    els.rows.addEventListener('input', () => {
        refreshCargoSummary();
        invalidatePlan();
    });

    els.rows.addEventListener('change', () => {
        refreshCargoSummary();
        invalidatePlan();
    });

    els.clear.addEventListener('click', () => {
        els.rows.innerHTML = '';
        rowId = 0;

        addCargoRow();

        invalidatePlan();
        refreshCargoSummary();
        clearError();
    });

    document.querySelectorAll('.container-preset').forEach((button) => {
        button.addEventListener('click', () => {
            setPreset(button.dataset.container);
        });
    });

    [els.length, els.width, els.height, els.payload].forEach((input) => {
        input.addEventListener('input', () => {
            updateCapacityDisplay();

            // Update the 3D container when its dimensions change.
            const container = getContainer();

            if (
                scene &&
                [container.length, container.width, container.height]
                    .every((n) => Number.isFinite(n) && n > 0)
            ) {
                buildContainerScene(container);
            }

            invalidatePlan(
                'Container specifications changed. Run the optimizer again to refresh the loading plan.'
            );
        });
    });

    els.optimize.addEventListener('click', runOptimizer);

    els.download.addEventListener('click', downloadReport);
    els.print.addEventListener('click', printReport);

    els.resetView.addEventListener('click', () => {
        fitCameraToContainer(getContainer());
    });

    els.showContainer.addEventListener('click', () => {
        containerVisible = !containerVisible;

        if (containerGroup) {
            containerGroup.visible = containerVisible;
        }

        els.showContainer.classList.toggle(
            'active',
            containerVisible
        );
    });

    els.showCargo.addEventListener('click', () => {
        cargoVisible = !cargoVisible;

        if (cargoGroup) {
            cargoGroup.visible = cargoVisible;
        }

        els.showCargo.classList.toggle(
            'active',
            cargoVisible
        );
    });

    // =========================================
    // DEFAULT SAMPLE CARGO
    // =========================================

    addCargoRow({
        name: 'Cartons',
        length: 60,
        width: 40,
        height: 40,
        unit: 'cm',
        quantity: 10,
        weight: 15,
        stackable: true,
        rotate: true
    });

    addCargoRow({
        name: 'Machinery boxes',
        length: 100,
        width: 80,
        height: 70,
        unit: 'cm',
        quantity: 2,
        weight: 85,
        stackable: false,
        rotate: true
    });

    updateCapacityDisplay();

    // =========================================
    // START 3D VIEWER
    // =========================================

    try {
        initThree();
    } catch (error) {
        console.error('3D viewer initialization failed:', error);

        els.viewerLoading.innerHTML = `
            <strong>3D viewer could not start</strong>
            <small>
                Check WebGL support and your internet connection, then reload.
            </small>
        `;
    }

})();
