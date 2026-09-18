const cpuHistory = [];
const memoryHistory = [];
const maxPoints = 20;

function updateTime() {
    const now = new Date();

    document.getElementById("current-time").textContent =
        now.toLocaleTimeString();

    document.getElementById("last-updated").textContent =
        now.toLocaleTimeString();
}

function calculateUptime(startedAt) {
    const start = new Date(startedAt).getTime();
    const now = Date.now();

    const elapsedSeconds = Math.floor((now - start) / 1000);

    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
}

function drawChart() {
    const canvas = document.getElementById("monitoringChart");
    const ctx = canvas.getContext("2d");

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Chart area
    const left = 50;
    const right = 20;
    const top = 30;
    const bottom = 40;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    // Grid
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
        const y = top + (chartHeight / 5) * i;

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();

        ctx.fillStyle = "#555";
        ctx.font = "12px Arial";

        const value = 100 - i * 20;

        ctx.fillText(
            `${value}%`,
            8,
            y + 4
        );
    }

    function drawLine(data, color) {
        if (data.length < 1) {
            return;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();

        data.forEach((value, index) => {

            const x =
                left +
                (index / (maxPoints - 1)) * chartWidth;

            const y =
                top +
                chartHeight -
                (Math.min(value, 100) / 100) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    drawLine(cpuHistory, "#007bff");
    drawLine(memoryHistory, "#28a745");

    // Legend
    ctx.font = "14px Arial";

    ctx.fillStyle = "#007bff";
    ctx.fillRect(left, height - 25, 15, 15);

    ctx.fillStyle = "#222";
    ctx.fillText("CPU", left + 22, height - 12);

    ctx.fillStyle = "#28a745";
    ctx.fillRect(left + 80, height - 25, 15, 15);

    ctx.fillStyle = "#222";
    ctx.fillText("Memory", left + 102, height - 12);
}

async function loadStats() {

    try {

        const response = await fetch("/api/stats");

        if (!response.ok) {
            throw new Error("Failed to fetch Docker stats");
        }

        const data = await response.json();

        document.getElementById("container-name").textContent =
            data.name;

        document.getElementById("status").textContent =
            data.status.toUpperCase();

        document.getElementById("cpu").textContent =
            `${data.cpu}%`;

        document.getElementById("memory").textContent =
            `${data.memoryMB} MB`;

        document.getElementById("memory-percent").textContent =
            `${data.memoryPercent}%`;

        document.getElementById("uptime").textContent =
            calculateUptime(data.startedAt);

        cpuHistory.push(parseFloat(data.cpu));
        memoryHistory.push(parseFloat(data.memoryPercent));

        if (cpuHistory.length > maxPoints) {
            cpuHistory.shift();
        }

        if (memoryHistory.length > maxPoints) {
            memoryHistory.shift();
        }

        drawChart();

    } catch (error) {

        console.error(error);

        document.getElementById("status").textContent =
            "ERROR";
    }

    updateTime();
}

loadStats();

setInterval(loadStats, 2000);