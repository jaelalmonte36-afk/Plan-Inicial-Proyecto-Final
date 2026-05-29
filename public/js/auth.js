document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
        const input = button.closest('.auth-input')?.querySelector('input');
        const icon = button.querySelector('i');

        if (!input || !icon) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        icon.classList.toggle('fa-eye', !isPassword);
        icon.classList.toggle('fa-eye-slash', isPassword);
        button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
});

document.querySelectorAll('.auth-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submit = form.querySelector('.auth-submit');
        const originalText = submit?.textContent || 'Submit';
        const message = form.querySelector('.auth-message') || document.createElement('p');

        message.className = 'auth-message';
        if (!message.parentElement) {
            form.appendChild(message);
        }

        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Sending...';
        }

        try {
            const endpoint = form.dataset.authEndpoint;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
            });

            const contentType = response.headers.get('content-type') || '';
            const result = contentType.includes('application/json')
                ? await response.json()
                : { message: 'Server returned an unexpected response. Restart the app and try again.' };

            if (!response.ok) {
                throw new Error(result.message || 'Request failed.');
            }

            message.textContent = result.message;
            message.classList.remove('is-error');

            if (result.redirectTo) {
                window.location.href = result.redirectTo;
            }
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('is-error');
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = originalText;
            }
        }
    });
});
