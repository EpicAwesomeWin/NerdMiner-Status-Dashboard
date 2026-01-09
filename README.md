# NerdMiner Status Dashboard

A comprehensive web-based status dashboard for monitoring NerdMiner devices with real-time updates, pool integration, and individual miner tracking.

## Features

### ️ Individual Miner Management
- Add miners by IP address (e.g., 192.168.1.32)
- Custom miner names for easy identification
- Real-time status monitoring (online/offline)
- Individual statistics per miner:
  - Current hashrate
  - Share count
  - Best difficulty
  - Temperature
- Individual hashrate graphs for each miner
- Remove miners with confirmation

### 📊 Total Statistics Dashboard
- Total number of miners
- Combined hashrate from all active miners
- Active vs offline miner count
- Aggregated hashrate graph

### ⚡ Auto-Update System
- Automatic data refresh every 3 seconds
- Real-time chart updates
- Smooth animations without page reload
- Maintains up to 20 data points per chart

### 💾 Data Persistence
- Miners saved to browser local storage
- Auto-load saved miners on page refresh
- Persistent configuration across sessions

## Installation

1. Download all files to a directory:
   - `index.html`
   - `styles.css`
   - `script.js`

2. Open `index.html` in a modern web browser

No server required - runs entirely in the browser!

## Usage

### Adding a Miner

1. Enter the miner's IP address in the "Miner IP Address" field
2. Optionally enter a custom name (e.g., "Living Room Miner")
3. Click "Add Miner"
4. The miner will appear in the Individual Miners section with live stats

## API Integration

The dashboard is designed to work with NerdMiner devices. To integrate with real miners:

### Miner API Endpoint
Replace the `fetchMinerData()` function in `script.js`:

```javascript
async function fetchMinerData(miner) {
    const response = await fetch(`http://${miner.ip}/api/status`);
    return await response.json();
}
```

Expected JSON response format:
```json
{
    "status": "online",
    "hashrate": 295.42,
    "shares": 1523,
    "bestDifficulty": 72.978,
    "temperature": 65,
    "lastShare": "2026-01-09T04:08:50Z",
    "uptime": 86400
}
```

### Pool API Endpoint
Replace the `fetchWalletData()` function in `script.js`:

```javascript
async function fetchWalletData(address) {
    const response = await fetch(`http://${CONFIG.poolUrl}/api/user/${address}`);
    return await response.json();
}
```

Expected JSON response format:
```json
{
    "workers": 3,
    "hashrate": 886.25,
    "bestShare": 72.978,
    "lastShare": "2026-01-09 04:08:50",
    "history": [
        {"time": "12:00:00", "hashrate": 850.5},
        {"time": "12:01:00", "hashrate": 886.25}
    ]
}
```

## Configuration

Edit the `CONFIG` object in `script.js` to customize:

```javascript
const CONFIG = {
    updateInterval: 3000,    // Update interval in milliseconds (3 seconds)
    maxDataPoints: 20,       // Maximum data points to show in charts
    poolUrl: 'pool.nerdminer.org',
    poolPort: 3333
};
```

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

Requires a modern browser with ES6+ support.

## Technologies Used

- **HTML5** - Structure
- **CSS3** - Styling with custom properties
- **JavaScript (ES6+)** - Logic and data handling
- **Bootstrap 5.3** - UI framework
- **Bootstrap Icons** - Icon set
- **Chart.js 4.4** - Data visualization

## Features in Detail

### Real-time Monitoring
- Data refreshes every 3 seconds
- Charts update smoothly without animation lag
- Status badges update instantly

### Responsive Design
- Mobile-friendly layout
- Adapts to different screen sizes
- Touch-friendly controls

### Visual Indicators
- Color-coded status badges
- Online/offline indicators
- Gradient card designs
- Hover effects for better UX

### Data Management
- Local storage for persistence
- Automatic cleanup of old data points
- Efficient chart updates

## Customization

### Changing Colors
Edit CSS custom properties in `styles.css`:

```css
:root {
    --primary-color: #00CFB6;
    --secondary-color: #00AD99;
    --success-color: #00844B;
    --danger-color: #DB1F1F;
    /* etc. */
}
```

### Adding More Statistics
Extend the miner object in `script.js` and update the UI accordingly.

## Troubleshooting

### Miners Not Updating
- Check if miner IPs are accessible from your network
- Verify CORS settings on miner devices
- Check browser console for errors

### Charts Not Displaying
- Ensure Chart.js CDN is accessible
- Check browser console for JavaScript errors
- Verify canvas elements exist in DOM

### Data Not Persisting
- Check if browser allows local storage
- Verify no browser extensions blocking storage
- Clear browser cache and reload

## License

This project is provided as-is for use with NerdMiner devices.

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify API endpoints are configured correctly
3. Ensure network connectivity to miners

## Future Enhancements

- [ ] Export statistics to CSV
- [ ] Email/notification alerts for offline miners
- [ ] Historical data storage
- [ ] Multi-pool support
- [ ] Power consumption tracking
- [ ] Profitability calculator
