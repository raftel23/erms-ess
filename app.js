/**
 * Acorn ESS - Application Logic
 * Genesis 4.3.1 Security Framework (Connected to HR Genesis 2)
 */

document.addEventListener('DOMContentLoaded', () => {
    // initialize Lucide icons
    lucide.createIcons();

    // App State
    const state = {
        user: null,
        db: null, // Full fetch from erms-v2
        activePane: null,
        activeLeaveSub: 'leave-apply',
        activeProfileSub: 'profile-general',
        selectedFile: null,
        isAnimating: false
    };

    // Secure UUID Generator (RFC4122 compliant, with fallback for older devices)
    const generateUUID = () => {
        try {
            return crypto.randomUUID();
        } catch (e) {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }
    };

    // DOM Elements
    const elements = {
        loader: document.getElementById('global-loader'),
        authSection: document.getElementById('auth-section'),
        portalSection: document.getElementById('portal-section'),
        loginForm: document.getElementById('login-form'),
        logoutBtn: document.getElementById('logout-btn'),
        
        // Navigation Elements
        headerGrid: document.querySelector('.header-grid'),
        headerCards: document.querySelectorAll('.header-grid .stat-card'),
        backButtons: document.querySelectorAll('.back-btn'),
        panes: document.querySelectorAll('.pane'),
        
        // Sub-Navigation Elements
        subNavItems: document.querySelectorAll('.sub-nav-item'),
        subPanes: document.querySelectorAll('.sub-pane'),
        
        // Profile Data
        empName: document.getElementById('emp-name'),
        empPosition: document.getElementById('emp-position'),
        empDept: document.getElementById('emp-dept'),
        empHired: document.getElementById('emp-hired'),
        dashGreeting: document.getElementById('dash-greeting'),
        dashDate: document.getElementById('dash-date'),
        
        // Stats
        statAttendance: document.getElementById('stat-attendance'),
        statLeave: document.getElementById('stat-leave'),
        
        // Lists & Forms
        attendanceList: document.getElementById('attendance-list'),
        payrollList: document.getElementById('payroll-list'),
        leaveList: document.getElementById('leave-list'),
        docList: document.getElementById('doc-list'),
        leaveForm: document.getElementById('leave-form'),
        
        // File Upload Elements
        fileInput: document.getElementById('file-input'),
        fileInfo: document.getElementById('file-info'),
        selectedFilename: document.getElementById('selected-filename'),
        fileRename: document.getElementById('file-rename'),
        uploadBtn: document.getElementById('upload-btn')
    };

    // --- Core Functions ---

    const showLoader = (show) => {
        elements.loader.classList.toggle('active', show);
    };

    const switchView = (viewId) => {
        elements.authSection.classList.remove('active');
        elements.portalSection.classList.remove('active');
        document.getElementById(viewId).classList.add('active');
    };

    const switchPane = async (targetPaneId) => {
        if (state.activePane === targetPaneId || state.isAnimating) return;
        
        const isBackToDashboard = targetPaneId === null;
        const currentPane = state.activePane ? document.getElementById(state.activePane) : null;
        const nextPane = targetPaneId ? document.getElementById(targetPaneId) : null;

        if (isBackToDashboard) {
            if (currentPane) currentPane.classList.remove('active', 'closing', 'opening');
            elements.headerGrid.classList.remove('hidden');
            state.activePane = null;
            elements.headerCards.forEach(card => card.classList.remove('active'));
            lucide.createIcons();
            return;
        }

        state.isAnimating = true;
        elements.headerGrid.classList.add('hidden');

        if (currentPane) {
            currentPane.classList.add('closing');
            await new Promise(r => setTimeout(r, 400));
            currentPane.classList.remove('active', 'closing');
        }

        if (nextPane) {
            nextPane.classList.add('active', 'opening');
            await new Promise(r => setTimeout(r, 500));
            nextPane.classList.remove('opening');
        }
        
        state.activePane = targetPaneId;
        state.isAnimating = false;
        
        elements.headerCards.forEach(card => {
            card.classList.toggle('active', card.getAttribute('data-pane') === targetPaneId);
        });

        if (targetPaneId === 'leave-pane' && state.activeLeaveSub === 'leave-history') renderLeaveHistory();
        if (targetPaneId === 'profile-pane' && state.activeProfileSub === 'profile-docs') renderDocuments();

        lucide.createIcons();
    };

    const switchSubPane = async (subPaneId) => {
        const isLeave = subPaneId.startsWith('leave');
        const parentId = isLeave ? 'leave-pane' : 'profile-pane';
        const parentElem = document.getElementById(parentId);
        
        parentElem.querySelectorAll('.sub-pane').forEach(p => p.classList.remove('active'));
        parentElem.querySelectorAll('.sub-nav-item').forEach(n => n.classList.remove('active'));
        
        const targetSub = document.getElementById(subPaneId);
        if (targetSub) targetSub.classList.add('active');
        
        const targetBtn = document.querySelector(`.sub-nav-item[data-sub="${subPaneId}"]`);
        if (targetBtn) targetBtn.classList.add('active');
        
        if (isLeave) state.activeLeaveSub = subPaneId;
        if (subPaneId === 'leave-history') renderLeaveHistory();
        if (subPaneId === 'profile-docs') renderDocuments();
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
    };

    // --- Live API Logic ---

    const performESSLogin = async (empId, birthday) => {
        try {
            const url = `${CONFIG.API_URL}?mode=${CONFIG.MODE}&hrId=portal&empId=${encodeURIComponent(empId)}&birthday=${encodeURIComponent(birthday)}`;
            const response = await fetch(url, { redirect: 'follow' });
            return await response.json();
        } catch (error) {
            console.error('Login Fetch Error:', error);
            return { error: 'Cloud connection timeout.' };
        }
    };

    const toSnakeCase = (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase();
    const toSnakeCaseKeys = (obj) => {
        if (Array.isArray(obj)) return obj.map(toSnakeCaseKeys);
        if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
        const newObj = {};
        for (const key of Object.keys(obj)) {
            const newKey = toSnakeCase(key);
            newObj[newKey] = toSnakeCaseKeys(obj[key]);
        }
        return newObj;
    };

    const postToSheet = async (table, data) => {
        try {
            // Send in the SAME format as HR Admin (erms-v2) so the
            // Google Script writes to the existing sheet tab, not a new one.
            const hrId = data.hrFilter || data.createdBy || 'portal';
            const url = `${CONFIG.API_URL}${CONFIG.API_URL.includes('?') ? '&' : '?'}hrId=${encodeURIComponent(hrId)}`;
            const response = await fetch(url, {
                method: 'POST',
                redirect: 'follow',
                body: JSON.stringify({ 
                    table: toSnakeCase(table), 
                    data: [toSnakeCaseKeys(data)],
                    hrId: hrId
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Post Error:', error);
            return { status: 'error' };
        }
    };

    // --- Aggressive Normalizers (Fuzzy Search) ---
    
    const normID = (str) => (str || "").toString().replace(/\D/g, "");
    const normDate = (d) => (d || "").toString().split('T')[0].trim();

    // FUZZY FINDER: Looks for key that "contains" a word, ignoring case/chars
    const getFuzzyKey = (obj, pattern) => {
        if (!obj) return null;
        return Object.keys(obj).find(k => {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
            return cleanKey.includes(pattern.toLowerCase());
        });
    };

    const getFuzzyValue = (obj, pattern) => {
        const key = getFuzzyKey(obj, pattern);
        return key ? obj[key] : null;
    };

    const renderAllData = () => {
        if (!state.user || !state.db) return;
        
        const u = state.user;
        const employeeId = normID(getFuzzyValue(u, 'empid') || getFuzzyValue(u, 'employeeid') || u.uuid);
        
        // 1. Dashboard
        elements.empName.textContent = `${getFuzzyValue(u, 'firstname') || ""} ${getFuzzyValue(u, 'lastname') || ""}`.trim() || "Personnel";
        elements.empPosition.textContent = getFuzzyValue(u, 'jobtitle') || getFuzzyValue(u, 'position') || "--";
        elements.empDept.textContent = getFuzzyValue(u, 'department') || getFuzzyValue(u, 'dept') || "--";
        elements.empHired.textContent = getFuzzyValue(u, 'hireddate') || getFuzzyValue(u, 'hiredate') || "--";
        elements.dashGreeting.textContent = `Welcome back, ${getFuzzyValue(u, 'firstname') || "Personnel"}`;
        elements.dashDate.textContent = new Date().toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });

        // 2. Attendance
        const attendance = state.db.attendance || state.db.Attendance || [];
        const myAttendance = attendance.filter(log => {
            const logId = normID(getFuzzyValue(log, 'empid') || getFuzzyValue(log, 'employeeid') || log.uuid);
            return logId === employeeId;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
            
        elements.attendanceList.innerHTML = myAttendance.map(log => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${getFuzzyValue(log, 'date')}</span>
                    <span class="item-sub">${getFuzzyValue(log, 'timein') || getFuzzyValue(log, 'clockin') || ""} - ${getFuzzyValue(log, 'timeout') || getFuzzyValue(log, 'clockout') || ""}</span>
                </div>
                <div class="item-meta">
                    <span class="badge-${(getFuzzyValue(log, 'status') || 'Present').toLowerCase() === 'present' ? 'green' : 'amber'}">${getFuzzyValue(log, 'status') || 'Present'}</span>
                </div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No recent logs found.</p>';
        elements.statAttendance.textContent = myAttendance.length > 0 ? `${myAttendance.length} Ent` : '--';

        // 3. Payroll
        const payroll = state.db.payrollrecords || state.db.PayrollRecords || state.db.payroll || [];
        const myPayroll = payroll.filter(pay => {
            const payId = normID(getFuzzyValue(pay, 'empid') || getFuzzyValue(pay, 'employeeid') || pay.uuid);
            return payId === employeeId;
        });
        elements.payrollList.innerHTML = myPayroll.map(pay => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${getFuzzyValue(pay, 'period') || "Payroll Record"}</span>
                    <span class="item-sub">Net Pay: ${formatCurrency(getFuzzyValue(pay, 'netpay') || getFuzzyValue(pay, 'amount'))}</span>
                </div>
                <div class="item-meta text-xs">${getFuzzyValue(pay, 'released') || getFuzzyValue(pay, 'date') || ""}</div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No payroll history found.</p>';
        
        // 4. Leave Stat
        const myLeaves = (state.db.leaverequests || state.db.leaveRequests || state.db.leaves || []).filter(l => {
            const lId = normID(getFuzzyValue(l, 'employeeid') || getFuzzyValue(l, 'empid') || l.uuid);
            return lId === employeeId;
        });
        elements.statLeave.textContent = `${myLeaves.filter(l => (getFuzzyValue(l, 'status') || "").toLowerCase() === 'approved').length} App`;
    };

    const renderLeaveHistory = () => {
        const u = state.user;
        const employeeId = normID(getFuzzyValue(u, 'empid') || getFuzzyValue(u, 'employeeid') || u.uuid);
        const leaves = state.db.leaverequests || state.db.leaveRequests || state.db.leaves || [];
        const myLeaves = leaves.filter(l => {
            const lId = normID(getFuzzyValue(l, 'employeeid') || getFuzzyValue(l, 'empid') || l.uuid);
            return lId === employeeId;
        });
        
        elements.leaveList.innerHTML = myLeaves.map(leave => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${getFuzzyValue(leave, 'leavetype') || getFuzzyValue(leave, 'type') || "Leave"}</span>
                    <span class="item-sub">${getFuzzyValue(leave, 'startdate') || getFuzzyValue(leave, 'startDate')} to ${getFuzzyValue(leave, 'enddate') || getFuzzyValue(leave, 'endDate')}</span>
                    ${getFuzzyValue(leave, 'adminremarks') || getFuzzyValue(leave, 'adminRemarks') ? `
                        <div class="item-remark">
                            <i data-lucide="message-square" style="width: 10px; height: 10px;"></i>
                            <span>HR: ${getFuzzyValue(leave, 'adminremarks') || getFuzzyValue(leave, 'adminRemarks')}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="item-meta">
                    <span class="badge-${(getFuzzyValue(leave, 'status') || 'Pending').toLowerCase()}">${getFuzzyValue(leave, 'status') || 'Pending'}</span>
                </div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No leave requests found.</p>';
    };

    const renderDocuments = () => {
        const u = state.user;
        const employeeId = normID(getFuzzyValue(u, 'empid') || getFuzzyValue(u, 'employeeid') || u.uuid);
        const docs = state.db.documents || state.db.Documents || [];
        const myDocs = docs.filter(d => {
            const dId = normID(getFuzzyValue(d, 'empid') || getFuzzyValue(d, 'employeeid') || d.uuid);
            return dId === employeeId;
        });
        
        elements.docList.innerHTML = myDocs.map(doc => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${getFuzzyValue(doc, 'customname') || getFuzzyValue(doc, 'name')}</span>
                    <span class="item-sub">Uploaded on ${getFuzzyValue(doc, 'date')}</span>
                </div>
                <div class="item-meta text-xs">View</div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No documents found.</p>';
    };

    // --- Auth Logic ---

    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true);
        
        const empidInput = document.getElementById('employee-id').value.trim();
        const birthdayInput = document.getElementById('birthdate').value.trim(); 
        
        console.log('--- Secure ESS Auth Initialization ---');
        console.log('Requesting ID:', empidInput, 'Birthday:', birthdayInput);

        const result = await performESSLogin(empidInput, birthdayInput);

        // 🔍 SURFACING DEEP DIAGNOSTICS IMMEDIATELY
        if (result && result.debug) {
            console.warn('--- Login Debugging Report ---');
            console.log('Server Diagnosis:', result.debug);
            console.log('Sheet Checked:', result.debug.sheetName);
            console.log('Headers Found:', result.debug.headersFound);
        }
        
        if (!result || result.error) {
            alert('Access Denied: ' + (result?.error || 'Unknown Link Error'));
            showLoader(false);
            return;
        }

        // The API now returns a pre-filtered 'result' object directly
        state.user = result.user;
        state.db = result; // Store the rest of the tables (attendance, payroll, etc.)

        if (state.user) {
            console.log('Access Granted for:', getFuzzyValue(state.user, 'firstname'));
            renderAllData();
            switchView('portal-section');
        }
        
        showLoader(false);
    });

    // --- Feature Listeners ---

    elements.logoutBtn.addEventListener('click', () => {
        if (confirm('Terminate Session?')) {
            state.user = null;
            elements.loginForm.reset();
            switchView('auth-section');
            state.activePane = null;
            elements.headerGrid.classList.remove('hidden');
            elements.panes.forEach(p => p.classList.remove('active'));
        }
    });

    elements.headerCards.forEach(card => card.addEventListener('click', () => switchPane(card.getAttribute('data-pane'))));
    elements.backButtons.forEach(btn => btn.addEventListener('click', () => switchPane(null)));
    elements.subNavItems.forEach(item => item.addEventListener('click', () => switchSubPane(item.getAttribute('data-sub'))));

    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                state.selectedFile = file;
                elements.selectedFilename.textContent = `File: ${file.name}`;
                elements.fileRename.value = file.name.split('.')[0];
                elements.fileInfo.classList.remove('hidden');
            }
        });
    }

    if (elements.uploadBtn) {
        elements.uploadBtn.addEventListener('click', async () => {
            showLoader(true);
            const u = state.user;
            // 🔒 SECURITY HANDSHAKE: Tag document to the correct HR Admin
            const hrOwner = getFuzzyValue(u, 'hrfilter') || getFuzzyValue(u, 'createdby') || 'admin';
            const empName = `${getFuzzyValue(u, 'firstname') || ''} ${getFuzzyValue(u, 'lastname') || ''}`.trim();
            const data = {
                uuid: generateUUID(),
                employeeId: Number(normID(getFuzzyValue(u, 'empid') || getFuzzyValue(u, 'employeeid') || u.id || 0)),
                employeeUuid: u.uuid,
                name: elements.fileRename.value,
                type: state.selectedFile?.type || 'application/octet-stream',
                size: state.selectedFile?.size || 0,
                uploadedAt: new Date().toISOString(),
                uploadedBy: empName,
                createdBy: hrOwner,
                hrFilter: hrOwner,
                updatedAt: Date.now(),
                isDeleted: false
            };
            const result = await postToSheet('employee_documents', data);
            if (result.status === 'success') {
                alert('Document uploaded.');
                if (!state.db.documents) state.db.documents = [];
                state.db.documents.unshift(data);
                renderDocuments();
                elements.fileInfo.classList.add('hidden');
            }
            showLoader(false);
        });
    }

    elements.leaveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true);
        
        const u = state.user;
        const firstName = getFuzzyValue(u, 'firstname') || "";
        const lastName = getFuzzyValue(u, 'lastname') || "";
        
        // 🔒 SECURITY HANDSHAKE: Hands over ownership to exactly the right HR Admin
        const hrOwner = getFuzzyValue(u, 'hrfilter') || getFuzzyValue(u, 'createdby') || 'admin';
        
        const leaveType = document.getElementById('leave-type').value;
        const balanceField = leaveType === 'sick' ? 'slbalance' : leaveType === 'vacation' ? 'vlbalance' : null;
        
        // ⛔ GENESIS 4.3.5: ZERO BALANCE BLOCKING
        if (balanceField) {
            const currentBalance = Number(getFuzzyValue(u, balanceField) || 0);
            if (currentBalance <= 0) {
                alert(`Insufficient ${leaveType.toUpperCase()} leave credits (Current: 0). Application blocked.`);
                showLoader(false);
                return;
            }
        }
        
        const data = {
            uuid: generateUUID(),                       // ✅ RFC4122 Global ID
            employeeId: Number(normID(getFuzzyValue(u, 'empid') || getFuzzyValue(u, 'employeeid') || u.id || 0)),
            employeeUuid: u.uuid,                       // ✅ Cross-device primary key
            name: `${firstName} ${lastName}`.trim(),
            type: document.getElementById('leave-type').value,
            startDate: document.getElementById('leave-start').value,
            endDate: document.getElementById('leave-end').value,
            reason: document.getElementById('leave-reason').value,
            status: 'pending',                          // ✅ Lowercase — matches HR Admin filter
            appliedDate: new Date().toISOString().split('T')[0],
            hrFilter: hrOwner,                          // ✅ Delivers to the correct Admin
            createdBy: hrOwner,
            updatedAt: Date.now(),                      // ✅ Sync Engine timestamp
            isDeleted: false                            // ✅ Required for lifecycle tracking
        };

        const result = await postToSheet('leave_requests', data);
        
        if (result.status === 'success') {
            alert('Request Sent Successfully!');
            
            // Local State Update
            if (!state.db.leaverequests) state.db.leaverequests = [];
            state.db.leaverequests.unshift(data); 
            
            elements.leaveForm.reset();
            switchSubPane('leave-history');
        } else {
            alert('Submission Failed. Please check your connection.');
        }
        showLoader(false);
    });

});
