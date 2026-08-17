document.addEventListener('DOMContentLoaded', () => {
  // Parse token from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // DOM Elements
  const formSection = document.getElementById('feedback-form-section');
  const successSection = document.getElementById('success-section');
  const errorBox = document.getElementById('error-box');
  const btnSend = document.getElementById('btn-send-review');
  const reviewText = document.getElementById('review-text');
  const starInputs = document.querySelectorAll('input[name="rating"]');

  // Initial State Validation
  if (!token) {
    showError("Falta el token de autorización. Solicita un nuevo enlace para dejar tu opinión.");
    btnSend.disabled = true;
    disableFormControls();
    return;
  }

  // Star select changes validation
  let selectedRating = null;
  starInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      selectedRating = e.target.value;
      btnSend.disabled = false;
    });
  });

  // Handle Review submission
  btnSend.addEventListener('click', async () => {
    if (!token || !selectedRating) return;

    btnSend.disabled = true;
    btnSend.textContent = 'Enviando...';
    hideError();

    const payload = {
      token: token,
      puntuacion: selectedRating,
      texto_comentario: reviewText.value.trim()
    };

    try {
      const response = await fetch('/api/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.status === 'success') {
        formSection.style.display = 'none';
        successSection.style.display = 'block';
      } else {
        showError(result.message || 'No se pudo enviar la reseña.');
        btnSend.disabled = false;
        btnSend.textContent = 'Enviar Reseña';
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      showError("Error de conexión. Por favor, verifica tu conexión a internet.");
      btnSend.disabled = false;
      btnSend.textContent = 'Enviar Reseña';
    }
  });

  // Helper Functions
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  function hideError() {
    errorBox.style.display = 'none';
  }

  function disableFormControls() {
    reviewText.disabled = true;
    starInputs.forEach(input => input.disabled = true);
  }
});
