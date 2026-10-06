
const cpuHistory = [];

const memoryHistory = [];

const maxPoints = 20;

let currentLogContainerId = null;

let currentLogContainerName = "";


/* ================================================= */
/* TIME                                              */
/* ================================================= */

function updateTime() {

    const now =
        new Date();

    document.getElementById(
        "current-time"
    ).textContent =
        now.toLocaleTimeString();
}


/* ================================================= */
/* UPTIME                                            */
/* ================================================= */

function calculateUptime(
    startedAt
) {

    if (!startedAt) {

        return "N/A";
    }


    const start =
        new Date(
            startedAt
        ).getTime();


    const elapsed =
        Math.max(
            0,
            Math.floor(
                (
                    Date.now() -
                    start
                ) / 1000
            )
        );


    const days =
        Math.floor(
            elapsed / 86400
        );


    const hours =
        Math.floor(
            (
                elapsed % 86400
            ) / 3600
        );


    const minutes =
        Math.floor(
            (
                elapsed % 3600
            ) / 60
        );


    if (days > 0) {

        return `${days}d ${hours}h ${minutes}m`;
    }


    return `${hours}h ${minutes}m`;
}


/* ================================================= */
/* CONNECTION                                        */
/* ================================================= */

function setConnectionStatus(
    connected
) {

    const dot =
        document.getElementById(
            "connection-dot"
        );


    const status =
        document.getElementById(
            "connection-status"
        );


    if (connected) {

        dot.className =
            "connected";

        status.textContent =
            "Docker Connected";

    } else {

        dot.className =
            "disconnected";

        status.textContent =
            "Docker Disconnected";
    }
}


/* ================================================= */
/* STATUS                                            */
/* ================================================= */

function getStatusClass(
    status
) {

    if (!status) {

        return "unknown";
    }


    const value =
        status.toLowerCase();


    if (
        value ===
        "running"
    ) {

        return "running";
    }


    if (
        value === "exited" ||
        value === "stopped" ||
        value === "dead"
    ) {

        return "stopped";
    }


    return "unknown";
}


/* ================================================= */
/* HEALTH                                            */
/* ================================================= */

function getHealthClass(
    health
) {

    if (!health) {

        return "health-none";
    }


    const value =
        health.toLowerCase();


    if (
        value ===
        "healthy"
    ) {

        return "health-healthy";
    }


    if (
        value ===
        "unhealthy"
    ) {

        return "health-unhealthy";
    }


    if (
        value ===
        "starting"
    ) {

        return "health-starting";
    }


    return "health-none";
}


/* ================================================= */
/* HEALTH TEXT                                       */
/* ================================================= */

function formatHealth(
    health
) {

    if (!health) {

        return "NONE";
    }


    const value =
        health.toLowerCase();


    if (
        value ===
        "healthy"
    ) {

        return "HEALTHY";
    }


    if (
        value ===
        "unhealthy"
    ) {

        return "UNHEALTHY";
    }


    if (
        value ===
        "starting"
    ) {

        return "STARTING";
    }


    return "NONE";
}


/* ================================================= */
/* CONTAINER RENDERING                               */
/* ================================================= */

