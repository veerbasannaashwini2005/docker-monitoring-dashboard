
const express = require("express");
const Docker = require("dockerode");
const path = require("path");
const fs = require("fs");
const client = require("prom-client");

const app = express();

const PORT = 80;
const docker = new Docker({
    socketPath: "/var/run/docker.sock"
});

const SELF_HEAL_INTERVAL = 10000;

let healingInProgress = new Set();


// =====================================================
// PERSISTENT SELF-HEALING HISTORY
// =====================================================

const DATA_DIR = path.join(__dirname, "data");
const HISTORY_FILE = path.join(DATA_DIR, "healing-history.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "[]");
}

function loadHealingHistory() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading healing history:", error);
        return [];
    }
}

function saveHealingHistory() {
    try {
        fs.writeFileSync(
            HISTORY_FILE,
            JSON.stringify(healingHistory, null, 2)
        );
    } catch (error) {
        console.error("Error saving healing history:", error);
    }
}

let healingHistory = loadHealingHistory();

function addHealingHistory(record) {

    healingHistory.unshift(record);

    if (healingHistory.length > 100) {
        healingHistory = healingHistory.slice(0, 100);
    }

    saveHealingHistory();
}


// =====================================================
// PROMETHEUS CONFIGURATION
// =====================================================

const register = new client.Registry();

client.collectDefaultMetrics({
    register: register
});

const totalContainersMetric = new client.Gauge({
    name: "docker_containers_total",
    help: "Total number of Docker containers"
});

const runningContainersMetric = new client.Gauge({
    name: "docker_containers_running",
    help: "Number of running Docker containers"
});

const stoppedContainersMetric = new client.Gauge({
    name: "docker_containers_stopped",
    help: "Number of stopped Docker containers"
});

const unhealthyContainersMetric = new client.Gauge({
    name: "docker_containers_unhealthy",
    help: "Number of unhealthy Docker containers"
});

const containerCpuMetric = new client.Gauge({
    name: "docker_container_cpu_percent",
    help: "Docker container CPU usage percentage",
    labelNames: ["container"]
});

const containerMemoryMetric = new client.Gauge({
    name: "docker_container_memory_mb",
    help: "Docker container memory usage in MB",
    labelNames: ["container"]
});

const healingEventsMetric = new client.Counter({
    name: "docker_self_healing_events_total",
    help: "Total number of self-healing events"
});

const successfulHealingMetric = new client.Counter({
    name: "docker_self_healing_success_total",
    help: "Total number of successful self-healing events"
});

const failedHealingMetric = new client.Counter({
    name: "docker_self_healing_failed_total",
    help: "Total number of failed self-healing events"
});

register.registerMetric(totalContainersMetric);
register.registerMetric(runningContainersMetric);
register.registerMetric(stoppedContainersMetric);
register.registerMetric(unhealthyContainersMetric);
register.registerMetric(containerCpuMetric);
register.registerMetric(containerMemoryMetric);
register.registerMetric(healingEventsMetric);
register.registerMetric(successfulHealingMetric);
register.registerMetric(failedHealingMetric);


// =====================================================
// STATIC FRONTEND
// =====================================================

app.use(express.static(path.join(__dirname, "app")));


// =====================================================
// PROMETHEUS METRICS ENDPOINT
// =====================================================

app.get("/metrics", async (req, res) => {

    try {

        const output = await register.metrics();

        res.set("Content-Type", register.contentType);

        res.end(output);

    } catch (error) {

        console.error("Prometheus metrics error:", error);

        res.status(500).send("Metrics error");

    }

});


// =====================================================
// GET DOCKER CONTAINER STATS
// =====================================================

