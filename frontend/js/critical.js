const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    if (!user || user.role !== 'doctor' || !token) {
        window.location.href = 'index.html';
        return;
    }

    loadCriticalPatients();
});

async function loadCriticalPatients() {
    const criticalList = document.getElementById('criticalList');
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/doctor/critical-patients`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success) {
            renderCriticalPatients(result.data);
        } else {
            console.error('Failed to load critical patients:', result.message);
            criticalList.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-warning"></i>
                    <p>Error loading critical patients.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching critical patients:', error);
        criticalList.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-warning"></i>
                <p>Unable to connect to server.</p>
            </div>
        `;
    }
}

function renderCriticalPatients(patients) {
    const criticalList = document.getElementById('criticalList');

    if (!patients || patients.length === 0) {
        criticalList.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-shield-check"></i>
                <p>No critical patients at the moment.</p>
            </div>
        `;
        return;
    }

    criticalList.innerHTML = patients.map(p => `
        <div class="record-card" style="border-color: #ef4444;">
            <div class="record-header">
                <span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);">Critical Status</span>
                <span class="record-date">Since: ${new Date(p.started_at).toLocaleDateString()}</span>
            </div>
            <h3>${p.full_name}</h3>
            <div class="record-details">
                <div class="detail-item">
                    <span>Alert Reason</span>
                    <span style="color: #ef4444; font-weight: 600;">${p.critical_reason || 'No reason specified'}</span>
                </div>
                <div class="detail-item">
                    <span>Condition</span>
                    <span>${p.diagnosis_category || 'General'}</span>
                </div>
                <div class="detail-item">
                    <span>Vitals</span>
                    <span>Contact: ${p.contact_phone || 'N/A'}</span>
                </div>
            </div>
            <div class="record-actions" style="margin-top: 1rem; display: flex; gap: 10px;">
                <button class="btn-primary" style="background: #ef4444;" onclick="initiateEmergency('${p.patient_id}', '${p.full_name}')">
                    Initiate Emergency Contact
                </button>
                <button class="btn-secondary" onclick="markStable('${p.patient_id}')">
                    Mark Stable
                </button>
            </div>
        </div>
    `).join('');
}

async function markStable(patientId) {
    if (!confirm('Are you sure you want to mark this patient as stable?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/doctor/update-treatment-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ patientId, status: 'active' })
        });
        const result = await response.json();

        if (result.success) {
            alert('Patient marked as stable.');
            loadCriticalPatients();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error marking patient stable:', error);
    }
}

function initiateEmergency(patientId, patientName) {
    alert(`Emergency protocol initiated for ${patientName}. Emergency contacts have been notified (simulated).`);
}
