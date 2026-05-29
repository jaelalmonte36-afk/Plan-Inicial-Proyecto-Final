async function readJson(response) {
    const text = await response.text();

    try {
        return text ? JSON.parse(text) : {};
    } catch (error) {
        return {
            message: response.ok ? 'Saved successfully.' : 'Server returned an unexpected response.',
        };
    }
}

document.querySelectorAll('[data-review-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const message = form.querySelector('.review-message');
        const button = form.querySelector('button[type="submit"]');

        message.textContent = '';
        message.classList.remove('is-error');
        button.disabled = true;

        try {
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
            });
            const result = await readJson(response);

            if (!response.ok) throw new Error(result.message || 'Could not save your review.');

            message.textContent = result.message || 'Review saved successfully.';
            setTimeout(() => window.location.reload(), 800);
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('is-error');
        } finally {
            button.disabled = false;
        }
    });
});
