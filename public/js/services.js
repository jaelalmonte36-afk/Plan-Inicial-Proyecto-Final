const serviceForms = document.querySelectorAll('.service-request-form');

serviceForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = form.querySelector('.service-form-message');
        const button = form.querySelector('button[type="submit"]');

        if (message) {
            message.textContent = '';
            message.classList.remove('is-error');
        }

        if (button) {
            button.disabled = true;
            button.textContent = 'Sending...';
        }

        try {
            const response = await fetch('/api/inspections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Could not send your inspection request.');
            }

            if (message) {
                const contact = result.contact
                    ? ` Contact: ${result.contact.email} / ${result.contact.phone}.`
                    : '';
                const status = result.statusUrl
                    ? ' You can review the status in My requests & reviews from your account menu.'
                    : '';
                message.textContent = `${result.message}${contact}${status}`;
            }

            form.reset();
        } catch (error) {
            if (message) {
                message.textContent = error.message;
                message.classList.add('is-error');
            }
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Send request';
            }
        }
    });
});
