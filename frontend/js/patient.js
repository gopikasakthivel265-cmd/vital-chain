const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    if (!user || user.role !== 'patient' || !token) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userName').textContent = user.profile ? user.profile.full_name : user.username;

    // Check wallet status
    if (!user.walletAddress || user.walletAddress === '') {
        document.getElementById('walletWarning')?.classList.remove('hidden');
    }

    loadDashboard();
});

// Toast System
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? 'ph-check-circle' : (type === 'error' ? 'ph-warning-circle' : 'ph-info');

    toast.innerHTML = `
        <i class="ph ${icon}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function loadDashboard() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/patient/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success) {
            // Updated to match Python API response structure
            renderRecords(result.data.records);
            renderDoctors(result.data.doctors);
            populateDoctorDropdown(result.data.doctors);
            renderRequests(result.data.pendingRequests);
        } else {
            console.error('Failed to load dashboard:', result.message);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderRecords(records) {
    const recordsList = document.getElementById('recordsList');
    if (!records || records.length === 0) {
        recordsList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No records found. Upload your first medical record!</p>';
        return;
    }

    recordsList.innerHTML = records.map((record, index) => {
        // Calculate if this record is "new" (uploaded in the last 2 minutes)
        const isNew = (Date.now() - new Date(record.created_at).getTime()) < 120000;

        return `
        <div class="record-card ${isNew ? 'record-new' : ''}">
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
                <div class="detail-item">
                    <span>ID</span>
                    <span>#${record.record_id}</span>
                </div>
                <div class="detail-item" style="flex-direction: column; align-items: flex-start; gap: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; margin-top: 4px;">
                    <span style="font-size: 0.7rem; color: var(--text-muted);">Record Hash (SHA-256)</span>
                    <span style="font-family: monospace; font-size: 0.65rem; word-break: break-all; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 4px; width: 100%; border: 1px solid rgba(255,255,255,0.05);">${record.record_hash || 'Pending...'}</span>
                </div>
            </div>
            <div class="card-footer" style="padding: 0; min-height: 10px;">
                <!-- Records are view-only for doctors with permission -->
            </div>
        </div>
    `;
    }).join('');
}

function renderRequests(requests) {
    const requestsList = document.getElementById('requestsList');
    if (!requests || requests.length === 0) {
        requestsList.innerHTML = '<p style="color: var(--text-muted);">No pending access requests.</p>';
        return;
    }

    requestsList.innerHTML = requests.map(req => `
        <div class="request-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.1);">
            <div>
                <div style="font-weight: 600;">Dr. ${req.doctor_name || 'Unknown Doctor'}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${req.specialization || ''}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Requested: ${new Date(req.requested_at).toLocaleString()}</div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-primary" style="padding: 8px 15px; font-size: 0.8rem;" onclick="respondToRequest(${req.request_id}, true)">Approve</button>
                <button class="btn-secondary" style="padding: 8px 15px; font-size: 0.8rem;" onclick="respondToRequest(${req.request_id}, false)">Reject</button>
            </div>
        </div>
    `).join('');
}

async function respondToRequest(requestId, approve) {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_URL}/patient/respond-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ requestId, approve })
        });
        const result = await response.json();

        if (result.success) {
            showToast('Success', `Request ${approve ? 'approved' : 'rejected'}!`, 'success');
            loadDashboard(); // Refresh
        } else {
            showToast('Error', result.message, 'error');
        }
    } catch (error) {
        console.error('Error responding to request:', error);
        showToast('Error', 'Connectivity issue', 'error');
    }
}

function renderDoctors(doctors) {
    const doctorsList = document.getElementById('doctorsList');
    if (!doctors || doctors.length === 0) {
        doctorsList.innerHTML = '<p style="color: var(--text-muted); width: 100%; text-align: center;">No assigned doctors yet. You can link one during record upload.</p>';
        return;
    }

    doctorsList.innerHTML = doctors.map(d => `
        <div class="doctor-pill" style="background: rgba(255,255,255,0.05); padding: 10px 20px; border-radius: 50px; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <div class="avatar-small" style="width: 30px; height: 30px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">${d.full_name.charAt(0)}</div>
            <div>
                <div style="font-weight: 600; font-size: 0.9rem;">Dr. ${d.full_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${d.specialization}</div>
            </div>
        </div>
    `).join('');
}

function populateDoctorDropdown(doctors) {
    const dropdown = document.getElementById('uploadDoctor');
    if (!dropdown) return;

    const options = doctors.map(d => `<option value="${d.doctor_id}">Dr. ${d.full_name} (${d.specialization})</option>`).join('');
    dropdown.innerHTML = '<option value="">Select Doctor (if applicable)</option>' + options;
}

function openUploadModal() {
    document.getElementById('uploadModal').classList.remove('hidden');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    if (!user || !token) {
        showToast('Auth Error', 'You must be logged in to upload records.', 'error');
        return;
    }

    const title = document.getElementById('caseName').value;
    const type = 'diagnosis';
    const file = document.getElementById('recordFile').files[0];

    if (!file) {
        showToast('Selection Error', 'Please select a file to upload.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('recordTitle', title);
    formData.append('recordType', type);
    formData.append('file', file);

    const doctorId = document.getElementById('uploadDoctor').value;
    if (doctorId) {
        formData.append('doctorId', doctorId);
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.innerHTML = '<div class="spinner"></div> Uploading...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/patient/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'Server responded with an error');
        }

        const result = await response.json();

        if (result.success || result.status === 'success') {
            showToast('Upload Successful', 'Your record has been secured.', 'success');
            document.getElementById('uploadForm').reset();
            closeUploadModal();

            // Refresh dashboard in background, don't block success message
            loadDashboard().catch(e => console.error('Dashboard refresh failed after upload:', e));
        } else {
            showToast('Upload Failed', result.message || 'Verification failed', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload Error', error.message || 'Could not reach the server.', 'error');
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
});
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
            showToast('Download Error', error.message, 'error');
        }
    } catch (error) {
        console.error('Download error:', error);
        showToast('Download Error', 'Connectivity issue', 'error');
    }
}
