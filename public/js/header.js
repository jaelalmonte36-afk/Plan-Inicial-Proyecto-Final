// Espera a que el DOM cargue antes de usar los elementos
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("nav-menu");

    const servicesBtn = document.querySelector(".dropdown-btn");
    const mobileSubmenu = document.querySelector(".mobile-submenu");
    const backBtn = document.querySelector(".back-btn");

    // Abrir o cerrar el menú principal con el botón hamburguesa
    toggle.addEventListener("click", () => {
        nav.classList.toggle("active");
        toggle.classList.toggle("active");
    });

    // 📱 ABRIR SUBMENU (SOLO EN MOBILE)
    servicesBtn.addEventListener("click", (e) => {
        if (window.innerWidth <= 768) {
            e.stopPropagation();
            mobileSubmenu.classList.add("active");
        }
    });
    //  BOTÓN BACK
    backBtn.addEventListener("click", () => {
        mobileSubmenu.classList.remove("active");
    });

    //  CERRAR TODO SI HACES CLICK FUERA
    document.addEventListener("click", (e) => {
        if (!nav.contains(e.target) && !toggle.contains(e.target)) {
            nav.classList.remove("active");
            toggle.classList.remove("active");
            mobileSubmenu.classList.remove("active");
        }
    });

    //  CERRAR SOLO SI NO ES SERVICES
    document.querySelectorAll("#nav-menu button").forEach(btn => {
        btn.addEventListener("click", () => {

            //  si es el botón de services, NO cerrar
            if (btn.classList.contains("dropdown-btn")) return;

            nav.classList.remove("active");
            toggle.classList.remove("active");
            mobileSubmenu.classList.remove("active");
        });
    });
});