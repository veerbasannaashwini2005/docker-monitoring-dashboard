
const express = require("express");
const Docker = require("dockerode");
const path = require("path");

const app = express();

const PORT = 80;

const docker = new Docker({
    socketPath: "/var/run/docker.sock"
});


/* ================================================= */
/* CONFIGURATION                                     */
/* ================================================= */

const SELF_HEAL_INTERVAL = 10000;

const healingInProgress = new Set();

const healingHistory = [];

const MAX_HISTORY = 100;


/* ================================================= */
/* STATIC FRONTEND                                   */
/* ================================================= */

app.use(
    express.static(
        path.join(__dirname, "app")
    )
);


/* ================================================= */
/* ADD HEALING HISTORY                               */
/* ================================================= */

function addHealingHistory(
    name,
    action,
    status,
    message
) {

    const record = {

        timestamp:
            new Date().toISOString(),

        container:
            name,

        action:
            action,

        status:
            status,

        message:
            message
    };


    healingHistory.unshift(
        record
    );


    if (
        healingHistory.length >
        MAX_HISTORY
    ) {

        healingHistory.pop();
    }


    console.log(
        `[SELF-HEAL] ${name} | ${action} | ${status} | ${message}`
    );
}


/* ================================================= */
/* DOCKER STATS API                                  */
/* ================================================= */

app.get(
    "/api/stats",
    async (req, res) => {

        try {

            const containers =
                await docker.listContainers({
                    all: true
                });

            const results = [];


            for (
                const containerInfo
                of containers
            ) {

                try {

                    const container =
                        docker.getContainer(
                            containerInfo.Id
                        );

                    const info =
                        await container.inspect();


                    let cpuPercent = 0;

                    let memoryUsage = 0;

                    let memoryLimit = 0;


                    /* ================================= */
                    /* RESOURCE STATS                     */
                    /* ================================= */

                    if (
                        info.State &&
                        info.State.Running
                    ) {

                        try {

                            const stats =
                                await container.stats({
                                    stream: false
                                });


                            const cpuDelta =
                                stats.cpu_stats.cpu_usage.total_usage -
                                stats.precpu_stats.cpu_usage.total_usage;


                            const systemDelta =
                                stats.cpu_stats.system_cpu_usage -
                                stats.precpu_stats.system_cpu_usage;


                            if (
                                systemDelta > 0 &&
                                cpuDelta > 0
                            ) {

                                const onlineCPUs =
                                    stats.cpu_stats.online_cpus ||
                                    1;


                                cpuPercent =
                                    (
                                        cpuDelta /
                                        systemDelta
                                    ) *
                                    onlineCPUs *
                                    100;
                            }


                            memoryUsage =
                                stats.memory_stats.usage ||
                                0;


                            memoryLimit =
                                stats.memory_stats.limit ||
                                0;

                        } catch (statsError) {

                            console.log(
                                `Stats unavailable for ${info.Name}`
                            );
                        }
                    }


                    /* ================================= */
                    /* MEMORY PERCENT                    */
                    /* ================================= */

                    const memoryPercent =
                        memoryLimit > 0
                            ? (
                                memoryUsage /
                                memoryLimit
                            ) * 100
                            : 0;


                    /* ================================= */
                    /* HEALTH                             */
                    /* ================================= */

                    let healthStatus =
                        "none";


                    if (
                        info.State &&
                        info.State.Health
                    ) {

                        healthStatus =
                            info.State.Health.Status;
                    }


                    /* ================================= */
                    /* IMAGE                              */
                    /* ================================= */

                    const image =
                        info.Config &&
                        info.Config.Image
                            ? info.Config.Image
                            : "Unknown";


                    /* ================================= */
                    /* PORTS                              */
                    /* ================================= */

                    const ports = [];


                    if (
                        containerInfo.Ports &&
                        containerInfo.Ports.length > 0
                    ) {

                        containerInfo.Ports.forEach(
                            port => {

                                if (
                                    port.PublicPort &&
                                    port.PrivatePort
                                ) {

                                    ports.push(
                                        `${port.PublicPort}:${port.PrivatePort}`
                                    );

                                } else {

                                    ports.push(
                                        `${port.PrivatePort}`
                                    );
                                }

                            }
                        );
                    }


                    /* ================================= */
                    /* RESULT                             */
                    /* ================================= */

                    results.push({

                        id:
                            info.Id,

                        name:
                            info.Name
                                ? info.Name.replace(
                                    "/",
                                    ""
                                )
                                : "Unknown",

                        status:
                            info.State.Status,

                        health:
                            healthStatus,

                        restartCount:
                            info.RestartCount ||
                            0,

                        image:
                            image,

                        ports:
                            ports,

                        startedAt:
                            info.State.StartedAt,

                        finishedAt:
                            info.State.FinishedAt,

                        cpu:
                            cpuPercent.toFixed(2),

                        memoryBytes:
                            memoryUsage,

                        memoryMB:
                            (
                                memoryUsage /
                                1024 /
                                1024
                            ).toFixed(2),

                        memoryPercent:
                            memoryPercent.toFixed(2)

                    });


                } catch (containerError) {

                    console.error(
                        "Container inspection error:",
                        containerError.message
                    );
                }
            }


            res.json({

                count:
                    results.length,

                containers:
                    results

            });


        } catch (error) {

            console.error(
                "Docker API Error:",
                error.message
            );


            res.status(500).json({

                error:
                    "Unable to read Docker containers",

                message:
                    error.message

            });
        }
    }
);


