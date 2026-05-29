document.querySelectorAll('.ajax-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const button = form.querySelector('button[type="submit"]');
    const originalText = button?.textContent || 'Enviar';
    let message = form.querySelector('.form-message');

    if (!message) {
      message = document.createElement('p');
      message.className = 'form-message';
      form.appendChild(message);
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Guardando...';
    }

    try {
      const response = await fetch(form.action, {
        method: form.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || 'Error al guardar.');

      message.textContent = result.message;
      message.classList.remove('is-error');

      if (result.redirectTo) {
        window.location.href = result.redirectTo;
      } else {
        form.reset();
      }
    } catch (error) {
      message.textContent = error.message;
      message.classList.add('is-error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
});

document.querySelectorAll('.logout-btn').forEach((button) => {
  button.addEventListener('click', async () => {
    const response = await fetch('/api/logout', { method: 'POST' });
    const result = await response.json();
    window.location.href = result.redirectTo || '/';
  });
});

const arrangementSearch = document.querySelector('#arrangement-search');
const arrangementCards = [...document.querySelectorAll('.arrangement-card')];
const emptySearch = document.querySelector('#empty-search');

if (arrangementSearch) {
  arrangementSearch.addEventListener('input', () => {
    const query = arrangementSearch.value.trim().toLowerCase();
    let visible = 0;

    arrangementCards.forEach((card) => {
      const text = `${card.textContent} ${card.dataset.search}`.toLowerCase();
      const matches = !query || text.includes(query);
      card.hidden = !matches;
      if (matches) visible += 1;
    });

    if (emptySearch) {
      emptySearch.hidden = visible > 0;
    }
  });
}
