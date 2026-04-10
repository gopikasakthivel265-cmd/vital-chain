const API_URL = 'http://localhost:3000/api';

/**
 * Masks a contact number to display as a hash-like string
 * @param {string} phone 
 * @returns {string} Obfuscated phone number
 */
function maskContact(phone) {
    if (!phone) return 'N/A';
    // Simple hashing-like obfuscation for UX
    // Shows only the last 4 digits, preceded by a 'hash' of the rest
    const last4 = phone.slice(-4);
    const mockHash = btoa(phone.slice(0, -4)).substring(0, 8);
    return `0x${mockHash}...${last4}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    if (!user || user.role !== 'doctor' || !token) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('drName').textContent = user.profile ? user.profile.full_name : user.username;
    document.getElementById('drSpecialty').textContent = user.profile ? user.profile.specialization : 'Medical Professional';
    loadDashboard();
});

let selectedPatient = null;

async function loadDashboard() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/doctor/patients`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success) {
            renderPatients(result.data.patients || result.data); // Handle both formats (result.data.patients or result.data)
        }

        // Also load all registered patients
        loadAllPatients();
    } catch (error) {
        console.error('Error loading doctor dashboard:', error);
    }
}

async function loadAllPatients() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/patients/all`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success) {
            renderAllPatients(result.data);
        }
    } catch (error) {
        console.error('Error loading all registered patients:', error);
    }
}

function renderAllPatients(patients) {
    const listElement = document.getElementById('allRegisteredPatientsList');
    if (!patients || patients.length === 0) {
        listElement.innerHTML = '<div class="empty-state"><i class="ph ph-user-list"></i><p>No registered patients found.</p></div>';
        return;
    }

    // Get currently assigned patients to avoid duplicates or showing "Add" for already assigned
    const assignedPatientIds = Array.from(document.querySelectorAll('#patientList .record-card')).map(card => {
        // This is a bit hacky, normally we'd keep state. 
        // Let's assume we want to show all anyway, or maybe just filter them out.
        // For now, let's just render them all with an "Add" button that handle duplicates on backend.
        return null;
    });

    listElement.innerHTML = patients.map(p => `
        <div class="record-card">
            <div class="record-header">
                <span class="badge ${p.role === 'patient' ? 'badge-blue' : 'badge-green'}">Patient</span>
                <span class="record-date">ID: ${p.patient_id}</span>
            </div>
            <h3>${p.full_name}</h3>
            <div class="record-details">
                <div class="detail-item">
                    <span>Email</span>
                    <span>${p.email}</span>
                </div>
            </div>
            <div class="record-actions" style="margin-top: 15px; display: flex; gap: 8px;">
                <button class="btn-primary" style="padding: 10px 16px; font-size: 0.85rem; width: 50%;" onclick="viewRecords('${p.patient_id}', '${p.full_name}')">
                    View Records
                </button>
                <button class="btn-secondary" style="padding: 10px 16px; font-size: 0.85rem; width: 50%;" onclick="addPatientToDashboard('${p.patient_id}')">
                    <i class="ph ph-plus"></i> Add to Treatment
                </button>
            </div>
        </div>
    `).join('');
}

function renderPatients(patients) {
    const patientList = document.getElementById('patientList');
    if (!patients || patients.length === 0) {
        patientList.innerHTML = '<div class="empty-state"><i class="ph ph-users"></i><p>No patients under treatment. Start by adding a patient.</p></div>';
        return;
    }

    patientList.innerHTML = patients.map(p => `
        <div class="record-card" ${p.status === 'critical' ? 'style="border-left: 5px solid #ef4444;"' : ''}>
            <div class="record-header">
                <span class="badge ${p.status === 'critical' ? 'badge-critical' : 'badge-blue'}">${p.status || 'Active'}</span>
                <span class="record-date">Since: ${new Date(p.started_at).toLocaleDateString()}</span>
            </div>
            <h3>${p.full_name}</h3>
            <div class="record-details">
                <div class="detail-item">
                    <span>Condition</span>
                    <span>${p.diagnosis_category || 'General'}</span>
                </div>
                <div class="detail-item">
                    <span>Contact</span>
                    <span>${maskContact(p.contact_phone)}</span>
                </div>
                ${p.status === 'critical' ? `
                <div class="detail-item">
                    <span>Alert</span>
                    <span style="color: #ef4444; font-weight: 600;">${p.critical_reason || 'Critical'}</span>
                </div>
                ` : ''}
            </div>
            <div class="record-actions" style="margin-top: 15px; display: flex; gap: 8px;">
                <button class="btn-primary" style="padding: 10px 16px; font-size: 0.85rem;" onclick="viewRecords('${p.patient_id}', '${p.full_name}')">
                    View Records
                </button>
                <button class="btn-secondary" style="padding: 10px 16px; font-size: 0.85rem;" onclick="requestAccess('${p.patient_id}')">
                    <i class="ph ph-shield-check"></i> Request Access
                </button>

            </div>
        </div>
    `).join('');
}

// Global Patient Search & Add
function openSearchModal() {
    document.getElementById('searchModal').classList.remove('hidden');
    document.getElementById('patientGlobalSearch').focus();
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.add('hidden');
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('patientGlobalSearch').value = '';
}

async function searchGlobalPatients() {
    const query = document.getElementById('patientGlobalSearch').value;
    if (!query || query.length < 2) {
        alert('Please enter at least 2 characters');
        return;
    }

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Searching...</div>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/patients/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();

        if (result.success) {
            if (result.data.length === 0) {
                resultsDiv.innerHTML = '<div style="text-align: center; color: var(--text-muted);">No patients found</div>';
                return;
            }

            resultsDiv.innerHTML = result.data.map(p => `
                <div class="search-result-item" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <div style="font-weight: 600;">${p.full_name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${p.email} | ID: ${p.patient_id}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary" style="padding: 8px 12px; font-size: 0.8rem;" onclick="addPatientToDashboard('${p.patient_id}')">
                            <i class="ph ph-plus"></i> Add
                        </button>
                        <button class="btn-secondary" style="padding: 8px 12px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="addPatientToDashboard('${p.patient_id}', 'critical')">
                            <i class="ph ph-warning-circle"></i> Critical
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Global search error:', error);
        resultsDiv.innerHTML = `<div style="color: #ef4444;">Error searching database: ${error.message}</div>`;
    }
}

