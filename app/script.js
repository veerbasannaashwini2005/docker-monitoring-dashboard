
let containers = [];
let alerts = [];
let cpuChart = null;


// =====================================================
// LOAD CONTAINER STATS
// =====================================================

async function loadStats() {

    try {

        const response =
            await fetch("/api/stats", {
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error(
                "API returned " + response.status
            );
        }

        const data =
            await response.json();

        console.log("Docker API data:", data);

        if (!Array.isArray(data)) {
            throw new Error(
                "Invalid API response"
            );
        }

        containers = data;

        updateOverview();

        renderAlerts();

        renderContainers();

        updateChart();

        updateSystemStatus();

        updateLastUpdated();

    } catch (error) {

        console.error(
            "Failed to load Docker statistics:",
            error
        );

        containers = [];

        updateOverview();

        renderAlerts();

        renderContainers();

        updateSystemStatus(false);

    }

}


// =====================================================
// OVERVIEW
// =====================================================

function updateOverview() {

    const total =
        containers.length;

    const running =
        containers.filter(
            c => c.status === "running"
        ).length;

    const stopped =
        containers.filter(
            c => c.status !== "running"
        ).length;

    const totalElement =
        document.getElementById(
            "total-containers"
        );

    const runningElement =
        document.getElementById(
            "running-containers"
        );

    const stoppedElement =
        document.getElementById(
            "stopped-containers"
        );

    if (totalElement) {
        totalElement.textContent = total;
    }

    if (runningElement) {
        runningElement.textContent = running;
    }

    if (stoppedElement) {
        stoppedElement.textContent = stopped;
    }

}


// =====================================================
// SYSTEM STATUS
// =====================================================

function updateSystemStatus(apiWorking = true) {

    const statusElement =
        document.getElementById(
            "system-status"
        );

    if (!statusElement) {
        return;
    }

    if (!apiWorking) {

        statusElement.textContent =
            "DOWN";

        statusElement.className =
            "status-down";

        return;
    }

    const unhealthy =
        containers.filter(
            c => c.health === "unhealthy"
        ).length;

    const stopped =
        containers.filter(
            c => c.status !== "running"
        ).length;

    if (
        containers.length > 0 &&
        unhealthy === 0 &&
        stopped === 0
    ) {

        statusElement.textContent =
            "UP";

        statusElement.className =
            "status-up";

    } else if (containers.length > 0) {

        statusElement.textContent =
            "WARNING";

        statusElement.className =
            "status-warning";

    } else {

        statusElement.textContent =
            "DOWN";

        statusElement.className =
            "status-down";

    }

}


// =====================================================
// ALERTS
// =====================================================

function renderAlerts() {

    alerts = [];

    containers.forEach(container => {

        if (
            container.health ===
            "unhealthy"
        ) {

            alerts.push({

                type: "danger",

                title:
                    "Unhealthy Container",

                message:
                    `${container.name} is unhealthy`

            });

        }

        if (
            container.status !==
                "running"
        ) {

            alerts.push({

                type: "warning",

                title:
                    "Container Stopped",

                message:
                    `${container.name} is ${container.status}`

            });

        }

        if (
            container.memoryPercent >
            80
        ) {

            alerts.push({

                type: "warning",

                title:
                    "High Memory Usage",

                message:
                    `${container.name} is using ${container.memoryPercent}% memory`

            });

        }

        if (
            container.cpu >
            80
        ) {

            alerts.push({

                type: "warning",

                title:
                    "High CPU Usage",

                message:
                    `${container.name} is using ${container.cpu}% CPU`

            });

        }

    });


    const countElement =
        document.getElementById(
            "alert-count"
        );

    if (countElement) {

        countElement.textContent =
            alerts.length;

    }


    const container =
        document.getElementById(
            "alerts-container"
        );

    if (!container) {
        return;
    }


    if (alerts.length === 0) {

        container.innerHTML = `

            <div class="no-alerts">

                <div class="alert-icon">
                    ✅
                </div>

                <div>
                    No active alerts
                </div>

            </div>

        `;

        return;
    }


    container.innerHTML =
        alerts.map(alert => `

            <div class="alert ${alert.type}">

                <strong>
                    ${alert.title}
                </strong>

                <span>
                    ${alert.message}
                </span>

            </div>

        `).join("");

}


// =====================================================
// CONTAINER CARDS
// =====================================================

function renderContainers() {

    const container =
        document.getElementById(
            "container-list"
        );

    if (!container) {
        return;
    }


    if (containers.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <h3>
                    No Docker containers found.
                </h3>

                <p>
                    Docker API is currently unavailable.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        containers.map(c => {

            const statusClass =
                c.status === "running"
                    ? "running"
                    : "stopped";

            const healthClass =
                c.health === "unhealthy"
                    ? "unhealthy"
                    : "healthy";


            return `

                <div class="container-card">

                    <div class="container-header">

                        <div>

                            <h3>
                                🐳 ${escapeHtml(c.name)}
                            </h3>

                            <small>
                                ${escapeHtml(c.image)}
                            </small>

                        </div>

                        <span class="container-status ${statusClass}">
                            ${escapeHtml(c.status)}
                        </span>

                    </div>


                    <div class="container-details">

                        <div class="detail">

                            <span>
                                Health
                            </span>

                            <strong class="${healthClass}">
                                ${escapeHtml(c.health)}
                            </strong>

                        </div>


                        <div class="detail">

                            <span>
                                CPU
                            </span>

                            <strong>
                                ${c.cpu}%
                            </strong>

                        </div>


                        <div class="detail">

                            <span>
                                Memory
                            </span>

                            <strong>
                                ${c.memoryMB} MB
                            </strong>

                        </div>


                        <div class="detail">

                            <span>
                                Memory %
                            </span>

                            <strong>
                                ${c.memoryPercent}%
                            </strong>

                        </div>


                        <div class="detail">

                            <span>
                                Restarts
                            </span>

                            <strong>
                                ${c.restartCount}
                            </strong>

                        </div>

                    </div>


                    <div class="container-actions">

                        <button
                            onclick="viewLogs('${c.id}')"
                        >
                            📋 Logs
                        </button>

                        <button
                            onclick="manualHeal('${c.id}')"
                        >
                            🔧 Heal
                        </button>

                    </div>

                </div>

            `;

        }).join("");

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

    if (value === null ||
        value === undefined) {

        return "";

    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// =====================================================
// RESOURCE CHART
// =====================================================

function updateChart() {

    const canvas =
        document.getElementById(
            "resourceChart"
        );

    if (!canvas ||
        typeof Chart === "undefined") {

        return;

    }


    const labels =
        containers.map(
            c => c.name
        );

    const cpuData =
        containers.map(
            c => c.cpu
        );

    const memoryData =
        containers.map(
            c => c.memoryMB
        );


    if (cpuChart) {
        cpuChart.destroy();
    }


    cpuChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels: labels,

                datasets: [

                    {

                        label:
                            "CPU %",

                        data:
                            cpuData

                    },

                    {

                        label:
                            "Memory MB",

                        data:
                            memoryData

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                scales: {

                    y: {

                        beginAtZero: true

                    }

                }

            }

        });

}


// =====================================================
// SELF-HEALING HISTORY
// =====================================================

async function loadHealingHistory() {

    try {

        const response =
            await fetch(
                "/api/self-healing/history",
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                "History API error"
            );
        }

        const history =
            await response.json();

        renderHealingHistory(history);

    } catch (error) {

        console.error(
            "Healing history error:",
            error
        );

    }

}


// =====================================================
// RENDER HEALING HISTORY
// =====================================================

function renderHealingHistory(history) {

    const container =
        document.getElementById(
            "healing-history"
        );

    if (!container) {
        return;
    }


    if (
        !Array.isArray(history) ||
        history.length === 0
    ) {

        container.innerHTML = `

            <div class="healing-empty">

                🔄 No self-healing events recorded.

            </div>

        `;

        return;
    }


    container.innerHTML =
        history.slice(0, 20)
        .map(item => {

            let icon = "🔄";

            if (
                item.status ===
                "SUCCESS"
            ) {
                icon = "✅";
            }

            if (
                item.status ===
                "FAILED"
            ) {
                icon = "❌";
            }

            if (
                item.status ===
                "DETECTED"
            ) {
                icon = "⚠️";
            }


            return `

                <div class="healing-item">

                    <div class="healing-icon">
                        ${icon}
                    </div>

                    <div class="healing-content">

                        <div class="healing-top">

                            <strong>
                                ${escapeHtml(item.container)}
                            </strong>

                            <span class="healing-status ${String(item.status || "").toLowerCase()}">
                                ${escapeHtml(item.status)}
                            </span>

                        </div>

                        <div class="healing-action">
                            ${escapeHtml(item.action)}
                        </div>

                        <div class="healing-message">
                            ${escapeHtml(item.message)}
                        </div>

                        <div class="healing-time">
                            ${formatTime(item.timestamp)}
                        </div>

                    </div>

                </div>

            `;

        }).join("");

}


// =====================================================
// TIME FORMAT
// =====================================================

function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    try {

        return new Date(timestamp)
            .toLocaleString();

    } catch {

        return timestamp;

    }

}


// =====================================================
// LAST UPDATED
// =====================================================

function updateLastUpdated() {

    const element =
        document.getElementById(
            "last-updated"
        );

    if (element) {

        element.textContent =
            new Date().toLocaleTimeString();

    }

}


// =====================================================
// CURRENT TIME
// =====================================================

function updateTime() {

    const element =
        document.getElementById(
            "current-time"
        );

    if (element) {

        element.textContent =
            new Date().toLocaleTimeString();

    }

}


// =====================================================
// LOGS
// =====================================================

async function viewLogs(id) {

    try {

        const response =
            await fetch(
                `/api/logs/${id}`
            );

        const logs =
            await response.text();


        const modal =
            document.getElementById(
                "logs-modal"
            );

        const content =
            document.getElementById(
                "logs-content"
            );


        if (content) {

            content.textContent =
                logs;

        }


        if (modal) {

            modal.style.display =
                "flex";

        }

    } catch (error) {

        alert(
            "Unable to load logs: " +
            error.message
        );

    }

}


// =====================================================
// CLOSE LOG MODAL
// =====================================================

function closeLogs() {

    const modal =
        document.getElementById(
            "logs-modal"
        );

    if (modal) {

        modal.style.display =
            "none";

    }

}


// =====================================================
// MANUAL SELF HEAL
// =====================================================

async function manualHeal(id) {

    try {

        const response =
            await fetch(
                `/api/self-heal/${id}`,
                {
                    method: "POST"
                }
            );

        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Healing failed"
            );

        }


        alert(
            "✅ Container recovered successfully"
        );


        await loadStats();

        await loadHealingHistory();

    } catch (error) {

        alert(
            "❌ Self-healing failed: " +
            error.message
        );

    }

}


// =====================================================
// REFRESH HEALING BUTTON
// =====================================================

window.loadHealingHistory =
    loadHealingHistory;


// =====================================================
// INITIAL LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Dashboard frontend started"
        );

        loadStats();

        loadHealingHistory();

        updateTime();

        setInterval(
            loadStats,
            5000
        );

        setInterval(
            loadHealingHistory,
            5000
        );

        setInterval(
            updateTime,
            1000
        );

    }
);