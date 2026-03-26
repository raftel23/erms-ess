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

    const fetchFullData = async () => {
        try {
            const response = await fetch(CONFIG.API_URL, { redirect: 'follow' });
            return await response.json();
        } catch (error) {
            console.error('Fetch Error:', error);
            return null;
        }
    };

    const postToSheet = async (table, data) => {
        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                redirect: 'follow', 
                body: JSON.stringify({ table, data: [data] })
            });
            return await response.json();
        } catch (error) {
            console.error('Post Error:', error);
            return { status: 'error' };
        }
    };

    // --- UI Rendering Logic (Filtered by User) ---

    // Aggressive Normalizers
    const normID = (str) => (str || "").toString().replace(/\D/g, "");
    const normDate = (d) => (d || "").toString().split('T')[0].trim();

    const renderAllData = () => {
        if (!state.user || !state.db) return;
        
        const id = normID(state.user.empId || state.user.employeeid || state.user.uuid);
        
        // 1. Dashboard
        elements.empName.textContent = `${state.user.firstname || state.user.FirstName || ""} ${state.user.lastname || state.user.LastName || ""}`;
        elements.empPosition.textContent = state.user.jobtitle || state.user.JobTitle || state.user.position || "--";
        elements.empDept.textContent = state.user.department || state.user.Department || "--";
        elements.empHired.textContent = state.user.hiredDate || state.user.HiredDate || "--";
        elements.dashGreeting.textContent = `Welcome back, ${state.user.firstname || state.user.FirstName || "Personnel"}`;
        elements.dashDate.textContent = new Date().toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });

        // 2. Attendance
        const attendance = state.db.attendance || state.db.Attendance || [];
        const attKey = attendance[0]?.hasOwnProperty('empId') ? 'empId' : (attendance[0]?.hasOwnProperty('employeeid') ? 'employeeid' : 'uuid');
        const myAttendance = attendance.filter(log => normID(log[attKey]) === id).sort((a, b) => new Date(b.date) - new Date(a.date));
            
        elements.attendanceList.innerHTML = myAttendance.map(log => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${log.date}</span>
                    <span class="item-sub">${log.timein || log.clockin || ""} - ${log.timeout || log.clockout || ""}</span>
                </div>
                <div class="item-meta">
                    <span class="badge-${(log.status || 'Present').toLowerCase() === 'present' ? 'green' : 'amber'}">${log.status || 'Present'}</span>
                </div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No recent logs found.</p>';
        elements.statAttendance.textContent = myAttendance.length > 0 ? `${myAttendance.length} Ent` : '--';

        // 3. Payroll
        const payroll = state.db.payroll || state.db.Payroll || [];
        const myPayroll = payroll.filter(pay => normID(pay[attKey] || pay.empId || pay.uuid) === id);
        elements.payrollList.innerHTML = myPayroll.map(pay => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${pay.period || pay.period_name}</span>
                    <span class="item-sub">Net Pay: ${formatCurrency(pay.netpay || pay.amount)}</span>
                </div>
                <div class="item-meta text-xs">${pay.released_date || pay.date}</div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No payroll history found.</p>';
        
        // 4. Leave Stat
        const myLeaves = (state.db.leaves || state.db.Leaves || []).filter(l => normID(l[attKey] || l.empId) === id);
        elements.statLeave.textContent = `${myLeaves.filter(l => l.status === 'Approved').length} App`;
    };

    const renderLeaveHistory = () => {
        const id = normID(state.user.empId || state.user.employeeid || state.user.uuid);
        const leaves = state.db.leaves || state.db.Leaves || [];
        const lKey = leaves[0]?.hasOwnProperty('empId') ? 'empId' : 'uuid';
        const myLeaves = leaves.filter(l => normID(l[lKey]) === id);
        elements.leaveList.innerHTML = myLeaves.map(leave => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${leave.leavetype || leave.type} Leave</span>
                    <span class="item-sub">${leave.startdate} to ${leave.enddate}</span>
                </div>
                <div class="item-meta"><span class="badge-${(leave.status || 'Pending').toLowerCase()}">${leave.status || 'Pending'}</span></div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No leave requests found.</p>';
    };

    const renderDocuments = () => {
        const id = normID(state.user.empId || state.user.employeeid || state.user.uuid);
        const docs = state.db.documents || state.db.Documents || [];
        const myDocs = docs.filter(d => normID(d.empId || d.uuid) === id);
        elements.docList.innerHTML = myDocs.map(doc => `
            <div class="list-item">
                <div class="item-main">
                    <span class="item-title">${doc.customname || doc.name}</span>
                    <span class="item-sub">Uploaded on ${doc.date}</span>
                </div>
                <div class="item-meta text-xs">View</div>
            </div>
        `).join('') || '<p class="text-xs text-center p-4">No documents found.</p>';
    };

    // --- Auth Logic ---

    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true);
        
        const empid = document.getElementById('employee-id').value.trim();
        const birthday = document.getElementById('birthdate').value.trim(); // YYYY-MM-DD
        
        console.log('--- Auth Initialization ---');
        console.log('Input ID:', empid, 'Input Birthday:', birthday);

        state.db = await fetchFullData();
        
        if (!state.db) {
            alert('Cloud security link failure. Check internet connection.');
            showLoader(false);
            return;
        }

        // Search in all likely tables
        const users = state.db.employees || state.db.Employees || state.db.users || state.db.Users || [];
        console.log('Database Tables Found:', Object.keys(state.db));
        console.log('Employee Records Count:', users.length);

        const found = users.find(u => {
            const dbId = normID(u.empId || u.empid || u.employeeid || u.uuid || u.PersonnelID);
            const dbDate = normDate(u.birthday || u.birthdate || u.Birthday || u.BirthDate || u.Birthdate);
            
            // Console Match Log (Hidden Debugger)
            if (dbId === normID(empid)) {
                console.log('ID Match Found! Checking Birthday...');
                console.log('DB Date:', dbDate, 'Input Date:', birthday);
            }

            return dbId === normID(empid) && dbDate === birthday;
        });

        if (found) {
            console.log('Access Granted for:', found.firstname || found.FirstName);
            state.user = found;
            renderAllData();
            switchView('portal-section');
        } else {
            console.error('Match Failed. No user found with provided credentials.');
            alert('Personnel ID or Birthday does not match our records.');
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
            const data = {
                empId: state.user.empId || state.user.employeeid || state.user.uuid,
                customname: elements.fileRename.value,
                date: new Date().toLocaleDateString(),
                uuid: Math.random().toString(36).substr(2, 9)
            };
            const result = await postToSheet('documents', data);
            if (result.status === 'success') {
                alert('Document uploaded.');
                state.db = await fetchFullData();
                renderDocuments();
                elements.fileInfo.classList.add('hidden');
            }
            showLoader(false);
        });
    }

    elements.leaveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader(true);
        const data = {
            empId: state.user.empId || state.user.employeeid || state.user.uuid,
            leavetype: document.getElementById('leave-type').value,
            startdate: document.getElementById('leave-start').value,
            enddate: document.getElementById('leave-end').value,
            reason: document.getElementById('leave-reason').value,
            status: 'Pending',
            createdAt: new Date().getTime(),
            uuid: Math.random().toString(36).substr(2, 9)
        };
        const result = await postToSheet('leaves', data);
        if (result.status === 'success') {
            alert('Request Sent.');
            state.db = await fetchFullData();
            switchSubPane('leave-history');
        }
        showLoader(false);
    });

});