/* ================================================= */
/* CONTAINER LOGS                                    */
/* ================================================= */

app.get(
    "/api/logs/:id",
    async (req, res) => {

        try {

            const container =
                docker.getContainer(
                    req.params.id
                );


            const logs =
                await container.logs({

                    stdout: true,

                    stderr: true,

                    tail: 100,

                    timestamps: true

                });


            res.json({

                logs:
                    logs.toString()

            });


        } catch (error) {

            res.status(500).json({

                error:
                    "Unable to read container logs",

                message:
                    error.message

            });
        }
    }
);


/* ================================================= */
/* CONTAINER HEALTH                                  */
/* ================================================= */

app.get(
    "/api/health/:id",
    async (req, res) => {

        try {

            const container =
                docker.getContainer(
                    req.params.id
                );


            const info =
                await container.inspect();


            let health =
                "none";


            if (
                info.State &&
                info.State.Health
            ) {

                health =
                    info.State.Health.Status;
            }


            res.json({

                id:
                    info.Id,

                name:
                    info.Name
                        ? info.Name.replace(
                            "/",
                            ""
                        )
                        : "Unknown",

                status:
                    info.State.Status,

                health:
                    health,

                restartCount:
                    info.RestartCount ||
                    0

            });


        } catch (error) {

            res.status(500).json({

                error:
                    "Unable to check container health",

                message:
                    error.message

            });
        }
    }
);


/* ================================================= */
/* SELF-HEALING HISTORY API                          */
/* ================================================= */

app.get(
    "/api/self-healing/history",
    (req, res) => {

        res.json({

            count:
                healingHistory.length,

            history:
                healingHistory

        });
    }
);


/* ================================================= */
/* MANUAL SELF-HEAL                                 */
/* ================================================= */

app.post(
    "/api/self-heal/:id",
    async (req, res) => {

        try {

            const container =
                docker.getContainer(
                    req.params.id
                );


            const info =
                await container.inspect();


            const name =
                info.Name
                    ? info.Name.replace(
                        "/",
                        ""
                    )
                    : "Unknown";


            if (
                name ===
                "monitoring-dashboard"
            ) {

                return res.json({

                    success:
                        false,

                    message:
                        "Monitoring dashboard is protected",

                    container:
                        name

                });
            }


            addHealingHistory(
                name,
                "MANUAL_RESTART",
                "STARTED",
                "Manual self-healing requested"
            );


            await container.restart();


            addHealingHistory(
                name,
                "MANUAL_RESTART",
                "SUCCESS",
                "Container restarted successfully"
            );


            res.json({

                success:
                    true,

                message:
                    `Container ${name} restarted successfully`,

                container:
                    name

            });


        } catch (error) {

            res.status(500).json({

                success:
                    false,

                error:
                    "Unable to restart container",

                message:
                    error.message

            });
        }
    }
);


/* ================================================= */
/* AUTOMATIC SELF-HEALING                            */
/* ================================================= */

