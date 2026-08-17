document.addEventListener('DOMContentLoaded', () => {
  const propertyId = 1; // Default property
  let flatpickrInstance = null;

  // DOM Elements
  const loginPanel = document.getElementById('login-panel');
  const dashboardPanel = document.getElementById('dashboard-panel');
  const adminHeader = document.getElementById('admin-header');
  const userDisplay = document.getElementById('user-display');
  const btnLogout = document.getElementById('btn-logout');

  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');

  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.querySelectorAll('.dashboard-section');

  const reservasTableBody = document.getElementById('reservas-table-body');
  const bloquearForm = document.getElementById('bloquear-form');
  const datepickerBloquear = document.getElementById('datepicker-bloquear');
  const bloquearMotivo = document.getElementById('bloquear-motivo');

  const tarifasForm = document.getElementById('tarifas-form');
  const precioNoche = document.getElementById('precio-noche');
  const tasaLimpieza = document.getElementById('tasa-limpieza');

  const notification = document.getElementById('dashboard-notification');

  // Check login state
  const savedUser = localStorage.getItem('adminUser');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      showDashboard(user);
    } catch (e) {
      localStorage.removeItem('adminUser');
    }
  }

  // Handle Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const email = loginEmail.value;
    const password = loginPassword.value;

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();

      if (result.status === 'success') {
        localStorage.setItem('adminUser', JSON.stringify(result.data));
        showDashboard(result.data);
      } else {
        loginError.textContent = result.message || 'Usuario o contraseña incorrectos.';
        loginError.style.display = 'block';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginError.textContent = 'Error de conexión con el servidor.';
      loginError.style.display = 'block';
    }
  });

  // Handle Logout
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('adminUser');
    window.location.reload();
  });

  // Show Dashboard
  function showDashboard(user) {
    loginPanel.style.display = 'none';
    dashboardPanel.style.display = 'grid';
    adminHeader.style.display = 'flex';
    userDisplay.textContent = `${user.nombre} (${user.rol === 'PROPIETARIO' ? 'Propietario' : 'Administrador'})`;

    // Initialize content
    loadReservas();
    loadTarifas();
    initFlatpickr();
  }

  // Sidebar Menu Navigation
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all items
      menuItems.forEach(i => i.classList.remove('active'));
      // Add active to clicked item
      item.classList.add('active');

      // Hide all sections
      sections.forEach(s => s.classList.remove('active'));
      // Show targeted section
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Utility to show temporary dashboard notifications
  function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification notification-${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
      notification.style.display = 'none';
    }, 5000);
  }

  // Load Reservations List
  async function loadReservas() {
    try {
      const response = await fetch(`/api/admin/propiedades/${propertyId}/reservas`);
      const result = await response.json();

      if (result.status === 'success') {
        renderReservasTable(result.data);
      } else {
        reservasTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--primary);">Error al cargar las reservas.</td></tr>`;
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
      reservasTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--primary);">Error de servidor al cargar las reservas.</td></tr>`;
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const day = String(d.getDate() + 1).padStart(2, '0'); // Correct timezone shift for ISO date strings
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function renderReservasTable(reservas) {
    if (!reservas || reservas.length === 0) {
      reservasTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--grey-dark);">No hay reservas ni bloqueos registrados.</td></tr>`;
      return;
    }

    reservasTableBody.innerHTML = '';

    reservas.forEach(res => {
      const tr = document.createElement('tr');

      // Guest details or Block details
      let guestCell = '';
      if (res.estado.startsWith('bloqueado_')) {
        guestCell = `
          <strong>BLOQUEO ADMINISTRATIVO</strong>
          <div class="guest-contact-info">Motivo: ${res.estado === 'bloqueado_limpieza' ? 'Limpieza Especial' : 'Uso Propio / Mantenimiento'}</div>
        `;
      } else {
        guestCell = `
          <strong>${res.huesped_nombre}</strong>
          <div class="guest-contact-info">
            <i class="fa-brands fa-whatsapp"></i> ${res.huesped_contacto} | Residencia: ${res.pais_residencia}
          </div>
        `;
      }

      // Dates cell
      const datesCell = `
        <span class="date-row">Desde: ${formatDate(res.fecha_ingreso)}</span><br>
        <span class="date-row" style="color: var(--grey-dark)">Hasta: ${formatDate(res.fecha_egreso)}</span>
      `;

      // Price total
      const totalCell = res.estado.startsWith('bloqueado_') ? '-' : `R$ ${parseFloat(res.total_cotizacion).toFixed(0)}`;

      // Status badge
      let statusLabel = res.estado;
      if (res.estado === 'bloqueado_limpieza') statusLabel = 'Limpieza';
      if (res.estado === 'bloqueado_mantenimiento') statusLabel = 'Mantenimiento';
      
      const badgeCell = `<span class="badge badge-${res.estado}">${statusLabel}</span>`;

      // Actions buttons
      let actionsCell = '';
      if (res.estado === 'pendiente') {
        actionsCell = `
          <button class="action-btn btn-confirm" data-id="${res.id}" data-action="confirmada">Confirmar</button>
          <button class="action-btn btn-reject" data-id="${res.id}" data-action="rechazada">Rechazar</button>
        `;
      } else if (res.estado === 'confirmada') {
        actionsCell = `
          <button class="action-btn btn-reject" data-id="${res.id}" data-action="rechazada">Cancelar Reserva</button>
        `;
      } else if (res.estado.startsWith('bloqueado_')) {
        actionsCell = `
          <button class="action-btn btn-delete" data-id="${res.id}" data-action="rechazada">Eliminar Bloqueo</button>
        `;
      } else {
        actionsCell = `<span style="color: var(--grey-dark)">Ninguna</span>`;
      }

      tr.innerHTML = `
        <td>${guestCell}</td>
        <td>${datesCell}</td>
        <td>${totalCell}</td>
        <td>${badgeCell}</td>
        <td>${actionsCell}</td>
      `;

      reservasTableBody.appendChild(tr);
    });
  }

  // Event Delegation for action buttons in reservations table
  reservasTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;

    const reservaId = btn.getAttribute('data-id');
    const nuevoEstado = btn.getAttribute('data-action');
    if (reservaId && nuevoEstado) {
      updateStatus(reservaId, nuevoEstado);
    }
  });

  // Update Status function
  async function updateStatus(reservaId, nuevoEstado) {
    let confirmMsg = '¿Estás seguro de que deseas actualizar el estado de esta reserva?';
    if (nuevoEstado === 'confirmada') confirmMsg = '¿Deseas confirmar esta reserva? El calendario se bloqueará automáticamente para estas fechas.';
    if (nuevoEstado === 'rechazada') confirmMsg = '¿Deseas cancelar/eliminar este registro? Las fechas volverán a estar disponibles.';

    if (!confirm(confirmMsg)) return;

    try {
      const response = await fetch(`/api/admin/reservas/${reservaId}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      const result = await response.json();

      if (result.status === 'success') {
        showNotification('Estado actualizado exitosamente.', 'success');
        loadReservas();
      } else {
        showNotification(result.message || 'Error al actualizar el estado.', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showNotification('Error de red al actualizar estado.', 'error');
    }
  }

  // Initialize Flatpickr for Date Blocking
  async function initFlatpickr() {
    try {
      // Fetch currently occupied dates to display them disabled on the blocking calendar too
      const response = await fetch(`/api/propiedades/${propertyId}/disponibilidad`);
      const result = await response.json();
      
      const disableRanges = [];
      if (result.status === 'success') {
        result.data.forEach(range => {
          disableRanges.push({
            from: new Date(range.from),
            to: new Date(range.to)
          });
        });
      }

      if (flatpickrInstance) {
        flatpickrInstance.destroy();
      }

      flatpickrInstance = flatpickr(datepickerBloquear, {
        mode: "range",
        minDate: "today",
        dateFormat: "Y-m-d",
        locale: "es",
        disable: disableRanges,
        onChange: function(selectedDates) {
          // Additional custom range checks if needed
        }
      });
    } catch (error) {
      console.error('Error initializing Flatpickr:', error);
    }
  }

  // Handle date blocking submission
  bloquearForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!flatpickrInstance || flatpickrInstance.selectedDates.length < 2) {
      showNotification('Por favor, selecciona un rango de fechas válido (ingreso y egreso).', 'error');
      return;
    }

    const start = flatpickrInstance.selectedDates[0];
    const end = flatpickrInstance.selectedDates[1];

    // Helper to format Date to ISO String YYYY-MM-DD
    const formatDateISO = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const payload = {
      fecha_ingreso: formatDateISO(start),
      fecha_egreso: formatDateISO(end),
      motivo: bloquearMotivo.value
    };

    try {
      const response = await fetch(`/api/admin/propiedades/${propertyId}/bloquear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.status === 'success') {
        showNotification('Fechas bloqueadas con éxito en el sistema.', 'success');
        bloquearForm.reset();
        loadReservas();
        initFlatpickr(); // reload disabled dates
        // switch back to reservations list after blocking successfully
        setTimeout(() => {
          document.querySelector('.menu-item[data-target="section-reservas"]').click();
        }, 1000);
      } else {
        showNotification(result.message || 'Error al bloquear fechas.', 'error');
      }
    } catch (error) {
      console.error('Error blocking dates:', error);
      showNotification('Error de servidor al bloquear fechas.', 'error');
    }
  });

  // Load current rates
  async function loadTarifas() {
    try {
      const response = await fetch(`/api/propiedades/${propertyId}`);
      const result = await response.json();

      if (result.status === 'success') {
        precioNoche.value = parseFloat(result.data.precio_base_noche).toFixed(0);
        tasaLimpieza.value = parseFloat(result.data.tasa_limpieza).toFixed(0);
      }
    } catch (error) {
      console.error('Error loading rates:', error);
    }
  }

  // Handle rates form submission
  tarifasForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      precio_base_noche: parseFloat(precioNoche.value),
      tasa_limpieza: parseFloat(tasaLimpieza.value)
    };

    try {
      const response = await fetch(`/api/admin/propiedades/${propertyId}/tarifas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.status === 'success') {
        showNotification('Tarifas actualizadas correctamente.', 'success');
      } else {
        showNotification(result.message || 'Error al actualizar tarifas.', 'error');
      }
    } catch (error) {
      console.error('Error updating rates:', error);
      showNotification('Error de servidor al actualizar tarifas.', 'error');
    }
  });
});
