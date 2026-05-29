const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

async function parseResponse(response) {
    const text = await response.text();

    try {
        return text ? JSON.parse(text) : {};
    } catch (error) {
        return {
            message: response.ok ? 'Saved successfully.' : 'Server returned an unexpected response.',
        };
    }
}

document.querySelectorAll('.table-search').forEach((input) => {
    input.addEventListener('input', () => {
        const table = document.querySelector(input.dataset.table);
        const query = input.value.trim().toLowerCase();

        table?.querySelectorAll('tbody tr').forEach((row) => {
            row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
    });
});

document.querySelectorAll('.print-btn').forEach((button) => {
    button.addEventListener('click', () => window.print());
});

document.querySelectorAll('[data-admin-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const message = form.querySelector('.process-message');
        message.textContent = '';
        message.classList.remove('is-error');

        try {
            let body = Object.fromEntries(new FormData(form).entries());

            if (form.dataset.materialsForm !== undefined) {
                body = {
                    id_proyecto: form.id_proyecto.value,
                    id_proveedor: form.id_proveedor.value,
                    materiales: [...form.querySelectorAll('.material-line')].map((line) => ({
                        id_material: line.querySelector('[name="id_material"]')?.value,
                        cantidad: line.querySelector('[name="cantidad"]')?.value,
                        precio_mom: line.querySelector('[name="precio_mom"]')?.value,
                    })),
                };
            }

            const response = await fetch(form.dataset.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await parseResponse(response);

            if (!response.ok) throw new Error(result.message || 'Could not save.');

            message.textContent = result.message || 'Saved successfully.';
            setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('is-error');
        }
    });
});

function syncMaterialLine(line) {
    const select = line.querySelector('[name="id_material"]');
    const typeInput = line.querySelector('[name="material_type"]');
    const priceInput = line.querySelector('[name="precio_mom"]');
    const option = select?.selectedOptions?.[0];

    if (!option) return;

    if (typeInput) typeInput.value = option.dataset.category || '';
    if (priceInput && !priceInput.value) priceInput.value = option.dataset.price || '';
}

document.querySelectorAll('[data-materials-form]').forEach((form) => {
    const lines = form.querySelector('.material-lines');
    const addButton = form.querySelector('.add-material-line');

    addButton?.addEventListener('click', () => {
        const firstLine = form.querySelector('.material-line');
        if (!firstLine || !lines) return;

        const clone = firstLine.cloneNode(true);
        clone.querySelectorAll('select, input').forEach((field) => {
            field.value = '';
            field.required = field.name !== 'material_type';
        });
        lines.appendChild(clone);
    });

    form.addEventListener('change', (event) => {
        if (!event.target.matches('[name="id_material"]')) return;
        const line = event.target.closest('.material-line');
        if (line) syncMaterialLine(line);
    });

    form.addEventListener('click', (event) => {
        const removeButton = event.target.closest('.line-remove');
        if (!removeButton) return;

        const currentLines = form.querySelectorAll('.material-line');
        if (currentLines.length === 1) return;

        removeButton.closest('.material-line')?.remove();
    });

    form.addEventListener('reset', () => {
        setTimeout(() => {
            form.querySelectorAll('[name="material_type"]').forEach((input) => {
                input.value = '';
            });
        }, 0);
    });
});

const inspectionForm = document.querySelector('[data-inspection-form]');

document.querySelectorAll('.row-edit').forEach((button) => {
    button.addEventListener('click', () => {
        const row = button.closest('tr');
        if (!inspectionForm || !row) return;

        inspectionForm.id_inspeccion.value = row.dataset.id || '';
        inspectionForm.condicion_general.value = row.dataset.condition || '';
        inspectionForm.costo_estimado.value = row.dataset.cost || '';
        inspectionForm.notas.value = row.dataset.notes || '';
        inspectionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
});

inspectionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = inspectionForm.querySelector('.process-message');
    const id = inspectionForm.id_inspeccion.value;
    message.textContent = '';
    message.classList.remove('is-error');

    if (!id) {
        message.textContent = 'Select an inspection from the list first.';
        message.classList.add('is-error');
        return;
    }

    try {
        const response = await fetch(`/api/admin/inspections/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(inspectionForm).entries())),
        });
        const result = await parseResponse(response);

        if (!response.ok) throw new Error(result.message || 'Could not update inspection.');

        message.textContent = result.message || 'Inspection updated successfully.';
        setTimeout(() => window.location.reload(), 800);
    } catch (error) {
        message.textContent = error.message;
        message.classList.add('is-error');
    }
});

function drawProjectChart(canvas, chartData, selectedYear) {
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight || 260;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const dataset = chartData.datasets.find((item) => String(item.year) === String(selectedYear));
    const values = dataset?.values || [];
    const max = Math.max(1, ...values);
    const padding = { top: 24, right: 18, bottom: 42, left: 38 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barGap = 8;
    const barWidth = Math.max(12, (chartWidth - barGap * 11) / 12);

    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillStyle = '#687184';

    if (!dataset) {
        ctx.textAlign = 'center';
        ctx.fillText('No project data available yet.', width / 2, height / 2);
        return;
    }

    ctx.strokeStyle = '#dde3ef';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    chartData.months.forEach((month, index) => {
        const value = values[index] || 0;
        const x = padding.left + index * (barWidth + barGap);
        const barHeight = (value / max) * chartHeight;
        const y = padding.top + chartHeight - barHeight;

        ctx.fillStyle = '#0a169f';
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#ff7a00';
        ctx.textAlign = 'center';
        ctx.fillText(String(value), x + barWidth / 2, Math.max(14, y - 7));

        ctx.fillStyle = '#687184';
        ctx.fillText(month, x + barWidth / 2, height - 17);
    });

    ctx.fillStyle = '#121524';
    ctx.textAlign = 'left';
    ctx.fillText(`Projects created in ${selectedYear}`, padding.left, 16);
}

document.querySelectorAll('#projects-month-chart').forEach((canvas) => {
    const select = document.querySelector('.chart-year-select');
    const chartData = JSON.parse(canvas.dataset.chart || '{"months":[],"years":[],"datasets":[]}');
    const years = chartData.years || [];

    if (select) {
        select.innerHTML = years.length
            ? years.map((year) => `<option value="${year}">${year}</option>`).join('')
            : '<option value="">No data</option>';
    }

    const render = () => drawProjectChart(canvas, chartData, select?.value || years[0]);
    select?.addEventListener('change', render);
    window.addEventListener('resize', render);
    render();
});
