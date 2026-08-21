document.addEventListener('DOMContentLoaded', () => {
  const propertyId = 1; // Hardcoded pilot property for Phase 1
  let propertyData = null;
  let flatpickrInstance = null;

  let allPhotosList = [];

  // DOM Elements
  const propTitle = document.getElementById('prop-title');
  const propLocation = document.getElementById('prop-location');
  const propDescription = document.getElementById('prop-description');
  const pricePerNight = document.getElementById('price-per-night');
  const datepicker = document.getElementById('datepicker');
  
  const priceBreakdown = document.getElementById('price-breakdown');
  const nightsCalc = document.getElementById('nights-calc');
  const subtotalAmount = document.getElementById('subtotal-amount');
  const cleaningAmount = document.getElementById('cleaning-amount');
  const totalAmount = document.getElementById('total-amount');
  
  const guestName = document.getElementById('guest-name');
  const guestContact = document.getElementById('guest-contact');
  const guestCountry = document.getElementById('guest-country');
  const btnSubmit = document.getElementById('btn-submit-booking');
  
  const reviewsList = document.getElementById('reviews-list');
  const reviewsAvg = document.getElementById('reviews-avg');
  const reviewsCount = document.getElementById('reviews-count');

  // State variables
  let selectedDates = [];

  // Fetch Property Info
  async function fetchProperty() {
    try {
      const response = await fetch(`/api/propiedades/${propertyId}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        propertyData = result.data;
        renderPropertyInfo();
        fetchDisponibilidad();
      }
    } catch (error) {
      console.error("Error fetching property details:", error);
    }
  }

  function renderPropertyInfo() {
    if (!propertyData) return;
    propTitle.textContent = propertyData.nombre;
    propLocation.textContent = propertyData.ubicacion;
    propDescription.textContent = propertyData.descripcion;
    pricePerNight.textContent = `${propertyData.moneda} ${parseFloat(propertyData.precio_base_noche).toFixed(0)}`;

    allPhotosList = propertyData.fotos || [];

    // Set photos dynamically in the main grid
    if (allPhotosList.length > 0) {
      const mainPhoto = allPhotosList.find(f => f.es_principal) || allPhotosList[0];
      const otherPhotos = allPhotosList.filter(f => f !== mainPhoto);
      const gridPhotos = [mainPhoto, ...otherPhotos].filter(Boolean);

      // Set main image
      const imgMain = document.getElementById('img-main');
      if (imgMain && gridPhotos[0]) {
        imgMain.src = gridPhotos[0].url_imagen;
        const parent = imgMain.closest('.gallery-item');
        if (parent) {
          parent.onclick = () => {
            const globalIndex = allPhotosList.findIndex(f => f.url_imagen === gridPhotos[0].url_imagen);
            openLightbox(globalIndex >= 0 ? globalIndex : 0);
          };
        }
      }

      // Set side images (1 to 4)
      for (let i = 1; i <= 4; i++) {
        const sideImg = document.getElementById(`img-side${i}`);
        if (sideImg) {
          if (gridPhotos[i]) {
            sideImg.src = gridPhotos[i].url_imagen;
            const parent = sideImg.closest('.gallery-item');
            if (parent) {
              parent.style.display = '';
              parent.onclick = () => {
                const globalIndex = allPhotosList.findIndex(f => f.url_imagen === gridPhotos[i].url_imagen);
                openLightbox(globalIndex >= 0 ? globalIndex : i);
              };
            }
          } else {
            const parent = sideImg.closest('.gallery-item');
            if (parent) parent.style.display = 'none';
          }
        }
      }
    }

    // Populate All Photos Grid and Count
    const totalCountSpan = document.getElementById('photos-total-count');
    if (totalCountSpan) {
      totalCountSpan.textContent = allPhotosList.length;
    }

    const allPhotosGrid = document.getElementById('all-photos-grid');
    if (allPhotosGrid) {
      allPhotosGrid.innerHTML = '';
      allPhotosList.forEach((photo, idx) => {
        const item = document.createElement('div');
        item.className = 'all-photos-item';
        item.innerHTML = `<img src="${photo.url_imagen}" alt="Foto del Departamento ${idx + 1}" loading="lazy">`;
        item.onclick = () => {
          openLightbox(idx);
        };
        allPhotosGrid.appendChild(item);
      });
    }
  }

  // Fetch Occupied Dates for Calendar Blockout
  async function fetchDisponibilidad() {
    try {
      const response = await fetch(`/api/propiedades/${propertyId}/disponibilidad`);
      const result = await response.json();
      
      if (result.status === 'success') {
        const ranges = result.data.map(r => ({
          from: new Date(r.from),
          to: new Date(r.to)
        }));
        initCalendar(ranges);
      }
    } catch (error) {
      console.error("Error fetching availability:", error);
      initCalendar([]);
    }
  }

  // Initialize Flatpickr Calendar
  function initCalendar(disabledRanges) {
    if (flatpickrInstance) {
      flatpickrInstance.destroy();
    }

    flatpickrInstance = flatpickr(datepicker, {
      mode: "range",
      minDate: "today",
      dateFormat: "Y-m-d",
      locale: "es",
      disable: disabledRanges,
      onChange: (dates) => {
        selectedDates = dates;
        updatePriceBreakdown();
        validateForm();
      }
    });
  }

  function getRateForNight(dateObj) {
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();

    if (month === 11) return 400; // Noviembre
    if (month === 12) return day >= 24 ? 850 : 450; // Diciembre
    if (month === 1) return day <= 3 ? 850 : 700; // Enero
    if (month === 2) return 600; // Febrero
    if (month === 3) return 500; // Marzo
    return 130; // Temporada Baja (Abril a Octubre)
  }

  function calculateStayQuote(startDate, endDate) {
    let subtotal = 0;
    let nights = 0;
    let touchesLowSeason = false;
    
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    while (current < end) {
      const m = current.getMonth() + 1;
      if (m >= 4 && m <= 10) touchesLowSeason = true;
      
      subtotal += getRateForNight(current);
      nights++;
      current.setDate(current.getDate() + 1);
    }
    
    const cleaningFee = 300; // R$ 300
    const total = subtotal + cleaningFee;
    
    return {
      nights,
      subtotal,
      cleaningFee,
      total,
      touchesLowSeason,
      averageRate: nights > 0 ? Math.round(subtotal / nights) : 130
    };
  }

  // Calculate and display dynamic pricing
  function updatePriceBreakdown() {
    const minNightsNotice = document.getElementById('min-nights-notice');

    if (selectedDates.length < 2 || !propertyData) {
      priceBreakdown.classList.add('hidden');
      if (minNightsNotice) minNightsNotice.classList.add('hidden');
      return;
    }

    const start = selectedDates[0];
    const end = selectedDates[1];
    
    const quote = calculateStayQuote(start, end);
    
    if (quote.touchesLowSeason && quote.nights < 10) {
      if (minNightsNotice) {
        minNightsNotice.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> En <strong>Temporada Baja</strong> (Abril a Octubre) la estadía mínima requerida es de <strong>10 noches</strong>.';
        minNightsNotice.classList.remove('hidden');
      }
      priceBreakdown.classList.add('hidden');
      return;
    } else {
      if (minNightsNotice) minNightsNotice.classList.add('hidden');
    }
    
    // Update labels
    nightsCalc.textContent = `Promedio R$ ${quote.averageRate} x ${quote.nights} noches`;
    subtotalAmount.textContent = `R$ ${quote.subtotal.toLocaleString()}`;
    cleaningAmount.textContent = `R$ ${quote.cleaningFee.toLocaleString()}`;
    totalAmount.textContent = `R$ ${quote.total.toLocaleString()}`;
    
    priceBreakdown.classList.remove('hidden');
  }

  // Form validation listener
  function validateForm() {
    const nameValid = guestName.value.trim().length > 2;
    const contactValid = guestContact.value.trim().length > 5;
    const countryValid = guestCountry.value !== "";
    const datesValid = selectedDates.length === 2;

    let minNightsOk = true;
    if (selectedDates.length === 2) {
      const quote = calculateStayQuote(selectedDates[0], selectedDates[1]);
      if (quote.touchesLowSeason && quote.nights < 10) {
        minNightsOk = false;
      }
    }

    btnSubmit.disabled = !(nameValid && contactValid && countryValid && datesValid && minNightsOk);
  }

  [guestName, guestContact, guestCountry].forEach(el => {
    el.addEventListener('input', validateForm);
    el.addEventListener('change', validateForm);
  });

  // Handle Booking submission
  btnSubmit.addEventListener('click', async () => {
    if (btnSubmit.disabled || !propertyData || selectedDates.length < 2) return;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    const payload = {
      huesped_nombre: guestName.value.trim(),
      huesped_contacto: guestContact.value.trim(),
      fecha_ingreso: datepicker.value.split(" a ")[0],
      fecha_egreso: datepicker.value.split(" a ")[1],
      pais_residencia: guestCountry.value
    };

    try {
      const response = await fetch(`/api/propiedades/${propertyId}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.status === 'success') {
        // Clear Form
        guestName.value = '';
        guestContact.value = '';
        guestCountry.value = '';
        datepicker.value = '';
        selectedDates = [];
        priceBreakdown.classList.add('hidden');
        btnSubmit.disabled = true;

        // Redirect to WhatsApp Link
        window.open(result.data.url_contacto, '_blank');
        
        // Refresh blocked dates
        fetchDisponibilidad();
      } else {
        alert(result.message || 'Ocurrió un error al procesar la reserva.');
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      alert('Error de conexión con el servidor.');
    } finally {
      btnSubmit.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Solicitar Reserva por WhatsApp';
    }
  });

  // Fetch Approved Reviews
  async function fetchReviews() {
    try {
      const response = await fetch(`/api/propiedades/${propertyId}/comentarios`);
      const result = await response.json();

      if (result.status === 'success' && result.data.length > 0) {
        renderReviews(result.data);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  }

  function renderReviews(reviews) {
    reviewsList.innerHTML = '';
    
    let totalScore = 0;
    reviews.forEach(r => {
      totalScore += r.puntuacion;
      
      const item = document.createElement('div');
      item.className = 'review-item';
      
      const starsHtml = '★'.repeat(r.puntuacion) + '☆'.repeat(5 - r.puntuacion);
      const dateFormatted = new Date(r.fecha_creacion).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      item.innerHTML = `
        <div class="review-meta">
          <span class="reviewer-name">${r.huesped_nombre}</span>
          <span class="review-date">${dateFormatted}</span>
        </div>
        <div class="review-stars">${starsHtml}</div>
        <p class="review-text">"${r.texto_comentario || 'Excelente estadía, muy recomendable.'}"</p>
      `;
      reviewsList.appendChild(item);
    });

    const average = (totalScore / reviews.length).toFixed(1);
    reviewsAvg.textContent = `(★ ${average})`;
    reviewsCount.textContent = `${reviews.length} ${reviews.length === 1 ? 'comentario' : 'comentarios'}`;
  }

  // Lightbox & All Photos Modal Functionality
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const btnClose = document.querySelector('.lightbox-close');
  const btnPrev = document.querySelector('.lightbox-prev');
  const btnNext = document.querySelector('.lightbox-next');
  
  const allPhotosModal = document.getElementById('all-photos-modal');
  const btnShowAll = document.getElementById('btn-show-all-photos');
  const btnCloseAllPhotos = document.querySelector('.btn-close-all-photos');

  let currentImgIndex = 0;

  function updateLightbox() {
    if (!allPhotosList || allPhotosList.length === 0) return;
    lightboxImg.src = allPhotosList[currentImgIndex].url_imagen;
    const counter = lightboxModal.querySelector('.lightbox-counter');
    if (counter) {
      counter.textContent = `${currentImgIndex + 1} / ${allPhotosList.length}`;
    }
  }

  function openLightbox(index) {
    if (!allPhotosList || allPhotosList.length === 0) return;
    currentImgIndex = index;
    updateLightbox();
    lightboxModal.classList.add('open');
    document.body.style.overflow = 'hidden'; // lock scroll
  }

  function closeLightbox() {
    lightboxModal.classList.remove('open');
    // Only restore body scroll if the other fullscreen modal is NOT open
    if (allPhotosModal && !allPhotosModal.classList.contains('open')) {
      document.body.style.overflow = ''; // unlock scroll
    }
  }

  function showNextImage() {
    if (!allPhotosList || allPhotosList.length === 0) return;
    currentImgIndex = (currentImgIndex + 1) % allPhotosList.length;
    updateLightbox();
  }

  function showPrevImage() {
    if (!allPhotosList || allPhotosList.length === 0) return;
    currentImgIndex = (currentImgIndex - 1 + allPhotosList.length) % allPhotosList.length;
    updateLightbox();
  }

  // Bind click for "Show all photos"
  if (btnShowAll && allPhotosModal) {
    btnShowAll.addEventListener('click', () => {
      allPhotosModal.classList.add('open');
      document.body.style.overflow = 'hidden'; // lock scroll
    });
  }

  if (btnCloseAllPhotos && allPhotosModal) {
    btnCloseAllPhotos.addEventListener('click', () => {
      allPhotosModal.classList.remove('open');
      document.body.style.overflow = ''; // unlock scroll
    });
  }

  // Bind control button clicks
  if (btnClose) btnClose.addEventListener('click', closeLightbox);
  if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); showNextImage(); });
  if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrevImage(); });

  // Close when clicking empty space outside the image
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal || e.target.classList.contains('lightbox-content')) {
        closeLightbox();
      }
    });
  }

  // Keyboard accessibility
  document.addEventListener('keydown', (e) => {
    if (lightboxModal && lightboxModal.classList.contains('open')) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') showNextImage();
      else if (e.key === 'ArrowLeft') showPrevImage();
    } else if (allPhotosModal && allPhotosModal.classList.contains('open')) {
      if (e.key === 'Escape') {
        allPhotosModal.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });

  // Initial runs
  fetchProperty();
  fetchReviews();
});
