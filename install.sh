#!/bin/bash

set -e

# Colors
RED='\033[38;2;244;67;54m'
GREEN='\033[38;2;76;175;80m'
YELLOW='\033[38;2;255;193;7m'
NC='\033[0m' # No Color

# Functions for formatted output
print_header() {
    echo
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              WALLIFY INSTALLATION SCRIPT                  ║"
    echo "║           Open Source Digital Signage System              ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo
}

print_step() {
    echo
    echo "$1"
    echo
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}$1${NC}"
}

print_progress() {
    echo -ne "  $1..."
}

print_done() {
    echo -e " ${GREEN}done${NC}"
}

# Main installation
print_header

# Check if running on Raspberry Pi
print_step "System Check"
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    print_info "This doesn't appear to be a Raspberry Pi"
    echo -n "Continue anyway? (y/n) "
    read -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Installation cancelled"
        exit 1
    fi
else
    print_success "Raspberry Pi detected"
fi

# Update system
print_step "System Update"
print_progress "Updating package lists"
sudo apt-get update -qq 2>/dev/null && print_done || { print_error "Failed"; exit 1; }

print_progress "Upgrading packages"
sudo apt-get upgrade -y -qq 2>/dev/null && print_done || { print_error "Failed"; exit 1; }

# Install Node.js
print_step "Installing Node.js"
if ! command -v node &> /dev/null; then
    print_progress "Downloading Node.js setup script"
    curl -fsSL https://deb.nodesource.com/setup_lts.x -o /tmp/nodesource_setup.sh 2>/dev/null && print_done || { print_error "Failed"; exit 1; }
    
    print_progress "Running Node.js setup"
    sudo -E bash /tmp/nodesource_setup.sh &>/dev/null && print_done || { print_error "Failed"; exit 1; }
    
    print_progress "Installing Node.js"
    sudo apt-get install -y nodejs -qq 2>/dev/null && print_done || { print_error "Failed"; exit 1; }
    
    print_success "Node.js installed: $(node -v)"
else
    print_success "Node.js already installed: $(node -v)"
fi

# Install Chromium
print_step "Installing Chromium Browser"
if ! command -v chromium-browser &> /dev/null; then
    print_progress "Installing Chromium"
    sudo apt-get install -y chromium-browser -qq 2>/dev/null && print_done || { print_error "Failed"; exit 1; }
    print_success "Chromium installed"
else
    print_success "Chromium already installed"
fi

# Install git if needed
if ! command -v git &> /dev/null; then
    print_progress "Installing git"
    sudo apt-get install -y git -qq 2>/dev/null && print_done || { print_error "Failed"; exit 1; }
fi

# Determine installation source
print_step "Preparing Installation Files"
if [ -d "server" ] && [ -d "display" ] && [ -d "dashboard" ]; then
    print_info "Installing from local directory"
    INSTALL_FROM_LOCAL=true
    SOURCE_DIR=$(pwd)
else
    print_info "Installing from GitHub"
    INSTALL_FROM_LOCAL=false
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    print_progress "Cloning repository"
    git clone https://github.com/Rupakpoddar/Wallify.git &>/dev/null && print_done || { print_error "Failed to clone repository"; exit 1; }
    
    cd Wallify
    SOURCE_DIR=$(pwd)
fi

# Create installation directory
INSTALL_DIR="$HOME/wallify"
print_progress "Creating installation directory"
mkdir -p "$INSTALL_DIR" && print_done || { print_error "Failed"; exit 1; }

# Copy files
print_progress "Copying application files"
cp -r "$SOURCE_DIR/server" "$INSTALL_DIR/" 2>/dev/null || { print_error "Failed to copy server files"; exit 1; }
cp -r "$SOURCE_DIR/display" "$INSTALL_DIR/" 2>/dev/null || { print_error "Failed to copy display files"; exit 1; }
cp -r "$SOURCE_DIR/dashboard" "$INSTALL_DIR/" 2>/dev/null || { print_error "Failed to copy dashboard files"; exit 1; }
print_done

# Create uploads directory
mkdir -p "$INSTALL_DIR/server/uploads"
touch "$INSTALL_DIR/server/uploads/.gitkeep"

# Install Node.js dependencies
print_step "Installing Dependencies"
cd "$INSTALL_DIR/server"

