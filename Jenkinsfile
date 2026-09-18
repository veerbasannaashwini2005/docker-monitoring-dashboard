pipeline {

    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out project code...'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t docker-monitoring-dashboard:latest .'
            }
        }

        stage('Stop Old Container') {
            steps {
                sh 'docker rm -f monitoring-dashboard || true'
            }
        }

        stage('Run New Container') {
            steps {
                sh 'docker run -d -p 8080:80 --name monitoring-dashboard -v /var/run/docker.sock:/var/run/docker.sock docker-monitoring-dashboard:latest'
            }
        }

        stage('Verify Deployment') {
            steps {
                sh 'docker ps'
            }
        }
    }

    post {

        success {
            echo 'Docker Monitoring Dashboard deployed successfully!'
        }

        failure {
            echo 'Deployment failed. Check the Jenkins console output.'
        }
    }
}