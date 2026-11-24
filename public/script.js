"use strict";

const form = document.getElementById("point-form");
const xVal = document.getElementById("x-val");
const yVal = document.getElementById("y-val");
const rVal = document.getElementById("r-val");
const yButtons = document.querySelectorAll(".y-btn");
const errorBox = document.getElementById("error-box");
const submitBtn = document.getElementById("submit-btn");
const requestInfo = document.getElementById("request-info");
const resultBody = document.getElementById("result-body");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const yValues = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
let pointsHistory = [];

function clearErrors() {
    errorBox.hidden = true;
    errorBox.textContent = "";
    xVal.classList.remove("input-error");
    xVal.removeAttribute("aria-invalid");
}

function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
}

for (const button of yButtons) {
    button.addEventListener("click", function () {
        yVal.value = this.value;
        for (const item of yButtons) {
            const selected = item === this;
            item.classList.toggle("active", selected);
            item.setAttribute("aria-pressed", String(selected));
        }
        clearErrors();
    });
}

xVal.addEventListener("input", clearErrors);
rVal.addEventListener("change", function () {
    clearErrors();
    drawCanvas();
});

function isOutOfRange(value) {
    const negative = value.startsWith("-");
    const integerPart = value.replace(/^[+-]/, "").split(".")[0] || "0";
    return Number(integerPart) >= (negative ? 3 : 5);
}

function checkForm() {
    const xText = xVal.value.trim().replace(",", ".");
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(xText)) {
        throw new Error("Введите число в поле X");
    }
    if (isOutOfRange(xText)) {
        throw new Error("X должен быть больше −3 и меньше 5");
    }
    if (yVal.value === "" || !yValues.includes(Number(yVal.value))) {
        throw new Error("Выберите Y с помощью кнопки");
    }
    if (![1, 2, 3, 4, 5].includes(Number(rVal.value))) {
        throw new Error("Выберите R от 1 до 5");
    }
    return xText;
}

function formatDateTime(value) {
    return value.replace("T", " ").replace(/\.\d+/, "");
}

function addRowToTable(data) {
    const row = resultBody.insertRow();
    row.insertCell(0).textContent = data.x;
    row.insertCell(1).textContent = data.y;
    row.insertCell(2).textContent = data.r;

    const hitCell = row.insertCell(3);
    hitCell.textContent = data.hit ? "Попадание" : "Промах";
    hitCell.className = data.hit ? "result-hit" : "result-miss";

    row.insertCell(4).textContent = formatDateTime(data.currentTime);
    row.insertCell(5).textContent = Number(data.executionTimeMs).toFixed(3);
}

function updateTable() {
    resultBody.replaceChildren();
    if (pointsHistory.length === 0) {
        const cell = resultBody.insertRow().insertCell();
        cell.colSpan = 6;
        cell.textContent = "Проверок еще нет";
        return;
    }
    pointsHistory.forEach(addRowToTable);
}

async function sendRequest(parameters) {
    const response = await fetch(form.action + "?" + parameters.toString(), {
        method: "GET",
        cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Ошибка сервера");
    }
    pointsHistory = data.results;
    updateTable();
    drawCanvas();
    requestInfo.textContent = "Время сервера: " + formatDateTime(data.currentTime)
        + ". Запрос выполнен за " + Number(data.executionTimeMs).toFixed(3) + " мс.";
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearErrors();
    let x;
    try {
        x = checkForm();
    } catch (error) {
        showError(error.message);
        if (error.message.includes("X")) {
            xVal.classList.add("input-error");
            xVal.setAttribute("aria-invalid", "true");
            xVal.focus();
        }
        return;
    }
    submitBtn.disabled = true;
    requestInfo.textContent = "Проверка точки…";
    try {
        await sendRequest(new URLSearchParams({x: x, y: yVal.value, r: rVal.value}));
    } catch (error) {
        showError(error instanceof TypeError || error instanceof SyntaxError
            ? "Не удалось получить ответ: apache или java не запущены"
            : error.message);
        requestInfo.textContent = "Запрос не выполнен";
    } finally {
        submitBtn.disabled = false;
    }
});

function drawCanvas() {
    const center = 160;
    const scale = 105;
    const radius = Number(rVal.value);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#3296f5";
    context.beginPath();
    context.moveTo(center, center);
    context.lineTo(center, center - scale);
    context.lineTo(center + scale, center);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, scale, Math.PI / 2, Math.PI);
    context.closePath();
    context.fill();
    context.fillRect(center, center, scale / 2, scale);

    context.strokeStyle = "#202830";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(20, center);
    context.lineTo(302, center);
    context.lineTo(295, center - 4);
    context.moveTo(302, center);
    context.lineTo(295, center + 4);
    context.moveTo(center, 300);
    context.lineTo(center, 18);
    context.lineTo(center - 4, 25);
    context.moveTo(center, 18);
    context.lineTo(center + 4, 25);
    context.stroke();

    context.fillStyle = "#202830";
    context.font = "12px Arial";
    context.fillText("X", 301, center - 10);
    context.fillText("Y", center + 8, 19);
    context.fillText("0", center - 13, center + 16);
    const ticks = [-1, -0.5, 0.5, 1];
    const labels = ["−R", "−R/2", "R/2", "R"];
    for (let i = 0; i < ticks.length; i++) {
        const x = center + ticks[i] * scale;
        const y = center - ticks[i] * scale;
        context.beginPath();
        context.moveTo(x, center - 3);
        context.lineTo(x, center + 3);
        context.moveTo(center - 3, y);
        context.lineTo(center + 3, y);
        context.stroke();
        context.textAlign = "center";
        context.fillText(labels[i], x, center - 9);
        context.textAlign = "left";
        context.fillText(labels[i], center + 8, y + 4);
    }
    for (const point of pointsHistory.slice().reverse()) {
        if (point.r !== radius) continue;
        const x = center + point.x / radius * scale;
        const y = center - point.y / radius * scale;
        if (x < 5 || x > 315 || y < 5 || y > 315) continue;
        context.beginPath();
        context.arc(x, y, 4, 0, Math.PI * 2);
        context.fillStyle = point.hit ? "#176631" : "#c02920";
        context.fill();
        context.strokeStyle = "white";
        context.stroke();
    }
}

drawCanvas();
sendRequest(new URLSearchParams({action: "history"})).catch(function () {
    requestInfo.textContent = "История недоступна: запустите Apache и Java";
});