function renderContainers(
    containers
) {

    const list =
        document.getElementById(
            "container-list"
        );


    if (
        !containers ||
        containers.length === 0
    ) {

        list.innerHTML = `

            <div class="loading">

                No Docker containers found.

            </div>

        `;

        return;
    }


    list.innerHTML = "";


    containers.forEach(
        container => {

            const statusClass =
                getStatusClass(
                    container.status
                );


            const healthClass =
                getHealthClass(
                    container.health
                );


            const healthText =
                formatHealth(
                    container.health
                );


            const cpu =
                parseFloat(
                    container.cpu
                ) || 0;


            const memoryPercent =
                parseFloat(
                    container.memoryPercent
                ) || 0;


            const memoryMB =
                container.memoryMB ||
                0;


            const restartCount =
                container.restartCount ||
                0;


            const image =
                container.image ||
                "Unknown";


            const ports =
                container.ports &&
                container.ports.length > 0

                    ? [
                        ...new Set(
                            container.ports
                        )
                    ].join(", ")

                    : "No ports";


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "container-card";


            card.innerHTML = `

                <div class="container-header">

                    <div>

                        <h3>
                            ${container.name || "Unknown"}
                        </h3>

                        <span
                            class="status-badge ${statusClass}"
                        >

                            ${container.status || "UNKNOWN"}

                        </span>

                    </div>


                    <span class="container-id">

                        ${
                            container.id
                                ? container.id.substring(
                                    0,
                                    12
                                )
                                : "N/A"
                        }

                    </span>

                </div>


                <div class="metric">

                    <div class="metric-title">

                        <span>
                            CPU Usage
                        </span>

                        <strong>
                            ${cpu.toFixed(2)}%
                        </strong>

                    </div>


                    <div class="progress">

                        <div
                            class="progress-bar cpu-bar"
                            style="
                                width:
                                ${Math.min(
                                    cpu,
                                    100
                                )}%
                            "
                        ></div>

                    </div>

                </div>


                <div class="metric">

                    <div class="metric-title">

                        <span>
                            Memory Usage
                        </span>

                        <strong>
                            ${memoryMB} MB
                        </strong>

                    </div>


                    <div class="progress">

                        <div
                            class="progress-bar memory-bar"
                            style="
                                width:
                                ${Math.min(
                                    memoryPercent,
                                    100
                                )}%
                            "
                        ></div>

                    </div>

                </div>


                <div class="container-details">

                    <div>

                        <span>
                            Health
                        </span>

                        <strong
                            class="health-badge ${healthClass}"
                        >

                            ${healthText}

                        </strong>

                    </div>


                    <div>

                        <span>
                            Restarts
                        </span>

                        <strong>
                            ${restartCount}
                        </strong>

                    </div>

                </div>


                <div class="image-info">

                    <span>
                        Image
                    </span>

                    <strong>
                        ${image}
                    </strong>

                </div>


                <div class="image-info">

                    <span>
                        Ports
                    </span>

                    <strong>
                        ${ports}
                    </strong>

                </div>


                <div class="container-footer">

                    <span>

                        Memory:
                        ${memoryPercent.toFixed(2)}%

                    </span>


                    <span>

                        Uptime:
                        ${calculateUptime(
                            container.startedAt
                        )}

                    </span>

                </div>


                <button
                    class="logs-button"
                    onclick="
                        viewLogs(
                            '${container.id}',
                            '${container.name}'
                        )
                    "
                >

                    📋 View Logs

                </button>

            `;


            list.appendChild(
                card
            );

        }
    );
}


/* ================================================= */
/* ALERT GENERATION                                  */
/* ================================================= */

function generateAlerts(
    containers
) {

    const alerts = [];


    containers.forEach(
        container => {

            const name =
                container.name ||
                "Unknown";


            const status =
                container.status
                    ? container.status.toLowerCase()
                    : "";


            const health =
                container.health
                    ? container.health.toLowerCase()
                    : "";


            const cpu =
                parseFloat(
                    container.cpu
                ) || 0;


            const memory =
                parseFloat(
                    container.memoryPercent
                ) || 0;


            if (
                status === "exited" ||
                status === "stopped" ||
                status === "dead"
            ) {

                alerts.push({

                    type:
                        "critical",

                    icon:
                        "🔴",

                    title:
                        `${name} is stopped`,

                    message:
                        "Container is not currently running."

                });
            }


            if (
                health ===
                "unhealthy"
            ) {

                alerts.push({

                    type:
                        "critical",

                    icon:
                        "🚨",

                    title:
                        `${name} is unhealthy`,

                    message:
                        "Docker healthcheck has failed."

                });
            }


            if (
                cpu >= 80
            ) {

                alerts.push({

                    type:
                        "warning",

                    icon:
                        "🟠",

                    title:
                        `${name} has high CPU usage`,

                    message:
                        `CPU usage is ${cpu.toFixed(2)}%.`

                });
            }


            if (
                memory >= 80
            ) {

                alerts.push({

                    type:
                        "warning",

                    icon:
                        "🟠",

                    title:
                        `${name} has high memory usage`,

                    message:
                        `Memory usage is ${memory.toFixed(2)}%.`

                });
            }

        }
    );


    return alerts;
}