print_progress "Installing npm packages"
npm install --omit=dev --silent 2>/dev/null && print_done || { print_error "Failed to install npm packages"; exit 1; }

# Create systemd service
print_step "Setting Up System Service"
print_progress "Creating systemd service"
sudo tee /etc/systemd/system/wallify.service > /dev/null <<EOF
[Unit]
Description=Wallify Digital Signage Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
print_done

# Enable and start service
print_progress "Enabling service"
sudo systemctl daemon-reload
sudo systemctl enable wallify.service &>/dev/null && print_done || { print_error "Failed"; exit 1; }

print_progress "Starting service"
sudo systemctl start wallify.service && print_done || { print_error "Failed"; exit 1; }

# Configure sudo permissions for reboot
print_step "Configuring System Permissions"
print_progress "Setting up reboot permissions"
echo "$USER ALL=(ALL) NOPASSWD: /sbin/reboot" | sudo tee /etc/sudoers.d/wallify-reboot > /dev/null
sudo chmod 0440 /etc/sudoers.d/wallify-reboot && print_done || print_info "Manual configuration may be required"

# Configure auto-start for display
print_step "Configuring Display Auto-Start"
if [ -d "$HOME/.config" ]; then
    print_progress "Setting up kiosk mode"
    mkdir -p "$HOME/.config/autostart"
    
    # Create a startup script with delay
    cat > "$INSTALL_DIR/start-display.sh" << 'EOF'
#!/bin/bash
# Wait for network and server to be ready
sleep 30

# Check if server is running
for i in {1..30}; do
    if curl -s http://localhost:3000/api/assets >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

# Start Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --check-for-update-interval=31536000 \
    http://localhost:3000/display/
EOF
    chmod +x "$INSTALL_DIR/start-display.sh"
    
    tee "$HOME/.config/autostart/wallify-display.desktop" > /dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Wallify Display
Exec=$INSTALL_DIR/start-display.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
    print_done
else
    print_info "Desktop environment not found - skipping auto-start configuration"
fi

# Configure unclutter
if command -v X &> /dev/null; then
    print_progress "Installing cursor auto-hide"
    sudo apt-get install -y unclutter -qq 2>/dev/null && print_done || print_info "Skipped"
    
    if [ -d "$HOME/.config/lxsession/LXDE-pi" ]; then
        if ! grep -q "unclutter" "$HOME/.config/lxsession/LXDE-pi/autostart" 2>/dev/null; then
            echo "@unclutter -idle 0.5 -root" >> "$HOME/.config/lxsession/LXDE-pi/autostart"
        fi
    fi
fi

# Clean up
if [ "$INSTALL_FROM_LOCAL" = false ]; then
    print_progress "Cleaning up temporary files"
    rm -rf "$TEMP_DIR" && print_done
fi

# Get IP address
IP_ADDR=$(hostname -I | cut -d' ' -f1)

# Final status check
print_step "Verifying Installation"
sleep 2

if systemctl is-active --quiet wallify; then
    print_success "Wallify server is running"
    SERVER_STATUS="${GREEN}Running${NC}"
else
    print_error "Wallify server failed to start"
    SERVER_STATUS="${RED}Not running${NC}"
fi

# Print summary
echo
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              INSTALLATION COMPLETE!                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo
echo "Installation Summary:"
echo "  Location: $INSTALL_DIR"
echo -e "  Service: $SERVER_STATUS"
echo
echo "Access URLs:"
echo "  Dashboard:"
echo "    http://$IP_ADDR:3000/dashboard"
echo "    http://localhost:3000/dashboard"
echo
echo "  Display:"
echo "    http://$IP_ADDR:3000/display/"
echo "    http://localhost:3000/display/"
echo
echo "Useful Commands:"
echo "  sudo systemctl status wallify  - Check service status"
echo "  sudo systemctl restart wallify - Restart service"
echo "  sudo journalctl -u wallify -f  - View logs"
echo
echo "The display will start automatically on next boot"
echo

if [[ "$SERVER_STATUS" == *"Not running"* ]]; then
    echo -e "${RED}Warning: Server failed to start. Check logs with:${NC}"
    echo "  sudo journalctl -u wallify -n 50"
    echo
fi
