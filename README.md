\# Dockerized Monitoring Dashboard



A beginner-friendly DevOps project that monitors a Docker container using a web dashboard and automates deployment using Jenkins.



\## Project Overview



This project provides a web-based dashboard that displays real-time information about a Docker container.



The dashboard shows:



\- Container status

\- CPU usage

\- Memory usage

\- Memory percentage

\- Container name

\- Container uptime

\- Current time

\- Resource usage chart



Jenkins is used to automate the Docker build and deployment process.



\## Architecture



```text

Developer

&#x20;   |

&#x20;   | git push

&#x20;   v

GitHub Repository

&#x20;   |

&#x20;   | Jenkins Poll SCM

&#x20;   v

Jenkins

&#x20;   |

&#x20;   | Docker Build

&#x20;   v

Docker Image

&#x20;   |

&#x20;   | Run Container

&#x20;   v

Docker Monitoring Dashboard

&#x20;   |

&#x20;   +---- CPU Usage

&#x20;   +---- Memory Usage

&#x20;   +---- Container Status

&#x20;   +---- Uptime

&#x20;   +---- Resource Chart

Technologies Used

HTML

CSS

JavaScript

Node.js

Express.js

Docker

Docker Engine

Jenkins

Git

GitHub



Project Structure

docker-monitoring-dashboard/

|

├── app/

│   ├── index.html

│   ├── script.js

│   └── style.css

|

├── jenkins/

│   └── Dockerfile

|

├── Dockerfile

├── Jenkinsfile

├── package.json

├── server.js

└── README.md

How It Works



The Node.js application uses Express.js to serve the dashboard.



The application accesses Docker container statistics through the Docker Engine socket and provides them through:



/api/stats



The frontend requests the statistics periodically and updates the dashboard.



Run the Project Manually



Build the Docker image:



docker build -t docker-monitoring-dashboard .



Run the container:



docker run -d -p 8080:80 \\

&#x20; --name monitoring-dashboard \\

&#x20; -v /var/run/docker.sock:/var/run/docker.sock \\

&#x20; docker-monitoring-dashboard:latest



Open:



http://localhost:8080

Jenkins CI/CD



Jenkins automates the deployment using the Jenkinsfile.



Pipeline stages:



Checkout

&#x20;  |

Build Docker Image

&#x20;  |

Stop Old Container

&#x20;  |

Run New Container

&#x20;  |

Verify Deployment



Jenkins is running locally on:



http://localhost:8082



The monitoring dashboard runs on:



http://localhost:8080

API



The monitoring API is available at:



http://localhost:8080/api/stats



Example response:



{

&#x20; "name": "monitoring-dashboard",

&#x20; "status": "running",

&#x20; "cpu": "0.00",

&#x20; "memoryMB": "28.49",

&#x20; "memoryPercent": "0.37"

}

CI/CD Workflow

Code Change

&#x20;   |

&#x20;   v

Git Commit

&#x20;   |

&#x20;   v

GitHub

&#x20;   |

&#x20;   v

Jenkins

&#x20;   |

&#x20;   v

Docker Build

&#x20;   |

&#x20;   v

New Container

&#x20;   |

&#x20;   v

Updated Dashboard

Learning Outcomes



Through this project, I learned:



Docker containerization

Docker image creation

Docker container management

Docker Engine API usage

Monitoring container resources

Jenkins pipelines

CI/CD automation

Git and GitHub

Automated Docker deployment

Future Improvements



Possible improvements include:



Multiple-container monitoring

CPU and memory alerts

Historical metrics storage

User authentication

Container start/stop controls

Email notifications

Cloud deployment

Prometheus and Grafana integration

Author



Veerbasanna Ashwini

