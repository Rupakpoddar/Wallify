#!/bin/bash

set -e

echo "==================================="
echo "Wallify Installation Script"
echo "==================================="

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "Warning: This doesn't appear to be a Raspberry Pi."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node -v)"
fi

# Install Chromium if not present
if ! command -v chromium-browser &> /dev/null; then
    echo "Installing Chromium..."
    sudo apt-get install -y chromium-browser
else
    echo "Chromium already installed"
fi

# Install git if not present (needed for remote installation)
if ! command -v git &> /dev/null; then
    echo "Installing git..."
    sudo apt-get install -y git
fi

# Determine installation source
if [ -d "server" ] && [ -d "client" ] && [ -d "admin" ]; then
    echo "Installing from local directory..."
    INSTALL_FROM_LOCAL=true
    SOURCE_DIR=$(pwd)
else
    echo "Installing from GitHub..."
    INSTALL_FROM_LOCAL=false
    # Clone repository to temporary directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    git clone https://github.com/Rupakpoddar/Wallify.git
    cd Wallify
    SOURCE_DIR=$(pwd)
fi

# Create installation directory
echo "Creating installation directory..."
INSTALL_DIR="$HOME/wallify"
mkdir -p "$INSTALL_DIR"

# Copy files
echo "Copying files..."
cp -r "$SOURCE_DIR/server" "$INSTALL_DIR/"
cp -r "$SOURCE_DIR/client" "$INSTALL_DIR/"
cp -r "$SOURCE_DIR/admin" "$INSTALL_DIR/"

# Create uploads directory
mkdir -p "$INSTALL_DIR/server/uploads"

# Create .gitkeep file to preserve empty uploads directory
touch "$INSTALL_DIR/server/uploads/.gitkeep"

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR/server"
npm install --production

# Create systemd service
echo "Creating systemd service..."
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

# Enable and start service
echo "Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable wallify.service
sudo systemctl start wallify.service

# Configure auto-start for display (if desktop environment exists)
if [ -d "$HOME/.config" ]; then
    echo "Configuring display auto-start..."
    mkdir -p "$HOME/.config/autostart"
    
    # Get the IP address for the display URL
    IP_ADDR=$(hostname -I | cut -d' ' -f1)
    
    tee "$HOME/.config/autostart/wallify-display.desktop" > /dev/null <<EOF
[Desktop Entry]
Type=Application
Name=Wallify Display
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state http://localhost:3000/display
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
fi

# Configure unclutter to hide mouse (if X11 is present)
if command -v X &> /dev/null; then
    echo "Installing unclutter to hide mouse cursor..."
    sudo apt-get install -y unclutter
    
    # Add to autostart if LXDE is present (Raspberry Pi OS default)
    if [ -d "$HOME/.config/lxsession/LXDE-pi" ]; then
        if ! grep -q "unclutter" "$HOME/.config/lxsession/LXDE-pi/autostart" 2>/dev/null; then
            echo "@unclutter -idle 0.5 -root" >> "$HOME/.config/lxsession/LXDE-pi/autostart"
        fi
    fi
fi

# Clean up temporary directory if used
if [ "$INSTALL_FROM_LOCAL" = false ]; then
    echo "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
fi

# Get IP address for display
IP_ADDR=$(hostname -I | cut -d' ' -f1)

echo "==================================="
echo "Installation complete!"
echo "==================================="
echo ""
echo "Wallify has been installed to: $INSTALL_DIR"
echo ""
echo "Access the admin panel at:"
echo "  http://$IP_ADDR:3000/admin"
echo "  http://localhost:3000/admin"
echo ""
echo "The display can be accessed at:"
echo "  http://$IP_ADDR:3000/display"
echo "  http://localhost:3000/display"
echo ""
echo "The display will start automatically on next boot."
echo ""
echo "To check server status:"
echo "  sudo systemctl status wallify"
echo ""
echo "To view server logs:"
echo "  sudo journalctl -u wallify -f"
echo ""

# Check if service is running
sleep 2
if systemctl is-active --quiet wallify; then
    echo "✓ Wallify server is running"
else
    echo "⚠ Wallify server failed to start. Check logs with:"
    echo "  sudo journalctl -u wallify -n 50"
fi
