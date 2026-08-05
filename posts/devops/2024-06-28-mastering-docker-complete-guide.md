---
title: Mastering Docker: A Complete Guide to Containers, Networking, Storage, Registry and Security
date: 2024-06-28
slug: mastering-docker-complete-guide
tags: [Docker, DevOps, Containers]
category: Technology
excerpt: A comprehensive walkthrough of Docker covering containers, images, networking, storage, registries, security, orchestration, and the operational practices teams need in production.
readTime: 16 min read
published: true
---
# Mastering Docker: A Complete Guide to Containers, Networking, Storage, Registry and Security

Docker has become the standard tool for application containerization, revolutionizing DevOps, CI/CD, and cloud deployment practices. This in-depth guide covers the entire Docker ecosystem, from foundational concepts to advanced production techniques, so you can build, ship, and run applications reliably at scale.

The guide is organized around a few broad objectives that are worth keeping in mind as you read:

- Master Docker's architecture and internal mechanisms
- Optimize images and container performance
- Implement production-grade networking and storage strategies
- Secure Docker infrastructure according to industry standards
- Automate deployment with Docker Compose and orchestration

![Mastering Docker: A Complete Guide to Containers, Networking, Storage, Registry and Security](https://upload.wikimedia.org/wikipedia/commons/7/79/Docker_%28container_engine%29_logo.png)

## Table of Contents

- [Introduction](#introduction)
- [Container Fundamentals](#container-fundamentals)
- [Advanced Images and Dockerfile](#advanced-images-and-dockerfile)
- [Advanced Docker Networking](#advanced-docker-networking)
- [Docker Storage Management](#docker-storage-management)
- [Docker Registry and Private Infrastructure](#docker-registry-and-private-infrastructure)
- [Docker Compose Multi-Container Orchestration](#docker-compose-multi-container-orchestration)
- [Docker Security](#docker-security)
- [Monitoring and Logging](#monitoring-and-logging)
- [Performance and Optimization](#performance-and-optimization)
- [CI/CD with Docker](#cicd-with-docker)
- [Docker Swarm Native Orchestration](#docker-swarm-native-orchestration)
- [Troubleshooting and Debugging](#troubleshooting-and-debugging)
- [Migration to Docker](#migration-to-docker)
- [A Real-World Example: A Full 3-Tier Stack](#a-real-world-example-a-full-3-tier-stack)
- [Key Takeaways](#key-takeaways)
- [Frequently Asked Questions](#frequently-asked-questions)

## Introduction

Containers are not a new idea, but Docker made them practical, approachable, and ubiquitous. At the most basic level, a container is a lightweight execution unit that encapsulates an application and its dependencies in an isolated environment. The key distinction from older virtualization approaches, which we will explore next, is that containers do not virtualize hardware. Instead, they share the host operating system kernel, which is the reason containers deliver dramatically better performance and a much smaller memory footprint.

This document distills the content of an advanced Docker reference covering image architecture, networking drivers, storage and backup, private registries, multi-container orchestration with Compose, security hardening, monitoring, CI/CD pipelines, and native orchestration with Docker Swarm.

## Container Fundamentals

### Container Concept

Think of a container as a standardized shipping crate for your software. Inside the crate sits your application code plus everything it needs to run -- libraries, runtime, configuration, and system tools. Because the crate bundles its own dependencies, it behaves identically regardless of which host it lands on. That consistency is where Docker's portability and deployment consistency come from.

### Containers vs Virtual Machines

A common mental model is to contrast containers with virtual machines (VMs). The differences are striking and shape nearly every architectural decision you make afterward.

| Trait | Containers | Virtual Machines |
|-------|-----------|------------------|
| Kernel | Share the host kernel | Have their own kernel |
| Startup time | Start in seconds | Start in minutes |
| Size | Lightweight (MB) | Heavy (GB) |
| Isolation | Process-level isolation | Full isolation |
| Resource usage | Lower | Higher |

> **Caution:** A full kernel and runtime isolation are the source of both the container's speed and its security constraint. Because containers share the host kernel, a single compromised host kernel is a shared risk, so isolation hardening (covered in the security section) is non-negotiable.

### Docker Engine and Daemon

The Docker Engine is the core of the containerization system and includes several critical components:

- `dockerd` (daemon): the main service managing container lifecycle, images, volumes, and networks
- `containerd`: the high-level runtime managing container execution
- `runc`: the low-level OCI-compliant runtime
- Docker CLI: the command-line interface used to interact with the daemon
- Docker REST API: enables automation and programmatic integration

You will interact with the daemon constantly, so it pays to know the essential system administration commands:

```bash
# Check daemon status
sudo systemctl status docker

# Start/Stop daemon
sudo systemctl start docker
sudo systemctl stop docker

# Enable at boot
sudo systemctl enable docker

# View daemon logs
sudo journalctl -u docker -f

# System information
docker info
docker version
```

### Namespaces and Cgroups

Under the hood, Docker leverages two fundamental Linux kernel features to create and police isolation.

#### Namespaces

Namespaces provide resource isolation by giving each container its own view of a given resource:

- **PID**: process isolation
- **NET**: isolated network stack
- **MNT**: isolated filesystem
- **UTS**: isolated hostname and domain
- **IPC**: isolated inter-process communication
- **USER**: user mapping

#### Control Groups (cgroups)

Cgroups limit and monitor resource usage so that no single container can monopolize the host.

```bash
# Limit memory
docker run -m 512m nginx

# Limit CPU
docker run --cpus="1.5" nginx

# Limit disk I/O
docker run --device-write-bps /dev/sda:1mb nginx
```

The relationship between these building blocks can be visualized as follows:

```mermaid
flowchart LR
    subgraph Host[Linux Host]
        subgraph Kernel[Host Kernel]
            NS[Namespaces]
            CG[cgroups]
        end
        subgraph Engine[Docker Engine]
            CLI[Docker CLI]
            API[REST API]
            DD[dockerd]
            CD[containerd]
            RC[runc]
        end
    end
    CLI --> API
    API --> DD
    DD --> CD
    CD --> RC
    RC --> NS
    RC --> CG
    NS --> C1[Container 1]
    NS --> C2[Container 2]
    CG --> C1
    CG --> C2
```

## Advanced Images and Dockerfile

### Image Architecture

Docker images follow a layered architecture based on UnionFS. Each Dockerfile instruction creates a new immutable layer. This is important for two reasons: layers enable caching (unchanged lower layers are reused across builds), and they let containers share common base layers on disk, which saves space.

### Optimized Dockerfile - Complete Example

A well-constructed Dockerfile uses multi-stage builds to separate compilation from execution, shrinks the final image, and runs as a non-root user. Here is an optimized Python example:

```dockerfile
# Stage 1: Builder
FROM python:3.11-slim AS builder

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /build/wheels \
    -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy wheels from builder stage
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache /wheels/*

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Expose port
EXPOSE 8000

# Entry point
ENTRYPOINT ["python"]
CMD ["app.py"]
```

### Dockerfile Best Practices - Complete Guide

Following best practices keeps images lean, secure, and quick to build:

1. **Multi-stage builds**: Separate compilation from execution to reduce size
2. **Minimal base images**: Prefer `alpine`, `distroless`, or `scratch`
3. **Layer order**: Place least-changing instructions first to maximize caching
4. **Combine RUN commands**: Reduce layer count
5. **.dockerignore**: Exclude unnecessary files from the build context
6. **Non-root user**: Never run as root
7. **Labels and metadata**: Document images with labels
8. **Security scanning**: Integrate scanning into your CI/CD pipeline

A `.dockerignore` file keeps the build context small and clean:

```text
# Git files
.git
.gitignore
# Virtual environments
venv/
env/
*.pyc
__pycache__/
# Documentation
*.md
docs/
# Tests
tests/
*.test
# Local config files
.env
.env.local
docker-compose*.yml
```

### Advanced Image Management

Beyond `docker build`, a mature image workflow includes custom caching, multi-platform builds, and lifecycle cleanup:

```bash
# Build with custom cache
docker build --cache-from myapp:latest -t myapp:v2.0 .

# Multi-platform build (ARM + AMD64)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t myapp:multiarch --push .

# Inspect an image
docker image inspect nginx:latest
docker history nginx:latest

# Clean unused images
docker image prune -a --filter "until=168h"

# Export/Import images
docker save -o myapp.tar myapp:latest
docker load -i myapp.tar
```

## Advanced Docker Networking

Networking is what turns isolated containers into a coordinated system. Docker provides several network types, each with a specific job.

### Docker Network Types

- **Bridge**: the default private network for containers on the same host; containers communicate over an isolated network
- **Host**: the container shares the host's network stack; no network isolation but improved performance
- **Overlay**: enables communication between containers across different hosts in a Docker Swarm cluster; ideal for distributed services
- **Macvlan**: assigns a unique MAC address to each container, making it appear as a physical device on the local network
- **None**: no network; the container sits in isolation with no external network access

| Driver | Usage | Scope |
|--------|-------|-------|
| bridge | Default private network | local |
| host | Shares host network stack | local |
| overlay | Multi-host communication (Swarm) | swarm |
| macvlan | MAC address assignment | local |
| none | No network | local |

### Advanced Network Configuration

Custom networks give you precise control over subnets, gateways, and topology:

```bash
# Create custom bridge network
docker network create --driver bridge \
  --subnet=172.20.0.0/16 \
  --ip-range=172.20.240.0/20 \
  --gateway=172.20.0.1 \
  --opt "com.docker.network.bridge.name"="br-custom" \
  my_custom_network

# Overlay network for Swarm
docker network create --driver overlay \
  --attachable \
  --subnet=10.0.9.0/24 \
  my_overlay_network

# Macvlan network (direct physical access)
docker network create -d macvlan \
  --subnet=192.168.1.0/24 \
  --gateway=192.168.1.1 \
  -o parent=eth0 \
  macvlan_net

# Connect a container to multiple networks
docker network connect frontend web_server
docker network connect backend web_server
```

### DNS and Service Discovery

Docker provides embedded DNS for name resolution between containers. Containers on the same custom network resolve one another by service name automatically:

```bash
docker run -d --name db --network app_net postgres
docker run -d --name api --network app_net myapi
# API can access: postgresql://db:5432

# Custom DNS aliases
docker run -d --name web --network app_net \
  --network-alias webserver \
  --network-alias www nginx
```

### Network Inspection and Debugging

When things fail between containers, these commands become your best friends:

```bash
# Inspect a network
docker network inspect my_network

# List connected containers
docker network inspect my_network \
  --format='{{range .Containers}}{{.Name}} {{end}}'

# Test connectivity
docker exec web ping -c 3 api

# Capture network traffic
docker run --rm --net container:web \
  nicolaka/netshoot tcpdump -i eth0
```

## Docker Storage Management

Containers are ephemeral by design, so persistent data must live somewhere outside the container's writable layer. Docker offers three primary storage mechanisms.

### Storage Types - Comparison

| Type | Advantages | Disadvantages |
|------|-----------|---------------|
| Volumes | Managed by Docker, performant, backupable | Less direct control |
| Bind Mounts | Direct host access | Host path dependency |
| tmpfs | Very fast (RAM) | Volatile data |

### Volumes - Advanced Operations

Named volumes are the recommended persistence mechanism because Docker manages their lifecycle independent of the container:

```bash
# Create volume with a specific driver (NFS)
docker volume create --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.100,rw \
  --opt device=:/path/to/share \
  nfs_volume

# Create a labeled volume
docker volume create --label env=production \
  --label backup=daily \
  prod_data

# List with filters
docker volume ls --filter label=env=production

# Use volume with permissions
docker run -v myvolume:/data:ro nginx  # Read-only
docker run -v myvolume:/data:rw nginx  # Read-write

# Share a volume between containers
docker run -d --name app1 -v shared_data:/data app1
docker run -d --name app2 -v shared_data:/data app2
```

### Backup and Restore - Professional Strategies

> **Caution:** Bind mounts depend on host paths and are harder to keep consistent across hosts. Prefer named volumes when persistence and portability matter, and always test your restore procedure before you need it in an emergency.

A production backup strategy includes compressed full backups, restores, clone operations, and off-site copies:

```bash
# Full volume backup with compression
docker run --rm \
  -v my_volume:/source:ro \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /source .

# Restore a volume
docker run --rm \
  -v my_volume:/target \
  -v $(pwd):/backup \
  alpine \
  tar xzf /backup/backup-20250108-120000.tar.gz -C /target

# Clone a volume
docker volume create new_volume
docker run --rm \
  -v old_volume:/source:ro \
  -v new_volume:/target \
  alpine \
  sh -c "cp -av /source/. /target/"

# Backup to S3 (AWS)
docker run --rm \
  -v my_volume:/data:ro \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  amazon/aws-cli \
  s3 sync /data s3://my-bucket/backups/$(date +%Y%m%d)/
```

### Volume Drivers

Docker supports multiple volume drivers for different storage backends:

- **local**: local storage (default)
- **nfs**: Network File System
- **cifs/smb**: Windows file shares
- **rexray**: cloud storage (AWS EBS, Azure Disk)
- **convoy**: snapshots and backups
- **flocker**: data migration between hosts

## Docker Registry and Private Infrastructure

A registry is a centralized repository for storing and distributing Docker images. Once your team grows beyond a single host, you need a reliable place to store, version, and share images.

### Registry Types

- **Docker Hub**: the official public registry
- **Harbor**: enterprise registry with security scanning
- **Quay.io**: Red Hat registry with advanced features
- **GitHub Container Registry**: integrated with GitHub
- **AWS ECR / Azure ACR / GCP GCR**: native cloud registries
- **Docker Registry (OSS)**: a simple open-source registry

### Secure Private Registry Deployment

Many organizations deploy their own registry behind a reverse proxy. Here is a Docker Compose configuration that runs a registry with an Nginx front end:

```yaml
# docker-compose.yml
version: '3.8'
services:
  registry:
    image: registry:2
    restart: always
    environment:
      REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY: /data
      REGISTRY_AUTH: htpasswd
      REGISTRY_AUTH_HTPASSWD_REALM: Registry
      REGISTRY_AUTH_HTPASSWD_PATH: /auth/htpasswd
      REGISTRY_STORAGE_DELETE_ENABLED: 'true'
    volumes:
      - registry_data:/data
      - ./auth:/auth
    networks:
      - registry_net
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - registry
    networks:
      - registry_net

volumes:
  registry_data:

networks:
  registry_net:
```

### Nginx Configuration for Registry

The Nginx configuration terminates TLS and proxies requests to the registry upstream:

```nginx
# nginx.conf
events {
  worker_connections 1024;
}
http {
  upstream docker-registry {
    server registry:5000;
  }
  server {
    listen 443 ssl http2;
    server_name registry.example.com;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    client_max_body_size 0;
    chunked_transfer_encoding on;
    location / {
      proxy_pass http://docker-registry;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_read_timeout 900;
    }
  }
}
```

### Authentication and Access Control

Protecting your registry starts with authentication. The `htpasswd` mechanism can be seeded with a generated credential file, and then clients log in, tag, push, and pull against the authenticated registry:

```bash
# Create htpasswd file
docker run --rm --entrypoint htpasswd \
  httpd:2 -Bbn admin password > auth/htpasswd

# Login to registry
docker login registry.example.com

# Tag and push an image
docker tag myapp:latest registry.example.com/myapp:v1.0
docker push registry.example.com/myapp:v1.0

# Pull from registry
docker pull registry.example.com/myapp:v1.0

# List images in registry
curl -X GET https://registry.example.com/v2/_catalog \
  -u admin:password
```

## Docker Compose Multi-Container Orchestration

When a single service is not enough, Docker Compose lets you define an entire multi-container application in one declarative file. It is the natural tool for local development and single-host deployments.

### Complete Example - 3-Tier Application

A classic example is a 3-tier stack: a PostgreSQL database, a Redis cache, an API backend, a web frontend, and an Nginx reverse proxy:

```yaml
# docker-compose.yml
version: '3.8'
services:
  # PostgreSQL Database
  database:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-myapp}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  cache:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Backend API
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@database:5432/${DB_NAME}
      REDIS_URL: redis://:${REDIS_PASSWORD}@cache:6379/0
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_healthy
    networks:
      - backend
      - frontend
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M

  # Web Frontend
  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      API_URL: http://api:8000
    depends_on:
      - api
    networks:
      - frontend

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - web
      - api
    networks:
      - frontend

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
```

### Advanced Docker Compose Commands

These commands cover the day-to-day operations you will perform repeatedly:

```bash
# Start with logs
docker-compose up -d && docker-compose logs -f

# Rebuild and restart a specific service
docker-compose up -d --build --force-recreate api

# Scale a service
docker-compose up -d --scale api=5

# Execute a command in a service
docker-compose exec api python manage.py migrate
docker-compose exec database psql -U postgres

# Use multiple env files
docker-compose --env-file .env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml up -d

# View the merged config
docker-compose config

# View resource usage
docker-compose top
```

## Docker Security

Security cannot be an afterthought in containerized systems. The source document organizes hardening around three core principles, then provides a practical checklist.

### Security Principles

#### 1. Image Security

Vulnerabilities often enter through third-party base images and dependencies. Scanning and signing catch them early:

```bash
# Scan with Trivy
trivy image --severity HIGH,CRITICAL nginx:latest

# Scan with Docker Scout
docker scout cves nginx:latest

# Scan with Snyk
snyk container test nginx:latest

# Sign images with Docker Content Trust
export DOCKER_CONTENT_TRUST=1
docker push registry.example.com/myapp:signed
```

#### 2. Isolation and Capabilities

Limit what a container can do inside the host kernel:

```bash
# Drop capabilities
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE nginx

# Read-only mode
docker run --read-only --tmpfs /tmp nginx

# AppArmor / SELinux
docker run --security-opt apparmor=docker-default nginx
docker run --security-opt label=level:s0:c100,c200 nginx

# Disable new privileges
docker run --security-opt=no-new-privileges nginx
```

#### 3. User Namespaces

User namespaces map container UIDs/GIDs to an unprivileged host user, isolating privileges even at the kernel level:

```json
// /etc/docker/daemon.json
{
  "userns-remap": "default"
}
```

```bash
# Restart Docker
sudo systemctl restart docker
```

### Docker Security Checklist

A practical checklist you can apply to every deployment:

- Always use official or verified images
- Scan images before deployment
- Use specific tags, never `latest`
- Run containers as a non-root user
- Limit resources (CPU, memory, I/O)
- Use private networks
- Enable Docker Content Trust
- Regularly update Docker Engine
- Audit with Docker Bench Security
- Encrypt sensitive data
- Implement secret rotation
- Monitor logs and metrics

> **Caution:** Running as root inside containers is one of the most common security mistakes. A compromised root container can quickly escalate to the host. The multi-stage Dockerfile in the images section demonstrates the intended pattern: create a dedicated user and switch with `USER` before the entry point runs.

### Docker Secrets (Swarm)

For Swarm deployments, Docker provides encrypted secrets managed by the orchestrator:

```bash
# Create a secret
echo "mysecretpassword" | docker secret create db_password -

# Use in a service
docker service create --name myapp \
  --secret db_password \
  myimage

# The secret is available at /run/secrets/db_password
```

## Monitoring and Logging

Production systems fail, and without monitoring and central logging, you cannot know why. The source document recommends the Prometheus and Grafana stack for metrics and the ELK stack for logs.

### Monitoring with Prometheus and Grafana

This stack enables performance and availability monitoring:

- **Prometheus**: collects and stores metrics (CPU, memory, etc.)
- **Grafana**: visualizes metrics via interactive dashboards
- **cAdvisor**: a Docker metrics exporter
- **Node Exporter**: a system metrics exporter

```yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    ports:
      - "9090:9090"
    networks:
      - monitoring
  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-piechart-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - monitoring
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    privileged: true
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    ports:
      - "8080:8080"
    networks:
      - monitoring
  node_exporter:
    image: prom/node-exporter:latest
    command:
      - '--path.rootfs=/host'
    volumes:
      - /:/host:ro,rslave
    ports:
      - "9100:9100"
    networks:
      - monitoring

volumes:
  prometheus_data:
  grafana_data:

networks:
  monitoring:
    driver: bridge
```

### Centralized Logging with ELK Stack

The ELK stack centralizes and visualizes container logs:

- **Elasticsearch**: stores and indexes logs
- **Logstash**: collects, transforms, and sends logs
- **Kibana**: a web interface for log analysis

```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - elk
  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5000:5000/tcp"
      - "5000:5000/udp"
      - "9600:9600"
    depends_on:
      - elasticsearch
    networks:
      - elk
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
    networks:
      - elk

volumes:
  elasticsearch_data:

networks:
  elk:
    driver: bridge
```

### Docker Logging Drivers Configuration

Logging drivers route container output to the right destination and control rotation to keep disk usage bounded:

```bash
# Syslog logging
docker run --log-driver=syslog \
  --log-opt syslog-address=udp://logserver:514 \
  --log-opt tag="{{.Name}}" \
  nginx

# Fluentd logging
docker run --log-driver=fluentd \
  --log-opt fluentd-address=localhost:24224 \
  --log-opt tag="docker.{{.Name}}" \
  nginx

# JSON logging with rotation
docker run --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  nginx
```

Rotation can also be configured globally in `daemon.json`:

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
```

## Performance and Optimization

### Image Optimization

A few well-chosen techniques produce dramatic size reductions:

| Technique | Description | Gain |
|-----------|-------------|------|
| Multi-stage build | Separate build and runtime | 50-80% |
| Alpine images | Minimal base | 60-90% |
| Distroless | No full OS | 70-85% |
| Layer caching | Reuse layers | Build time |
| .dockerignore | Reduce context | Build time |

### Container Benchmarking

Benchmarking lets you validate that a container actually meets its performance targets:

```bash
# CPU stress test
docker run --rm -it progrium/stress --cpu 2 --timeout 60s

# Network performance
docker run --rm -it networkstatic/iperf3 -c server_ip

# Disk I/O test
docker run --rm -v /data:/data \
  ubuntu:latest dd if=/dev/zero of=/data/test bs=1M count=1000

# cAdvisor profiling
curl http://localhost:8080/api/v2.0/stats?type=docker&count=1

# Real-time stats
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Docker Daemon Tuning

The daemon itself can be tuned through `daemon.json` for logging, storage, and concurrency:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 10,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "live-restore": true,
  "userland-proxy": false,
  "icc": false,
  "default-address-pools": [
    {
      "base": "172.80.0.0/16",
      "size": 24
    }
  ]
}
```

## CI/CD with Docker

Containerization and CI/CD are a natural fit. Docker images make artifacts immutable and reproducible, and pipelines can build, scan, and deploy them end-to-end.

### GitLab CI Pipeline

A complete GitLab pipeline spans build, test, scan, and deploy stages:

```yaml
stages:
  - build
  - test
  - scan
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

before_script:
  - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $IMAGE_TAG .
    - docker push $IMAGE_TAG
  only:
    - main
    - develop

test:
  stage: test
  image: $IMAGE_TAG
  script:
    - pytest tests/
    - coverage report
  coverage: '/TOTAL .*\s+(\d+%)$/'

security_scan:
  stage: scan
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 1 --severity CRITICAL $IMAGE_TAG
  allow_failure: false

deploy_staging:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | ssh-add -
  script:
    - ssh user@staging-server "docker pull $IMAGE_TAG"
    - ssh user@staging-server "docker-compose up -d"
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy_production:
  stage: deploy
  image: alpine:latest
  script:
    - ssh user@prod-server "docker pull $IMAGE_TAG"
    - ssh user@prod-server "docker stack deploy -c docker-compose.yml app"
  environment:
    name: production
    url: https://example.com
  only:
    - main
  when: manual
```

### GitHub Actions Pipeline

The equivalent GitHub Actions workflow leverages official Docker actions for Buildx, login, metadata, and pushing:

```yaml
name: Docker CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

## Docker Swarm Native Orchestration

When you outgrow a single host, Swarm provides Docker's native orchestration for managing clusters of machines, offering declarative services, scaling, and rolling updates.

### Swarm Cluster Initialization

```bash
# Initialize a manager
docker swarm init --advertise-addr 192.168.1.100

# Add workers
docker swarm join --token SWMTKN-... 192.168.1.100:2377

# List nodes
docker node ls

# Promote a worker to manager
docker node promote worker-node-1

# Label nodes
docker node update --label-add environment=production node-1
docker node update --label-add type=database node-2
```

### Service Deployment

Services give you scaling, declarative updates, and placement constraints:

```bash
# Create a simple service
docker service create --name web \
  --replicas 3 \
  --publish 80:80 \
  nginx:alpine

# Service with constraints
docker service create --name db \
  --constraint 'node.labels.type == database' \
  --mount type=volume,source=db_data,target=/var/lib/postgresql/data \
  postgres:15

# Rolling update
docker service create --name api \
  --replicas 5 \
  --update-parallelism 2 \
  --update-delay 10s \
  --update-failure-action rollback \
  myapi:latest

# Scale a service
docker service scale web=10

# Update a service
docker service update --image nginx:latest web

# Rollback
docker service rollback web
```

### Complete Swarm Stack

For production, you deploy the entire application as a stack with service-level update, restart, and placement policies:

```yaml
version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        max_attempts: 3
      placement:
        constraints:
          - node.role == worker
          - node.labels.environment == production
    networks:
      - frontend
    configs:
      - source: nginx_config
        target: /etc/nginx/nginx.conf
    secrets:
      - ssl_cert
      - ssl_key
  api:
    image: myregistry.com/api:v2.0
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      update_config:
        parallelism: 2
        delay: 10s
        failure_action: rollback
      rollback_config:
        parallelism: 2
        delay: 5s
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
    networks:
      - frontend
      - backend
    secrets:
      - db_password
      - jwt_secret
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
  database:
    image: postgres:15-alpine
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.type == database
      restart_policy:
        condition: on-failure
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - backend
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

configs:
  nginx_config:
    file: ./nginx.conf

secrets:
  db_password:
    external: true
  jwt_secret:
    external: true
  ssl_cert:
    external: true
  ssl_key:
    external: true

volumes:
  db_data:
    driver: local

networks:
  frontend:
    driver: overlay
  backend:
    driver: overlay
    internal: true
```

Deploy and manage the stack with these commands:

```bash
# Deploy stack
docker stack deploy -c docker-stack.yml myapp

# List stacks
docker stack ls

# List services
docker stack services myapp

# View service logs
docker service logs -f myapp_api

# Remove stack
docker stack rm myapp
```

## Troubleshooting and Debugging

### Diagnostic Commands

When a container misbehaves, a systematic toolkit is essential:

```bash
# Inspect a container
docker inspect container_name
docker inspect --format='{{.State.Health.Status}}' container_name

# View processes
docker top container_name

# Real-time stats
docker stats --no-stream

# Docker events
docker events --since '30m' --filter 'type=container'

# Logs with timestamps
docker logs --timestamps --since 30m container_name

# Follow logs
docker logs -f --tail 100 container_name

# Execute a shell
docker exec -it container_name /bin/sh

# Copy files
docker cp container_name:/app/logs/app.log ./
docker cp ./config.yml container_name:/app/config/

# Compare filesystem
docker diff container_name

# Export filesystem
docker export container_name > container_fs.tar
```

### Common Issues and Solutions

1. **Container restarting in a loop**
   ```bash
   docker logs --tail 50 container_name
   docker update --restart=no container_name
   docker inspect --format='{{json .State.Health}}' container_name
   ```

2. **Network issues**
   ```bash
   docker exec container1 ping container2
   docker network inspect network_name
   docker network prune
   ```

3. **Disk space shortage**
   ```bash
   docker system df
   docker system prune -a --volumes
   docker image prune -a --filter "until=168h"
   ```

4. **Slow performance**
   ```bash
   docker stats container_name
   docker update --cpus="1.5" --memory="1g" container_name
   ```

## Migration to Docker

### Containerization Strategy

Migrating an existing application to containers is best done incrementally, not as a big bang:

1. **Assessment**: Identify candidate applications
2. **Stateless first**: Start with stateless apps
3. **Dependencies**: Map all external dependencies
4. **Data**: Plan a persistence strategy
5. **Configuration**: Externalize configs (12-factor)
6. **Testing**: Validate in staging
7. **Monitoring**: Implement observability
8. **Progressive rollout**: Deploy in phases

### Pre-Migration Checklist

Before moving anything:

- Application architecture documented
- Dependencies identified and versioned
- Data management strategy defined
- Rollback plan prepared
- Performance baselines established
- Load tests planned
- Operations documentation created
- Teams trained

## A Real-World Example: A Full 3-Tier Stack

Bringing the concepts together, imagine you are asked to containerize an existing web application. You start from the assessment: the app has a PostgreSQL database, a Redis cache, a Python API, and an Nginx front end. Because the database holds state, you choose a named volume; secrets like passwords and the JWT signing key come from environment variables and Swarm secrets, not from the image.

Your first iteration produces a multi-stage `Dockerfile` for the API (compiling dependencies in a builder stage, then running as a non-root user). Locally you define the whole stack in the 3-tier `docker-compose.yml` from the Compose section, using `internal: true` on the backend network so the database and cache are never exposed externally. Health checks gate startup ordering: the API waits for the database and cache to be healthy before it starts.

In CI, the GitLab pipeline builds the image, runs tests against it, and scans it with Trivy (failing the build on critical vulnerabilities). On the `develop` branch it deploys to staging; on `main` it requires a manual approval before a stack deployment to production. In production, the Swarm stack declares replicas, resource limits, and rolling-update policies for zero-downtime releases, while Prometheus and cAdvisor above report on health and capacity.

The result is a system where every layer -- image, network, storage, secrets, monitoring, and deployment -- reuses exactly the patterns described in this guide.

## Key Takeaways

- Containerization improves portability and deployment consistency by sharing the host kernel while isolating each application
- Security must be integrated from the image build phase, using multi-stage builds, non-root users, scanning, and content trust
- Image optimization (multi-stage, Alpine or distroless bases, `.dockerignore`) reduces costs and improves performance
- Networking drivers (bridge, host, overlay, macvlan, none) and embedded DNS should be chosen deliberately to match your topology
- Named volumes plus a tested backup/restore strategy are essential because containers are ephemeral
- Monitoring and logging (Prometheus + Grafana, ELK) are essential in production, and orchestration (Swarm/Kubernetes) becomes required at scale

## Frequently Asked Questions

**What is the difference between a container and a virtual machine?**
A container shares the host kernel and provides process-level isolation, starting in seconds and weighing in megabytes, while a VM has its own kernel, provides full isolation, starts in minutes, and is gigabytes in size.

**Why use multi-stage builds?**
Multi-stage builds separate compilation from execution, so compilation tools, source code, and build dependencies are excluded from the final image. This typically cuts image size by 50-80%.

**When should I use volumes versus bind mounts?**
Prefer volumes when you want Docker-managed, portable, and easily backupable persistence. Use bind mounts when you need direct, get high control over a host directory, accepting the host-path dependency that comes with it.

**How is data backed up from a named volume?**
You can run a temporary container that mounts the volume read-only and compresses it with `tar`, then restore by extracting that archive into a fresh volume, or copy to object storage such as S3 for off-site retention.

**How does Docker Swarm provide zero-downtime deployments?**
Swarm services support rolling updates with configurable parallelism and delay, alongside auto-rollback on failure, so replicas are updated in batches while the service stays available throughout the deployment.

## Related Articles

- What are cgroups and how do they limit container resources?
- Docker Swarm vs Kubernetes: choosing native orchestration
- A practical guide to private container registries with Docker Registry and Harbor
- Understanding Linux namespaces in container isolation