async function getContainerStats(container) {

    try {

        const info = await container.inspect();

        const stats = await container.stats({
            stream: false
        });

        let cpuPercent = 0;

        if (
            stats.cpu_stats &&
            stats.precpu_stats &&
            stats.cpu_stats.cpu_usage &&
            stats.precpu_stats.cpu_usage
        ) {

            const cpuDelta =
                stats.cpu_stats.cpu_usage.total_usage -
                stats.precpu_stats.cpu_usage.total_usage;

            const systemDelta =
                stats.cpu_stats.system_cpu_usage -
                stats.precpu_stats.system_cpu_usage;

            const onlineCPUs =
                stats.cpu_stats.online_cpus || 1;

            if (systemDelta > 0 && cpuDelta > 0) {

                cpuPercent =
                    (cpuDelta / systemDelta) *
                    onlineCPUs *
                    100;

            }

        }

        const memoryUsage =
            stats.memory_stats?.usage || 0;

        const memoryLimit =
            stats.memory_stats?.limit || 0;

        const memoryPercent =
            memoryLimit > 0
                ? (memoryUsage / memoryLimit) * 100
                : 0;

        let health = "none";

        if (info.State && info.State.Health) {
            health = info.State.Health.Status;
        }

        return {

            id: info.Id.substring(0, 12),

            name:
                info.Name
                    ? info.Name.replace("/", "")
                    : "unknown",

            status: info.State?.Status || "unknown",

            health: health,

            restartCount:
                info.RestartCount || 0,

            image:
                info.Config?.Image || "unknown",

            ports:
                info.HostConfig?.PortBindings || {},

            startedAt:
                info.State?.StartedAt || "",

            finishedAt:
                info.State?.FinishedAt || "",

            cpu:
                Number(cpuPercent.toFixed(2)),

            memoryBytes:
                memoryUsage,

            memoryMB:
                Number((memoryUsage / 1024 / 1024).toFixed(2)),

            memoryPercent:
                Number(memoryPercent.toFixed(2))

        };

    } catch (error) {

        console.error(
            "Error getting container stats:",
            error.message
        );

        return null;

    }

}


// =====================================================
// API: CONTAINER STATS
// =====================================================