/* ================================================= */
/* ALERT RENDERING                                   */
/* ================================================= */

function renderAlerts(
    containers
) {

    const alertsList =
        document.getElementById(
            "alerts-list"
        );


    const alertCount =
        document.getElementById(
            "alert-count"
        );


    if (
        !alertsList ||
        !alertCount
    ) {

        return;
    }


    const alerts =
        generateAlerts(
            containers
        );


    alertCount.textContent =
        `${alerts.length} ${
            alerts.length === 1
                ? "Alert"
                : "Alerts"
        }`;


    if (
        alerts.length === 0
    ) {

        alertCount.className =
            "alert-count no-alerts";


        alertsList.innerHTML = `

            <div class="no-alerts">

                ✅ No active alerts

            </div>

        `;

        return;
    }


    alertCount.className =
        "alert-count";


    alertsList.innerHTML = "";


    alerts.forEach(
        alert => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                `alert-item ${alert.type}`;


            item.innerHTML = `

                <div class="alert-icon">

                    ${alert.icon}

                </div>


                <div class="alert-content">

                    <div class="alert-title">

                        ${alert.title}

                    </div>


                    <div class="alert-message">

                        ${alert.message}

                    </div>

                </div>

            `;


            alertsList.appendChild(
                item
            );

        }
    );
}


/* ================================================= */
/* SELF-HEALING HISTORY                              */
/* ================================================= */

async function loadHealingHistory() {

    const container =
        document.getElementById(
            "healing-history"
        );


    if (!container) {

        return;
    }


    try {

        const response =
            await fetch(
                "/api/self-healing/history",
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load healing history"
            );
        }


        const data =
            await response.json();


        const history =
            Array.isArray(
                data.history
            )
                ? data.history
                : [];


        if (
            history.length === 0
        ) {

            container.innerHTML = `

                <div class="healing-empty">

                    ✅ No self-healing events recorded.

                </div>

            `;

            return;
        }


        container.innerHTML = "";


        history.forEach(
            record => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "healing-item";


                const date =
                    new Date(
                        record.timestamp
                    );


                const formattedTime =
                    date.toLocaleString();


                let icon =
                    "ℹ️";


                if (
                    record.status ===
                    "SUCCESS"
                ) {

                    icon =
                        "✅";

                } else if (
                    record.status ===
                    "FAILED"
                ) {

                    icon =
                        "❌";

                } else if (
                    record.status ===
                    "DETECTED"
                ) {

                    icon =
                        "🚨";

                } else if (
                    record.status ===
                    "STARTED"
                ) {

                    icon =
                        "🔧";
                }


                item.innerHTML = `

                    <div class="healing-icon">

                        ${icon}

                    </div>


                    <div class="healing-content">

                        <div class="healing-top">

                            <strong>
                                ${record.container}
                            </strong>

                            <span
                                class="
                                    healing-status
                                    ${record.status.toLowerCase()}
                                "
                            >

                                ${record.status}

                            </span>

                        </div>


                        <div class="healing-action">

                            ${record.action}

                        </div>


                        <div class="healing-message">

                            ${record.message}

                        </div>


                        <div class="healing-time">

                            ${formattedTime}

                        </div>

                    </div>

                `;


                container.appendChild(
                    item
                );

            }
        );


    } catch (error) {

        console.error(
            "Healing history error:",
            error
        );


        container.innerHTML = `

            <div class="healing-empty">

                ❌ Unable to load self-healing history.

            </div>

        `;
    }
}


