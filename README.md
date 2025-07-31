# Wallify

Open source digital signage system for Raspberry Pi. Display images, videos, and web content on any screen with a simple web-based interface.

## Features

- Web-based dashboard for content management
- Support for images, videos, and web URLs
- Custom duration settings for each asset
- Active/inactive toggle for assets
- Drag-and-drop asset reordering
- Download uploaded assets
- Remote system reboot
- Automatic display rotation
- Kiosk mode with auto-start on boot
- Lightweight and optimized for Raspberry Pi

## Requirements

- Raspberry Pi 3 or newer
- Raspberry Pi OS (32-bit or 64-bit)
- Active network connection
- 2GB+ free storage space

## Installation

Run this command on your Raspberry Pi:

```bash
curl -sSL https://raw.githubusercontent.com/Rupakpoddar/Wallify/main/install.sh | bash
```

## Usage

After installation, the server will start automatically.

### Dashboard
Access the dashboard to manage content:
```
http://[raspberry-pi-ip]:3000/dashboard
```

### Display
The display will start automatically on boot. To manually view:
```
http://[raspberry-pi-ip]:3000/display
```

## Manual Installation

If you prefer to install manually:

```bash
# Clone the repository
git clone https://github.com/Rupakpoddar/Wallify.git
cd Wallify

# Run the installation script
chmod +x install.sh
./install.sh
```

## Project Structure

```
wallify/
├── server/          # Node.js backend server
│   ├── index.js     # Main server file
│   ├── package.json # Dependencies configuration
│   └── uploads/     # Asset storage directory
│       └── .gitkeep # Keeps empty directory in git
├── display/         # Display client
│   ├── display.html
│   └── display.js
├── dashboard/       # Dashboard interface
│   ├── index.html
│   ├── dashboard.js
│   ├── dashboard.css
│   └── favicon.png  # Favicon for dashboard
├── install.sh       # Installation script
└── README.md        # This file
```

## Configuration

### Server Port
Default port is 3000. To change, edit `server/index.js`:
```javascript
const PORT = 3000; // Change this
```

### File Upload Limits
Default limit is 100MB. To change, edit `server/index.js`:
```javascript
limits: { fileSize: 100 * 1024 * 1024 } // Change this
```

### Display Refresh Interval
The display automatically checks for updates every 3 seconds and reloads when content changes.

## Managing the Service

The Wallify server runs as a systemd service:

```bash
# Check status
sudo systemctl status wallify

# Restart service
sudo systemctl restart wallify

# Stop service
sudo systemctl stop wallify

# View logs
sudo journalctl -u wallify -f
```

## Troubleshooting

### Display not showing content
1. Check if the server is running: `sudo systemctl status wallify`
2. Verify content is uploaded via admin panel
3. Check browser console for errors (F12)

### Cannot access dashboard
1. Ensure you're using the correct IP address
2. Make sure you're connected to the same WiFi network as the Raspberry Pi
3. Verify the Raspberry Pi's IP is reachable: `ping [raspberry-pi-ip]`
4. Check firewall settings
5. Verify port 3000 is not blocked

### Files not uploading
1. Check available disk space: `df -h`
2. Verify file permissions in uploads directory
3. Ensure file type is supported (images: jpg, png, gif; videos: mp4, webm)

### Reboot button not working
1. Available on localhost and local network IPs
2. Check sudo permissions: `sudo -l | grep reboot`
3. If needed, manually add: `echo "$USER ALL=(ALL) NOPASSWD: /sbin/reboot" | sudo tee /etc/sudoers.d/wallify-reboot`

## Uninstallation

To completely remove Wallify:

```bash
# Stop and disable service
sudo systemctl stop wallify
sudo systemctl disable wallify
sudo rm /etc/systemd/system/wallify.service

# Remove files
rm -rf ~/wallify

# Remove autostart entry
rm ~/.config/autostart/wallify-display.desktop
```

## Contributing

Contributions are welcome! Feel free to submit pull requests, report issues, or suggest new features. Every contribution, big or small, is valued and appreciated ❤️