app.get("/api/stats", async (req, res) => {

    try {

        const containers =
            await docker.listContainers({
                all: true
            });

        const results = [];

        for (const item of containers) {

            const container =
                docker.getContainer(item.Id);

            const stats =
                await getContainerStats(container);

            if (stats) {
                results.push(stats);
            }

        }

        // Update Prometheus metrics

        totalContainersMetric.set(results.length);

        const running =
            results.filter(
                c => c.status === "running"
            ).length;

        const stopped =
            results.filter(
                c => c.status !== "running"
            ).length;

        const unhealthy =
            results.filter(
                c => c.health === "unhealthy"
            ).length;

        runningContainersMetric.set(running);

        stoppedContainersMetric.set(stopped);

        unhealthyContainersMetric.set(unhealthy);


        // Update per-container metrics

        for (const container of results) {

            containerCpuMetric
                .labels(container.name)
                .set(container.cpu);

            containerMemoryMetric
                .labels(container.name)
                .set(container.memoryMB);

        }

        res.json(results);

    } catch (error) {

        console.error(
            "Stats API error:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

});


// =====================================================
// API: CONTAINER LOGS
// =====================================================

app.get("/api/logs/:id", async (req, res) => {

    try {

        const container =
            docker.getContainer(req.params.id);

        const logs =
            await container.logs({

                stdout: true,

                stderr: true,

                tail: 200,

                timestamps: true

            });

        res.send(logs.toString());

    } catch (error) {

        res.status(500).send(
            "Unable to fetch logs: " +
            error.message
        );

    }

});


// =====================================================
// API: CONTAINER HEALTH
// =====================================================

app.get("/api/health/:id", async (req, res) => {

    try {

        const container =
            docker.getContainer(req.params.id);

        const info =
            await container.inspect();

        res.json({

            name:
                info.Name
                    ? info.Name.replace("/", "")
                    : "unknown",

            status:
                info.State?.Status,

            health:
                info.State?.Health?.Status || "none",

            restartCount:
                info.RestartCount || 0

        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});


// =====================================================
// API: SELF-HEALING HISTORY
// =====================================================

app.get(
    "/api/self-healing/history",
    (req, res) => {

        res.json(
            healingHistory
        );

    }
);


// =====================================================
// MANUAL SELF-HEAL
// =====================================================

app.post("/api/self-heal/:id", async (req, res) => {

    const id = req.params.id;

    try {

        const container =
            docker.getContainer(id);

        const info =
            await container.inspect();

        const containerName =
            info.Name
                ? info.Name.replace("/", "")
                : id;

        addHealingHistory({

            container: containerName,

            containerId: id.substring(0, 12),

            action: "MANUAL_RESTART",

            status: "STARTED",

            message:
                "Manual recovery started",

            timestamp:
                new Date().toISOString()

        });

        healingEventsMetric.inc();

        await container.restart();

        await new Promise(
            resolve => setTimeout(resolve, 3000)
        );

        addHealingHistory({

            container: containerName,

            containerId: id.substring(0, 12),

            action: "MANUAL_RESTART",

            status: "SUCCESS",

            message:
                "Container manually restarted successfully",

            timestamp:
                new Date().toISOString()

        });

        successfulHealingMetric.inc();

        res.json({

            success: true,

            message:
                "Container restarted successfully"

        });

    } catch (error) {

        failedHealingMetric.inc();

        addHealingHistory({

            container: id.substring(0, 12),

            containerId: id.substring(0, 12),

            action: "MANUAL_RESTART",

            status: "FAILED",

            message: error.message,

            timestamp:
                new Date().toISOString()

        });

        res.status(500).json({

            success: false,

            error: error.message

        });

    }

});


// =====================================================
// AUTOMATIC SELF-HEALING
// =====================================================

async function automaticSelfHealing() {

    try {

        const containers =
            await docker.listContainers({
                all: true
            });

        for (const item of containers) {

            const container =
                docker.getContainer(item.Id);

            if (
                healingInProgress.has(item.Id)
            ) {
                continue;
            }

            try {

                const info =
                    await container.inspect();

                const status =
                    info.State?.Status;

                const health =
                    info.State?.Health?.Status;

                const isUnhealthy =
                    health === "unhealthy";

                if (!isUnhealthy) {
                    continue;
                }

                healingInProgress.add(item.Id);

                const containerName =
                    info.Name
                        ? info.Name.replace("/", "")
                        : item.Id.substring(0, 12);


                // DETECTED

                addHealingHistory({

                    container: containerName,

                    containerId:
                        item.Id.substring(0, 12),

                    action:
                        "AUTOMATIC_RECOVERY",

                    status:
                        "DETECTED",

                    message:
                        "Unhealthy container detected",

                    timestamp:
                        new Date().toISOString()

                });


                // STARTED

                addHealingHistory({

                    container: containerName,

                    containerId:
                        item.Id.substring(0, 12),

                    action:
                        "AUTOMATIC_RECOVERY",

                    status:
                        "STARTED",

                    message:
                        "Automatic container restart started",

                    timestamp:
                        new Date().toISOString()

                });

                healingEventsMetric.inc();


                // RESTART

                await container.restart();


                // WAIT

                await new Promise(
                    resolve =>
                        setTimeout(resolve, 5000)
                );


                // CHECK RESULT

                const updatedInfo =
                    await container.inspect();

                const updatedStatus =
                    updatedInfo.State?.Status;

                const updatedHealth =
                    updatedInfo.State?.Health?.Status;


                if (
                    updatedStatus === "running" &&
                    updatedHealth !== "unhealthy"
                ) {

                    addHealingHistory({

                        container: containerName,

                        containerId:
                            item.Id.substring(0, 12),

                        action:
                            "AUTOMATIC_RECOVERY",

                        status:
                            "SUCCESS",

                        message:
                            "Container recovered successfully",

                        timestamp:
                            new Date().toISOString()

                    });

                    successfulHealingMetric.inc();

                } else {

                    addHealingHistory({

                        container: containerName,

                        containerId:
                            item.Id.substring(0, 12),

                        action:
                            "AUTOMATIC_RECOVERY",

                        status:
                            "FAILED",

                        message:
                            "Container restart completed but health is still not normal",

                        timestamp:
                            new Date().toISOString()

                    });

                    failedHealingMetric.inc();

                }

            } catch (error) {

                console.error(
                    "Self-healing error:",
                    error.message
                );

                failedHealingMetric.inc();

                addHealingHistory({

                    container:
                        item.Names?.[0]
                            ?.replace("/", "") ||
                        item.Id.substring(0, 12),

                    containerId:
                        item.Id.substring(0, 12),

                    action:
                        "AUTOMATIC_RECOVERY",

                    status:
                        "FAILED",

                    message:
                        error.message,

                    timestamp:
                        new Date().toISOString()

                });

            } finally {

                healingInProgress.delete(
                    item.Id
                );

            }

        }

    } catch (error) {

        console.error(
            "Automatic self-healing engine error:",
            error.message
        );

    }

}


// =====================================================
// HEALTH ENDPOINT
// =====================================================

app.get("/health", (req, res) => {

    res.json({

        status: "UP",

        service:
            "Docker Monitoring Dashboard",

        timestamp:
            new Date().toISOString()

    });

});


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
        `Docker Monitoring Dashboard running on port ${PORT}`
    );

    console.log(
        "Prometheus metrics available at /metrics"
    );

    console.log(
        "Automatic self-healing engine started"
    );

    setInterval(
        automaticSelfHealing,
        SELF_HEAL_INTERVAL
    );

});