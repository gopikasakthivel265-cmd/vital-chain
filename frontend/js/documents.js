const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    if (!user || !token) {
        window.location.href = 'index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('patientId');
    const patientName = urlParams.get('name');

    if (patientName) {
        document.querySelector('h2').textContent = `Records: ${patientName}`;
    }

    loadDocuments(patientId);
});

async function loadDocuments(patientId) {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    let endpoint = '';

    if (user.role === 'patient') {
        endpoint = `${API_URL}/patient/dashboard`;
    } else if (user.role === 'doctor') {
        if (patientId) {
            endpoint = `${API_URL}/doctor/patient/${patientId}/records`;
        } else {
            endpoint = `${API_URL}/doctor/dashboard`;
        }
    }

    try {
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 403) {
            const result = await response.json();
            const recordsGrid = document.querySelector('.records-grid');
            recordsGrid.innerHTML = `
                <div class="empty-state" style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05);">
                    <i class="ph ph-lock-key" style="color: #ef4444;"></i>
                    <h3 style="color: #ef4444; margin-top: 15px;">Access Denied</h3>
                    <p>Blockchain verification failed. You need patient approval to view these records.</p>
                    <button class="btn-primary" style="margin-top: 15px;" onclick="window.location.href='doctor-dashboard.html'">Back to Dashboard</button>
                </div>`;
            return;
        }

        const result = await response.json();

        if (result.success) {
            let records = [];
            if (user.role === 'patient') {
                // Python API returns { success: true, data: [...] }
                records = result.data.records || [];
            } else if (user.role === 'doctor') {
                records = patientId ? result.data : (result.data ? result.data.accessibleRecords : []);
            }
            renderRecords(records);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

function renderRecords(records) {
    const recordsGrid = document.querySelector('.records-grid');
    if (!records || records.length === 0) {
        recordsGrid.innerHTML = '<div class="empty-state"><i class="ph ph-files"></i><p>No documents found.</p></div>';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    const isPatient = user && user.role === 'patient';

    recordsGrid.innerHTML = records.map(record => `
        <div class="record-card">
            <div class="record-header">
                <span class="badge ${record.is_verified ? 'badge-verified' : 'badge-blue'}">
                    ${record.is_verified ? 'Blockchain Verified' : 'Uploaded'}
                </span>
                <span class="record-date">${new Date(record.created_at).toLocaleDateString()}</span>
            </div>
            <h3>${record.record_title}</h3>
            <div class="record-details">
                <div class="detail-item">
                    <span>Type</span>
                    <span>${record.record_type}</span>
                </div>
            </div>
            <div class="record-actions" ${isPatient ? 'style="margin-top: 10px;"' : ''}>
                ${isPatient ?
            `<div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 0.75rem; color: var(--accent); border: 1px solid rgba(255,255,255,0.05);">
                    <div style="color: var(--text-muted); font-size: 0.7rem; margin-bottom: 4px; text-transform: uppercase; font-family: 'Outfit', sans-serif;">SHA-256 Secure Hash</div>
                    ${record.record_hash || 'Pending Network Verification...'}
                </div>` :
            (record.download_url ?
                `<a href="${record.download_url}" target="_blank" class="btn-primary" style="text-decoration: none; display: inline-block; padding: 10px 15px; font-size: 0.8rem;">View in Cloud</a>` :
                `<div style="display: flex; gap: 8px;">
                    <button class="btn-primary" style="padding: 10px 15px; font-size: 0.8rem; flex: 1;" onclick="downloadLocal('${record.record_id}', true)">View</button>
                </div>`)
        }
            </div>
        </div>
    `).join('');
}

async function modifyRecord(recordId) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/doctor/record/${recordId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                alert('Record modified successfully!');
                const urlParams = new URLSearchParams(window.location.search);
                loadDocuments(urlParams.get('patientId'));
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Modification error:', error);
            alert('Connectivity issue during modification');
        }
    };
    fileInput.click();
}

async function downloadLocal(recordId, viewInTab = false) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/record/${recordId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            if (viewInTab) {
                window.open(url, '_blank');
                // We don't revoke here immediately as the new tab needs time to load it
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `medical_record_${recordId}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } else {
            const error = await response.json();
            alert(`Download failed: ${error.message}`);
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Connectivity issue during download');
    }
}