/* ================================================= */
/* OVERVIEW                                          */
/* ================================================= */

function updateOverview(
    containers
) {

    const total =
        containers.length;


    const running =
        containers.filter(
            container =>
                container.status &&
                container.status.toLowerCase() ===
                "running"
        ).length;


    const stopped =
        total -
        running;


    document.getElementById(
        "total-containers"
    ).textContent =
        total;


    document.getElementById(
        "running-containers"
    ).textContent =
        running;


    document.getElementById(
        "stopped-containers"
    ).textContent =
        stopped;


    const system =
        document.getElementById(
            "system-status"
        );


    const unhealthy =
        containers.filter(
            container =>
                container.health &&
                container.health.toLowerCase() ===
                "unhealthy"
        ).length;


    if (
        unhealthy > 0
    ) {

        system.textContent =
            "CRITICAL";

        system.className =
            "system-critical";

        return;
    }


    if (
        running === total &&
        total > 0
    ) {

        system.textContent =
            "HEALTHY";

        system.className =
            "system-healthy";

    } else if (
        running > 0
    ) {

        system.textContent =
            "WARNING";

        system.className =
            "system-warning";

    } else {

        system.textContent =
            "DOWN";

        system.className =
            "system-critical";
    }
}


/* ================================================= */
/* CHART                                             */
/* ================================================= */

function drawChart() {

    const canvas =
        document.getElementById(
            "monitoringChart"
        );


    if (!canvas) {

        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    const width =
        canvas.clientWidth ||
        900;


    const height =
        350;


    canvas.width =
        width;


    canvas.height =
        height;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const left =
        50;


    const right =
        20;


    const top =
        30;


    const bottom =
        45;


    const chartWidth =
        width -
        left -
        right;


    const chartHeight =
        height -
        top -
        bottom;


    ctx.fillStyle =
        "#ffffff";


    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    ctx.strokeStyle =
        "#e5e7eb";


    ctx.lineWidth =
        1;


    for (
        let i = 0;
        i <= 5;
        i++
    ) {

        const y =
            top +
            (
                chartHeight /
                5
            ) *
            i;


        ctx.beginPath();


        ctx.moveTo(
            left,
            y
        );


        ctx.lineTo(
            width - right,
            y
        );


        ctx.stroke();


        ctx.fillStyle =
            "#64748b";


        ctx.font =
            "12px Arial";


        const value =
            100 -
            i * 20;


        ctx.fillText(
            `${value}%`,
            10,
            y + 4
        );
    }


    function drawLine(
        data,
        lineColor
    ) {

        if (
            data.length === 0
        ) {

            return;
        }


        ctx.strokeStyle =
            lineColor;


        ctx.lineWidth =
            3;


        ctx.beginPath();


        data.forEach(
            (
                value,
                index
            ) => {

                const x =
                    left +
                    (
                        index /
                        Math.max(
                            maxPoints - 1,
                            1
                        )
                    ) *
                    chartWidth;


                const y =
                    top +
                    chartHeight -
                    (
                        Math.min(
                            value,
                            100
                        ) /
                        100
                    ) *
                    chartHeight;


                if (
                    index === 0
                ) {

                    ctx.moveTo(
                        x,
                        y
                    );

                } else {

                    ctx.lineTo(
                        x,
                        y
                    );
                }

            }
        );


        ctx.stroke();
    }


    drawLine(
        cpuHistory,
        "#2563eb"
    );


    drawLine(
        memoryHistory,
        "#16a34a"
    );
}


/* ================================================= */
/* LOAD DOCKER STATS                                 */
/* ================================================= */

async function loadStats() {

    try {

        const response =
            await fetch(
                "/api/stats",
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Failed to fetch Docker stats"
            );
        }


        const data =
            await response.json();


        setConnectionStatus(
            true
        );


        const containers =
            Array.isArray(
                data.containers
            )
                ? data.containers
                : [];


        renderContainers(
            containers
        );


        renderAlerts(
            containers
        );


        updateOverview(
            containers
        );


        const cpuValues =
            containers.map(
                container =>
                    parseFloat(
                        container.cpu
                    ) || 0
            );


        const memoryValues =
            containers.map(
                container =>
                    parseFloat(
                        container.memoryPercent
                    ) || 0
            );


        const averageCPU =
            cpuValues.length
                ? cpuValues.reduce(
                    (a, b) =>
                        a + b,
                    0
                ) /
                cpuValues.length
                : 0;


        const averageMemory =
            memoryValues.length
                ? memoryValues.reduce(
                    (a, b) =>
                        a + b,
                    0
                ) /
                memoryValues.length
                : 0;


        cpuHistory.push(
            averageCPU
        );


        memoryHistory.push(
            averageMemory
        );


        if (
            cpuHistory.length >
            maxPoints
        ) {

            cpuHistory.shift();
        }


        if (
            memoryHistory.length >
            maxPoints
        ) {

            memoryHistory.shift();
        }


        drawChart();


        document.getElementById(
            "last-updated"
        ).textContent =
            "Last updated: " +
            new Date()
                .toLocaleTimeString();


    } catch (error) {

        console.error(
            "Monitoring error:",
            error
        );


        setConnectionStatus(
            false
        );


        document.getElementById(
            "system-status"
        ).textContent =
            "ERROR";
    }
}


