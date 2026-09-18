const express = require("express");
const Docker = require("dockerode");
const path = require("path");

const app = express();
const PORT = 80;

const docker = new Docker({
    socketPath: "/var/run/docker.sock"
});

app.use(express.static(path.join(__dirname, "app")));

app.get("/api/stats", async (req, res) => {
    try {
        const container = docker.getContainer("monitoring-dashboard");

        const info = await container.inspect();
        const stats = await container.stats({ stream: false });

        const cpuDelta =
            stats.cpu_stats.cpu_usage.total_usage -
            stats.precpu_stats.cpu_usage.total_usage;

        const systemDelta =
            stats.cpu_stats.system_cpu_usage -
            stats.precpu_stats.system_cpu_usage;

        let cpuPercent = 0;

        if (systemDelta > 0 && cpuDelta > 0) {
            const onlineCPUs = stats.cpu_stats.online_cpus || 1;

            cpuPercent =
                (cpuDelta / systemDelta) *
                onlineCPUs *
                100;
        }

        const memoryUsage = stats.memory_stats.usage || 0;
        const memoryLimit = stats.memory_stats.limit || 0;

        const memoryPercent =
            memoryLimit > 0
                ? (memoryUsage / memoryLimit) * 100
                : 0;

        res.json({
            name: info.Name.replace("/", ""),
            status: info.State.Status,
            startedAt: info.State.StartedAt,
            cpu: cpuPercent.toFixed(2),
            memoryBytes: memoryUsage,
            memoryMB: (memoryUsage / 1024 / 1024).toFixed(2),
            memoryPercent: memoryPercent.toFixed(2)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to read Docker container statistics",
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Monitoring dashboard running on port ${PORT}`);
});