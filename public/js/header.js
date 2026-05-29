// Espera a que el DOM cargue antes de usar los elementos
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("nav-menu");

    const servicesBtn = document.querySelector(".dropdown-btn");
    const servicesContainer = document.querySelector(".services-container");
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
            servicesContainer?.classList.add("is-open");
        }
    });
    //  BOTÓN BACK
    backBtn.addEventListener("click", () => {
        mobileSubmenu.classList.remove("active");
        servicesContainer?.classList.remove("is-open");
    });

    //  CERRAR TODO SI HACES CLICK FUERA
    document.addEventListener("click", (e) => {
        if (!nav.contains(e.target) && !toggle.contains(e.target)) {
            nav.classList.remove("active");
            toggle.classList.remove("active");
            mobileSubmenu.classList.remove("active");
            servicesContainer?.classList.remove("is-open");
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
            servicesContainer?.classList.remove("is-open");
        });
    });

    document.querySelectorAll(".logout-btn").forEach((button) => {
        button.addEventListener("click", async () => {
            try {
                await fetch("/api/logout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
            } finally {
                window.location.href = "/login";
            }
        });
    });

    const accountMenu = document.querySelector(".account-menu");
    const accountTrigger = document.querySelector(".account-trigger");

    if (accountMenu && accountTrigger) {
        accountTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = accountMenu.classList.toggle("open");
            accountTrigger.setAttribute("aria-expanded", String(isOpen));
        });

        document.addEventListener("click", (e) => {
            if (!accountMenu.contains(e.target)) {
                accountMenu.classList.remove("open");
                accountTrigger.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                accountMenu.classList.remove("open");
                accountTrigger.setAttribute("aria-expanded", "false");
            }
        });
    }
});
