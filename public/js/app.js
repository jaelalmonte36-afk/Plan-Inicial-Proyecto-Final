const form = document.getElementById('contactForm');
const responseMsg = document.getElementById('responseMsg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    nombre: document.getElementById('nombre').value,
    contacto: document.getElementById('contacto').value,
    mensaje: document.getElementById('mensaje').value
  };

  try {
    const res = await fetch('http://localhost:3000/api/mensajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      responseMsg.textContent = "Mensaje enviado correctamente!";
      form.reset();
    } else {
      responseMsg.textContent = "Error al enviar el mensaje.";
    }
  } catch (err) {
    responseMsg.textContent = "Error de conexión.";
  }
});

