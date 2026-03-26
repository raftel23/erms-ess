const CONFIG = {
    // Live Backend: HR Genesis 2 (Connected via erms-v2 Sync Engine)
    API_URL: 'https://script.google.com/macros/s/AKfycbzskQAt6P3M3mhk2etg-aOJzbsnSTkk5_ZnXmdcEwH11bbRyUiiOwvoAU0sAzNcLgACFQ/exec',
    MODE: 'ess', // Mode for secure employee access

    // Mapping for system functionality
    ENDPOINTS: {
        AUTH: 'auth',
        FETCH_ALL: 'doGet', // erms-v2 returns everything in doGet
        POST_DATA: 'doPost'
    },

    // Default system information
    SYSTEM_VERSION: 'Genesis 4.3.1',
    BRAND_NAME: 'ACORN ESS',

    // Refresh interval for live data (ms)
    SYNC_INTERVAL: 300000 // 5 minutes
};
