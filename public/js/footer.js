// Mapa de URLs de redes sociales
const socialLinks = {
    facebook: "https://facebook.com",
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
    pinterest: "https://pinterest.com",
    instagram: "https://instagram.com"
};

// Abrir cada red social en una nueva pestaña
document.getElementById("facebookBtn").addEventListener("click", () => {
    window.open(socialLinks.facebook, "_blank");
});

document.getElementById("twitterBtn").addEventListener("click", () => {
    window.open(socialLinks.twitter, "_blank");
});

document.getElementById("linkedinBtn").addEventListener("click", () => {
    window.open(socialLinks.linkedin, "_blank");
});

document.getElementById("pinterestBtn").addEventListener("click", () => {
    window.open(socialLinks.pinterest, "_blank");
});

document.getElementById("instagramBtn").addEventListener("click", () => {
    window.open(socialLinks.instagram, "_blank");
});


// Botones Home
document.getElementById("home1").addEventListener("click", () => {
    window.location.href = "home1.html";
});

document.getElementById("home2").addEventListener("click", () => {
    window.location.href = "home2.html";
});

document.getElementById("home3").addEventListener("click", () => {
    window.location.href = "home3.html";
});

document.getElementById("home4").addEventListener("click", () => {
    window.location.href = "home4.html";
});

document.getElementById("home5").addEventListener("click", () => {
    window.location.href = "services/service1.html";
});

document.getElementById("home6").addEventListener("click", () => {
    window.location.href = "services/service2.html";
});

document.getElementById("home7").addEventListener("click", () => {
    window.location.href = "services/service3.html";
});

document.getElementById("home8").addEventListener("click", () => {
    window.location.href = "services/service4.html";
});

document.getElementById("home9").addEventListener("click", () => {
    window.location.href = "contact/contact1.html";
});

document.getElementById("home10").addEventListener("click", () => {
    window.location.href = "contact/contact2.html";
});

document.getElementById("home11").addEventListener("click", () => {
    window.location.href = "contact/contact3.html";
});
// Enlaces rápidos desde el footer hacia páginas internas
document.getElementById("home12").addEventListener("click", () => {
    window.location.href = "contact/contact4.html";
});