async function addPatientToDashboard(patientId, status = 'active') {
    try {
        let criticalReason = null;
        if (status === 'critical') {
            criticalReason = prompt("Please enter the reason for critical status:");
            if (!criticalReason) return; // Cancel if no reason provided
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/doctor/add-patient`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                patientId, 
                status,
                criticalReason
            })
        });
        const result = await response.json();

        if (result.success || result.message === 'Relationship already exists') {
            alert(result.message || 'Patient added!');
            closeSearchModal();
            loadDashboard();
        } else {
            console.error('Add patient failed:', result);
            alert('Error: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Add patient connectivity error:', error);
        alert('Connectivity issue. Please check console for details.');
    }
}

function viewRecords(patientId, patientName) {
    if (!patientId) {
        alert('Invalid Patient ID');
        return;
    }
    window.location.href = `documents.html?patientId=${patientId}&name=${encodeURIComponent(patientName)}`;
}

async function requestAccess(patientId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/doctor/request-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ patientId })
        });
        const result = await response.json();

        if (result.success) {
            alert('Access request sent on blockchain!');
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error requesting access:', error);
        alert('Connectivity issue');
    }
}

document.getElementById('patientSearch')?.addEventListener('input', (e) => {
    // Implement search filtering if needed
    console.log('Searching for:', e.target.value);
});

async function sendRequest() {
    // This function originally planned for permission request
    // Now it could be used to start a "treatment" relationship
    const patientId = prompt("Enter Patient ID to start treatment:");
    if (!patientId) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/doctor/treat-patient`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ patientId, diagnosisCategory: 'General' })
        });
        const result = await response.json();

        if (result.success) {
            alert('Patient added to your treatment list!');
            loadDashboard();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error starting treatment:', error);
    }
}

async function toggleCriticalStatus(patientId, currentStatus) {
    const newStatus = currentStatus === 'critical' ? 'active' : 'critical';
    const reason = newStatus === 'critical' ? prompt("Reason for critical status:") : null;

    if (newStatus === 'critical' && !reason) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/doctor/update-treatment-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ patientId, status: newStatus, reason })
        });
        const result = await response.json();

        if (result.success) {
            alert(`Patient marked as ${newStatus}`);
            loadDashboard();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Connectivity issue');
    }
}