async function automaticSelfHealing() {

    try {

        const containers =
            await docker.listContainers({
                all: true
            });


        for (
            const containerInfo
            of containers
        ) {

            try {

                const container =
                    docker.getContainer(
                        containerInfo.Id
                    );


                const info =
                    await container.inspect();


                const name =
                    info.Name
                        ? info.Name.replace(
                            "/",
                            ""
                        )
                        : "Unknown";


                /* ================================= */
                /* PROTECT DASHBOARD                 */
                /* ================================= */

                if (
                    name ===
                    "monitoring-dashboard"
                ) {

                    continue;
                }


                /* ================================= */
                /* DUPLICATE LOCK                   */
                /* ================================= */

                if (
                    healingInProgress.has(
                        info.Id
                    )
                ) {

                    continue;
                }


                const status =
                    info.State &&
                    info.State.Status
                        ? info.State.Status.toLowerCase()
                        : "";


                const health =
                    info.State &&
                    info.State.Health
                        ? info.State.Health.Status.toLowerCase()
                        : "none";


                const stopped =
                    status === "exited" ||
                    status === "dead";


                const unhealthy =
                    health === "unhealthy";


                if (
                    !stopped &&
                    !unhealthy
                ) {

                    continue;
                }


                /* ================================= */
                /* LOCK CONTAINER                    */
                /* ================================= */

                healingInProgress.add(
                    info.Id
                );


                /* ================================= */
                /* RECORD FAILURE                    */
                /* ================================= */

                addHealingHistory(
                    name,
                    "FAILURE_DETECTED",
                    "DETECTED",
                    unhealthy
                        ? "Container healthcheck failed"
                        : "Container stopped unexpectedly"
                );


                /* ================================= */
                /* RESTART ATTEMPT                    */
                /* ================================= */

                addHealingHistory(
                    name,
                    "AUTOMATIC_RESTART",
                    "STARTED",
                    "Automatic restart initiated"
                );


                try {

                    await container.restart();


                    /* ============================= */
                    /* WAIT FOR DOCKER STATE          */
                    /* ============================= */

                    await new Promise(
                        resolve =>
                            setTimeout(
                                resolve,
                                5000
                            )
                    );


                    const updatedInfo =
                        await container.inspect();


                    const updatedStatus =
                        updatedInfo.State.Status;


                    let updatedHealth =
                        "none";


                    if (
                        updatedInfo.State.Health
                    ) {

                        updatedHealth =
                            updatedInfo.State.Health.Status;
                    }


                    /* ============================= */
                    /* RECOVERY RESULT                */
                    /* ============================= */

                    if (
                        updatedStatus ===
                            "running" &&
                        updatedHealth !==
                            "unhealthy"
                    ) {

                        addHealingHistory(
                            name,
                            "RECOVERY",
                            "SUCCESS",
                            "Container recovered successfully"
                        );


                        console.log(
                            `✅ ${name} recovered successfully`
                        );

                    } else {

                        addHealingHistory(
                            name,
                            "RECOVERY",
                            "FAILED",
                            `Container status: ${updatedStatus}, health: ${updatedHealth}`
                        );


                        console.log(
                            `⚠️ ${name} still requires attention`
                        );
                    }


                } catch (healError) {

                    addHealingHistory(
                        name,
                        "AUTOMATIC_RESTART",
                        "FAILED",
                        healError.message
                    );


                    console.error(
                        `❌ Self-healing failed for ${name}:`,
                        healError.message
                    );
                }


                /* ================================= */
                /* RELEASE LOCK                     */
                /* ================================= */

                setTimeout(
                    () => {

                        healingInProgress.delete(
                            info.Id
                        );

                    },
                    15000
                );


            } catch (containerError) {

                console.error(
                    "Self-healing inspection error:",
                    containerError.message
                );
            }
        }


    } catch (error) {

        console.error(
            "Self-healing engine error:",
            error.message
        );
    }
}


/* ================================================= */
/* START BACKGROUND SELF-HEALING                    */
/* ================================================= */

setInterval(
    automaticSelfHealing,
    SELF_HEAL_INTERVAL
);


/* ================================================= */
/* ROOT HEALTH                                      */
/* ================================================= */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "UP",

            service:
                "Docker Monitoring Platform",

            selfHealing:
                "ACTIVE",

            historyRecords:
                healingHistory.length,

            timestamp:
                new Date().toISOString()

        });
    }
);


/* ================================================= */
/* START SERVER                                     */
/* ================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Monitoring dashboard running on port ${PORT}`
        );

        console.log(
            "🔧 Automatic self-healing engine ACTIVE"
        );

        console.log(
            "📋 Self-healing history ACTIVE"
        );

        console.log(
            `⏱️ Self-healing interval: ${SELF_HEAL_INTERVAL / 1000} seconds`
        );

    }
);