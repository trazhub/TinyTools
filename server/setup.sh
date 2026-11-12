#!/usr/bin/env bash
# One-time VM setup. Run it yourself, as root:   sudo bash setup.sh
# Read it first. It installs Docker, turns on a firewall, and exposes the API through Tailscale Funnel.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo: sudo bash setup.sh"; exit 1; fi
APP_USER="${SUDO_USER:-tiny-vm}"

echo "==> Updating packages and installing Docker"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 ufw unattended-upgrades
systemctl enable --now docker
usermod -aG docker "$APP_USER"

echo "==> Automatic security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Firewall: allow SSH and Tailscale, block everything else inbound"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow in on tailscale0
ufw --force enable

echo "==> Done. Next steps:"
echo "  1. Log out and back in so the docker group applies."
echo "  2. In the Tailscale admin (login.tailscale.com), enable HTTPS certificates and Funnel for this machine."
echo "  3. Then run:  sudo tailscale funnel --bg 8080"
