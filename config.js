const CONFIG = {
    // Live Backend: HR Genesis 2 (Connected via erms-v2 Sync Engine)
    API_URL: 'https://script.google.com/macros/s/AKfycbxiNcO8PqaTyYmqhq1ga-b45y16PQKhWnufKTOgF0By_ix3eTm-xaSPXqlfkVPSblx3kA/exec',
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
