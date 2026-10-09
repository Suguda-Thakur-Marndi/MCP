/**
 * MCP-Sentinel Website & Human Approval Console Logic
 * Client-side script handling copy buttons, public navigation,
 * and out-of-band approval API communication.
 */

(function () {
  'use strict';

  // Base API configuration: default to port 8000 or same-origin
  const API_BASE = window.SENTINEL_API_BASE || 
    (window.location.port === '8000' ? '' : 'http://localhost:8000');

  // State
  let currentUser = null;
  let authToken = localStorage.getItem('sentinel_token') || null;
  let activeTicket = null;
  let countdownInterval = null;

  /* ==============================================================================
     1. Common Utilities & Code Copy Buttons
     ============================================================================== */
  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const textToCopy = btn.getAttribute('data-copy');
        if (!textToCopy) return;

        try {
          await navigator.clipboard.writeText(textToCopy);
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
          }, 2000);
        } catch (err) {
          console.error('Clipboard copy failed:', err);
        }
      });
    });
  }

  /* ==============================================================================
     2. API Client with JWT Bearer Authentication
     ============================================================================== */
  async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      headers['X-CSRF-Token'] = 'sentinel-csrf-token';
    }

    try {
      const resp = await fetch(url, { ...options, headers });
      if (!resp.ok) {
        let errData = {};
        try { errData = await resp.json(); } catch (_) {}
        const error = new Error(errData.detail || `API request failed with status ${resp.status}`);
        error.status = resp.status;
        error.data = errData;
        throw error;
      }
      return await resp.json();
    } catch (err) {
      console.warn(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  /* ==============================================================================
     3. Authentication Lifecycle
     ============================================================================== */
  async function checkAuth() {
    if (!authToken) {
      renderUnauthenticated();
      return;
    }

    try {
      const user = await apiFetch('/api/auth/me');
      currentUser = user;
      renderAuthenticated(user);
    } catch (err) {
      console.warn('Session check failed; clearing stored token');
      localStorage.removeItem('sentinel_token');
      authToken = null;
      currentUser = null;
      renderUnauthenticated();
    }
  }

  async function loginWithToken(idToken) {
    try {
      const resp = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          id_token: idToken,
          provider: 'mock'
        })
      });

      authToken = resp.access_token;
      localStorage.setItem('sentinel_token', authToken);
      currentUser = resp.user;
      renderAuthenticated(currentUser);
      closeAuthModal();
      
      // Refresh tickets post-login
      loadPendingApprovals();
      return resp;
    } catch (err) {
      alert(`Authentication failed: ${err.message}`);
      throw err;
    }
  }

  async function logout() {
    try {
      if (authToken) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
    } catch (_) {}
    localStorage.removeItem('sentinel_token');
    authToken = null;
    currentUser = null;
    renderUnauthenticated();
    loadPendingApprovals();
  }

  function renderAuthenticated(user) {
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const badgeEl = document.getElementById('userRoleBadge');
    const avatarEl = document.getElementById('userAvatar');
    const btnAuth = document.getElementById('btnAuthAction');

    if (nameEl) nameEl.textContent = user.name || user.email;
    if (emailEl) emailEl.textContent = user.email;
    if (badgeEl) {
      badgeEl.textContent = user.role;
      badgeEl.style.display = 'inline-block';
      badgeEl.className = `badge-risk ${user.role === 'ADMIN' ? 'risk-low' : 'risk-medium'}`;
    }
    if (avatarEl) {
      avatarEl.textContent = (user.name || user.email || 'U')[0].toUpperCase();
    }
    if (btnAuth) {
      btnAuth.textContent = 'Logout';
      btnAuth.className = 'btn btn-secondary btn-sm';
    }
  }

  function renderUnauthenticated() {
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const badgeEl = document.getElementById('userRoleBadge');
    const avatarEl = document.getElementById('userAvatar');
    const btnAuth = document.getElementById('btnAuthAction');

    if (nameEl) nameEl.textContent = 'Not Authenticated';
    if (emailEl) emailEl.textContent = '(Login required to approve)';
    if (badgeEl) badgeEl.style.display = 'none';
    if (avatarEl) avatarEl.textContent = '?';
    if (btnAuth) {
      btnAuth.textContent = 'Login';
      btnAuth.className = 'btn btn-primary btn-sm';
    }
  }

  /* ==============================================================================
     4. Health Check
     ============================================================================== */
  async function checkBackendHealth() {
    const badge = document.getElementById('apiStatusBadge');
    const text = document.getElementById('apiStatusText');
    if (!badge || !text) return;

    try {
      const res = await fetch(`${API_BASE}/health/live`);
      if (res.ok) {
        badge.style.color = 'var(--accent)';
        text.textContent = 'Backend Online (Port 8000)';
      } else {
        badge.style.color = 'var(--warning)';
        text.textContent = `Degraded (${res.status})`;
      }
    } catch (_) {
      badge.style.color = 'var(--danger)';
      text.textContent = 'Backend Offline';
    }
  }

  /* ==============================================================================
     5. Pending Approvals Queue
     ============================================================================== */
  async function loadPendingApprovals() {
    const tbody = document.getElementById('pendingTableBody');
    const countBadge = document.getElementById('pendingCountBadge');
    if (!tbody) return;

    try {
      const tickets = await apiFetch('/api/approvals/pending');
      if (countBadge) countBadge.textContent = tickets.length;

      if (!tickets || tickets.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-dim);">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 0.5rem; color: var(--accent);">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>No pending approval tickets. All actions are clear.</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = tickets.map(t => {
        const riskClass = t.risk_score >= 70 ? 'risk-critical' : (t.risk_score >= 40 ? 'risk-medium' : 'risk-low');
        const reqTime = t.created_at ? new Date(t.created_at).toLocaleTimeString() : 'N/A';
        return `
          <tr data-ticket-id="${t.ticket_id}">
            <td><code class="tool-name">${escapeHtml(t.ticket_id.slice(0, 16))}...</code></td>
            <td><strong>${escapeHtml(t.tool_name)}</strong></td>
            <td><code>${escapeHtml(t.target_id || 'N/A')}</code></td>
            <td><span class="badge-risk ${riskClass}">${t.risk_score} (${t.risk_score >= 70 ? 'CRITICAL' : 'MEDIUM'})</span></td>
            <td>${reqTime}</td>
            <td><span class="countdown-timer" data-expires="${t.expires_at || ''}">Calculating...</span></td>
            <td>
              <button class="btn btn-primary btn-sm btn-review-ticket" data-ticket="${encodeURIComponent(JSON.stringify(t))}">
                Review &amp; Sign
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Attach review click handlers
      tbody.querySelectorAll('.btn-review-ticket').forEach(btn => {
        btn.addEventListener('click', () => {
          const ticketData = JSON.parse(decodeURIComponent(btn.getAttribute('data-ticket')));
          openDetailModal(ticketData);
        });
      });

      startCountdownTimers();
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
            Failed to load pending tickets: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }

  function startCountdownTimers() {
    if (countdownInterval) clearInterval(countdownInterval);

    function update() {
      document.querySelectorAll('.countdown-timer').forEach(el => {
        const expStr = el.getAttribute('data-expires');
        if (!expStr) {
          el.textContent = 'No Expiry';
          return;
        }

        const expTime = new Date(expStr).getTime();
        const diff = Math.max(0, Math.floor((expTime - Date.now()) / 1000));

        if (diff <= 0) {
          el.textContent = 'EXPIRED';
          el.classList.add('expired');
        } else {
          const m = Math.floor(diff / 60);
          const s = diff % 60;
          el.textContent = `${m}m ${s.toString().padStart(2, '0')}s`;
          el.classList.remove('expired');
        }
      });
    }

    update();
    countdownInterval = setInterval(update, 1000);
  }

  /* ==============================================================================
     6. Detail View Modal & Approval Decision Execution
     ============================================================================== */
  function openDetailModal(ticket) {
    activeTicket = ticket;
    const modal = document.getElementById('detailModal');
    if (!modal) return;

    document.getElementById('modalTitle').textContent = `Review: ${ticket.tool_name}`;
    document.getElementById('modalTicketId').textContent = ticket.ticket_id;
    document.getElementById('modalParamHash').textContent = ticket.parameter_hash || 'SHA-256 hash not computed';
    
    const paramsFormatted = typeof ticket.parameters === 'object' 
      ? JSON.stringify(ticket.parameters, null, 2) 
      : String(ticket.parameters || '{}');
    document.getElementById('modalParams').textContent = paramsFormatted;

    document.getElementById('modalReason').textContent = ticket.reason || 'No justification provided by requester.';
    document.getElementById('modalDecisionNotes').value = '';

    // Show/hide critical warning banner
    const isCritical = (ticket.risk_score >= 70) || 
      ['delete_customer', 'purge_inactive_customer_data'].includes(ticket.tool_name);
    const warnBanner = document.getElementById('modalCriticalWarning');
    if (warnBanner) {
      warnBanner.style.display = isCritical ? 'flex' : 'none';
    }

    modal.classList.add('open');
  }

  function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.remove('open');
    activeTicket = null;
  }

  async function executeDecision(decision) {
    if (!activeTicket) return;
    if (!currentUser) {
      alert('Authentication required: You must log in as an APPROVER or ADMIN to authorize tickets.');
      openAuthModal();
      return;
    }

    const notes = document.getElementById('modalDecisionNotes').value.trim();
    const ticketId = activeTicket.ticket_id;

    const endpoint = decision === 'APPROVED' 
      ? `/api/approvals/${ticketId}/approve` 
      : `/api/approvals/${ticketId}/deny`;

    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          decision_notes: notes || undefined
        })
      });

      alert(`Success: Ticket ${ticketId} has been ${decision} by ${currentUser.email}.`);
      closeDetailModal();
      loadPendingApprovals();
      loadAllTickets();
      loadAuditLog();
    } catch (err) {
      alert(`Decision rejected: ${err.message}`);
    }
  }

  /* ==============================================================================
     7. Audit Log Stream
     ============================================================================== */
  async function loadAuditLog() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    const tool = document.getElementById('filterTool') ? document.getElementById('filterTool').value : '';
    const decision = document.getElementById('filterDecision') ? document.getElementById('filterDecision').value : '';

    let query = '/api/audit/events?limit=50';
    if (tool) query += `&tool_name=${encodeURIComponent(tool)}`;
    if (decision) query += `&decision=${encodeURIComponent(decision)}`;

    try {
      const data = await apiFetch(query);
      const events = data.events || [];

      if (events.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
              No audit events matched the filter criteria.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = events.map(e => {
        const time = e.created_at ? new Date(e.created_at).toLocaleString() : 'N/A';
        const decClass = e.decision === 'ALLOW' || e.decision === 'APPROVED' ? 'risk-low' : (e.decision === 'REQUIRE_APPROVAL' ? 'risk-cond' : 'risk-critical');
        return `
          <tr>
            <td><code>${escapeHtml(String(e.id || '').slice(0, 8))}</code></td>
            <td style="font-size: 0.82rem;">${time}</td>
            <td><span class="step-badge badge-block">${escapeHtml(e.event_type || 'TOOL_EXEC')}</span></td>
            <td><code class="tool-name">${escapeHtml(e.tool_name || 'N/A')}</code></td>
            <td><span class="badge-risk ${decClass}">${escapeHtml(e.decision || 'N/A')}</span></td>
            <td><code>${escapeHtml(e.actor_id || 'system')}</code></td>
            <td><code style="font-size: 0.78rem;">${escapeHtml(e.request_id || 'N/A')}</code></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-dim);">
            ${err.status === 401 || err.status === 403 ? 'Authentication required to inspect audit events.' : `Audit query error: ${escapeHtml(err.message)}`}
          </td>
        </tr>
      `;
    }
  }

  /* ==============================================================================
     8. Ticket History (All Statuses)
     ============================================================================== */
  async function loadAllTickets() {
    const tbody = document.getElementById('allTicketsTableBody');
    if (!tbody) return;

    try {
      const tickets = await apiFetch('/api/approvals?limit=50');
      if (!tickets || tickets.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
              No historical tickets recorded.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = tickets.map(t => {
        const statusClass = t.status === 'APPROVED' ? 'risk-low' : (t.status === 'PENDING' ? 'risk-cond' : (t.status === 'DENIED' ? 'risk-critical' : 'badge-block'));
        const time = t.updated_at || t.created_at ? new Date(t.updated_at || t.created_at).toLocaleString() : 'N/A';
        return `
          <tr>
            <td><code class="tool-name">${escapeHtml(t.ticket_id.slice(0, 16))}...</code></td>
            <td><strong>${escapeHtml(t.tool_name)}</strong></td>
            <td><code>${escapeHtml(t.target_id || 'N/A')}</code></td>
            <td><span class="badge-risk ${statusClass}">${escapeHtml(t.status)}</span></td>
            <td><code>${escapeHtml(t.requester_id || 'agent')}</code></td>
            <td><code>${escapeHtml(t.approver_id || 'pending')}</code></td>
            <td style="font-size: 0.82rem;">${time}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-dim);">
            Failed to load ticket history: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }

  /* ==============================================================================
     9. Modal & Tab Event Handlers
     ============================================================================== */
  function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('open');
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
  }

  function setupTabs() {
    const tabPending = document.getElementById('tabPendingBtn');
    const tabAudit = document.getElementById('tabAuditBtn');
    const tabAll = document.getElementById('tabAllTicketsBtn');

    const pPending = document.getElementById('pendingPanel');
    const pAudit = document.getElementById('auditPanel');
    const pAll = document.getElementById('allTicketsPanel');

    if (!tabPending || !tabAudit || !tabAll) return;

    tabPending.addEventListener('click', () => {
      tabPending.classList.add('active');
      tabAudit.classList.remove('active');
      tabAll.classList.remove('active');
      pPending.style.display = 'block';
      pAudit.style.display = 'none';
      pAll.style.display = 'none';
      loadPendingApprovals();
    });

    tabAudit.addEventListener('click', () => {
      tabAudit.classList.add('active');
      tabPending.classList.remove('active');
      tabAll.classList.remove('active');
      pAudit.style.display = 'block';
      pPending.style.display = 'none';
      pAll.style.display = 'none';
      loadAuditLog();
    });

    tabAll.addEventListener('click', () => {
      tabAll.classList.add('active');
      tabPending.classList.remove('active');
      tabAudit.classList.remove('active');
      pAll.style.display = 'block';
      pPending.style.display = 'none';
      pAudit.style.display = 'none';
      loadAllTickets();
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ==============================================================================
     10. Initialization
     ============================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initCopyButtons();
    checkBackendHealth();

    // If on console page
    if (document.getElementById('pendingTable')) {
      setupTabs();
      checkAuth();
      loadPendingApprovals();

      // Refresh button
      const btnRefresh = document.getElementById('btnRefresh');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
          loadPendingApprovals();
          loadAuditLog();
          loadAllTickets();
          checkBackendHealth();
        });
      }

      // Auth trigger button
      const btnAuth = document.getElementById('btnAuthAction');
      if (btnAuth) {
        btnAuth.addEventListener('click', () => {
          if (currentUser) {
            logout();
          } else {
            openAuthModal();
          }
        });
      }

      // Quick login buttons
      const btnAdmin = document.getElementById('btnQuickLoginAdmin');
      if (btnAdmin) {
        btnAdmin.addEventListener('click', () => {
          loginWithToken('test-token:admin@sentinel.test:ADMIN');
        });
      }

      const btnApprover = document.getElementById('btnQuickLoginApprover');
      if (btnApprover) {
        btnApprover.addEventListener('click', () => {
          loginWithToken('test-token:approver@sentinel.test:APPROVER');
        });
      }

      const btnCustom = document.getElementById('btnSubmitCustomAuth');
      if (btnCustom) {
        btnCustom.addEventListener('click', () => {
          const val = document.getElementById('customIdToken').value.trim();
          if (val) loginWithToken(val);
        });
      }

      // Close auth modal
      const btnCloseAuth = document.getElementById('btnCloseAuthModal');
      const btnCancelAuth = document.getElementById('btnCancelAuth');
      if (btnCloseAuth) btnCloseAuth.addEventListener('click', closeAuthModal);
      if (btnCancelAuth) btnCancelAuth.addEventListener('click', closeAuthModal);

      // Decision buttons
      const btnApprove = document.getElementById('btnApproveTicket');
      if (btnApprove) btnApprove.addEventListener('click', () => executeDecision('APPROVED'));

      const btnReject = document.getElementById('btnRejectTicket');
      if (btnReject) btnReject.addEventListener('click', () => executeDecision('DENIED'));

      // Close detail modal
      const btnCloseModal = document.getElementById('btnCloseModal');
      const btnCancelModal = document.getElementById('btnCancelModal');
      if (btnCloseModal) btnCloseModal.addEventListener('click', closeDetailModal);
      if (btnCancelModal) btnCancelModal.addEventListener('click', closeDetailModal);

      // Audit filter button
      const btnAuditFilter = document.getElementById('btnApplyAuditFilters');
      if (btnAuditFilter) btnAuditFilter.addEventListener('click', loadAuditLog);
    }
  });

})();