/* ================================================= */
/* LOG VIEWER                                        */
/* ================================================= */

async function viewLogs(
    id,
    name
) {

    currentLogContainerId =
        id;


    currentLogContainerName =
        name;


    const modal =
        document.getElementById(
            "logs-modal"
        );


    const title =
        document.getElementById(
            "logs-title"
        );


    const content =
        document.getElementById(
            "logs-content"
        );


    title.textContent =
        `Docker Logs - ${name}`;


    content.textContent =
        "Loading logs...";


    modal.classList.add(
        "show"
    );


    await loadLogs();
}


/* ================================================= */
/* LOAD LOGS                                         */
/* ================================================= */

async function loadLogs() {

    if (
        !currentLogContainerId
    ) {

        return;
    }


    const content =
        document.getElementById(
            "logs-content"
        );


    content.textContent =
        "Loading logs...";


    try {

        const response =
            await fetch(
                `/api/logs/${currentLogContainerId}`,
                {
                    cache:
                        "no-store"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load logs"
            );
        }


        content.textContent =
            data.logs &&
            data.logs.trim()
                ? data.logs
                : "No logs available for this container.";


        content.scrollTop =
            content.scrollHeight;


    } catch (error) {

        content.textContent =
            `Unable to load logs.

Error:
${error.message}`;
    }
}


/* ================================================= */
/* CLOSE LOGS                                        */
/* ================================================= */

function closeLogs() {

    const modal =
        document.getElementById(
            "logs-modal"
        );


    modal.classList.remove(
        "show"
    );


    currentLogContainerId =
        null;


    currentLogContainerName =
        "";
}


/* ================================================= */
/* REFRESH LOGS                                      */
/* ================================================= */

async function refreshLogs() {

    await loadLogs();
}


/* ================================================= */
/* MODAL EVENTS                                      */
/* ================================================= */

document.addEventListener(
    "click",
    function(event) {

        const modal =
            document.getElementById(
                "logs-modal"
            );


        if (
            event.target ===
            modal
        ) {

            closeLogs();
        }
    }
);


document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Escape"
        ) {

            closeLogs();
        }
    }
);


/* ================================================= */
/* START                                             */
/* ================================================= */

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