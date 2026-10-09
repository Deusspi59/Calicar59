
import { supabase, supabaseConfigured } from "./supabase-client.js";

const container = document.querySelector("#vehicle");

function addText(parent, tag, value, className = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value ?? "";
  parent.append(element);
  return element;
}

function euro(value) {
  if (value === null || value === undefined || value === "") {
    return "Prix sur demande";
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function renderVehicle(vehicle) {
  container.replaceChildren();

  const statusLabels = {
    disponible: "DISPONIBLE",
    a_venir: "À VENIR",
    vendu: "VENDU"
  };

  addText(
    container,
    "span",
    statusLabels[vehicle.status] || "DISPONIBLE",
    "status"
  );

  addText(container, "h1", `${vehicle.make} ${vehicle.model}`);
  addText(
    container,
    "p",
    vehicle.status === "vendu" ? "Vendu" : euro(vehicle.price),
    "price"
  );

  
const gallery = document.createElement("div");
gallery.className = "gallery";

const photos = Array.isArray(vehicle.photos)
  ? vehicle.photos.slice(0, 10)
  : [];

if (photos.length) {
  const mainImage = document.createElement("img");
  mainImage.className = "gallery-main";
  mainImage.src = photos[0];
  mainImage.alt = `${vehicle.make} ${vehicle.model} — photo 1`;
  mainImage.loading = "eager";
  gallery.append(mainImage);
  mainImage.addEventListener("click", () => {
    const overlay = document.createElement("div");
    overlay.className = "photo-lightbox";

    const enlarged = document.createElement("img");
    enlarged.src = mainImage.src;
    enlarged.alt = mainImage.alt;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "photo-lightbox-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Fermer l’image");

    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", handleKeydown);
    };

    const handleKeydown = (event) => {
      if (event.key === "Escape") close();
    };

    closeButton.addEventListener("click", close);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    overlay.append(enlarged, closeButton);
    document.body.append(overlay);
    document.addEventListener("keydown", handleKeydown);
  });


  const thumbnails = [];

  photos.forEach((url, index) => {
    const thumb = document.createElement("img");
    thumb.className = "gallery-thumb";
    thumb.src = url;
    thumb.alt = `Voir la photo ${index + 1}`;
    thumb.loading = "lazy";
    thumb.tabIndex = 0;

    const selectPhoto = () => {
      mainImage.src = url;
      mainImage.alt = `${vehicle.make} ${vehicle.model} — photo ${index + 1}`;

      thumbnails.forEach((item) => {
        item.classList.remove("active");
      });
      thumb.classList.add("active");
    };

    thumb.addEventListener("click", selectPhoto);
    thumb.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPhoto();
      }
    });

    thumb.addEventListener("error", () => {
      thumb.remove();
    });

    thumbnails.push(thumb);
    gallery.append(thumb);
  });

if (thumbnails.length > 0) {
  thumbnails[0].classList.add("active");
}} else {
  addText(gallery, "p", "Aucune photo disponible.");
}

container.append(gallery);


  
      
  const specs = document.createElement("div");
  specs.className = "specs";

  
const details = [
  ["Année", vehicle.year],
  ["Kilométrage", vehicle.mileage != null
    ? `${Number(vehicle.mileage).toLocaleString("fr-FR")} km`
    : null],
  ["Carburant", vehicle.fuel],
  ["Boîte de vitesses", vehicle.gearbox],
  ["Transmission", vehicle.transmission],
  ["Carrosserie", vehicle.body_type],
  ["Finition", vehicle.trim_level],
  ["Couleur", vehicle.color],
  ["Nombre de portes", vehicle.doors],
  ["Nombre de places", vehicle.seats],
  ["Puissance moteur", vehicle.power_hp != null
    ? `${vehicle.power_hp} ch`
    : null],
  ["Puissance fiscale", vehicle.fiscal_power != null
    ? `${vehicle.fiscal_power} CV`
    : null],
  ["Cylindrée", vehicle.displacement_cc != null
    ? `${Number(vehicle.displacement_cc).toLocaleString("fr-FR")} cm³`
    : null],
  ["Première mise en circulation", vehicle.first_registration
    ? new Date(`${vehicle.first_registration}T12:00:00`).toLocaleDateString("fr-FR")
    : null],
  ["Émissions de CO₂", vehicle.co2_emissions != null
    ? `${vehicle.co2_emissions} g/km`
    : null],
  ["Norme Euro", vehicle.euro_standard],
  ["Garantie", vehicle.warranty],
  ["Historique d'entretien", vehicle.service_history],
  ["Ajouté le", formatDate(vehicle.created_at)]
];

  details.forEach(([label, value]) => {
    if (value === null || value === undefined || value === "") return;
    const item = document.createElement("div");
    item.className = "spec";
    addText(item, "small", label);
    addText(item, "strong", String(value));
    specs.append(item);
  });

  container.append(specs);

  if (vehicle.description) {
    addText(container, "h2", "Description");
    addText(container, "p", vehicle.description);
  }
  
if (vehicle.equipment) {
  addText(container, "h2", "Équipements et options");
  addText(container, "p", vehicle.equipment);
}


  const actions = document.createElement("div");
  actions.className = "actions";

  const contact = document.createElement("a");
  contact.className = "button primary";
  contact.href = "tel:+33647561765";
  contact.textContent = "Contacter Calicar59";
  actions.append(contact);

  const back = document.createElement("a");
  back.className = "button secondary";
  back.href = "index.html#accueil";
  back.textContent = "Retour au stock";
  actions.append(back);

  container.append(actions);
}

async function init() {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    container.replaceChildren();
    addText(container, "h1", "Véhicule introuvable");
    addText(container, "p", "Aucun véhicule n'a été sélectionné.");
    return;
  }

  if (!supabaseConfigured) {
    container.replaceChildren();
    addText(container, "p", "La connexion à la base de données n'est pas configurée.");
    return;
  }

  const { data, error } = await supabase
    .from("vehicles")
    
.select("id, make, model, year, mileage, fuel, gearbox, price, doors, body_type, status, description, photos, created_at, trim_level, power_hp, fiscal_power, displacement_cc, color, seats, transmission, first_registration, co2_emissions, euro_standard, equipment, warranty, service_history")
    .eq("id", id)
    .neq("status", "brouillon")
    .maybeSingle();

  if (error || !data) {
    console.error("CALICAR59 : impossible de charger cette annonce.", error?.message);
    container.replaceChildren();
    addText(container, "h1", "Véhicule indisponible");
    addText(container, "p", "Cette annonce est introuvable ou n'est plus accessible.");
    return;
  }

  renderVehicle(data);
}

init().catch((error) => {
  console.error("CALICAR59 : erreur lors du chargement de la fiche.", error);
  container.replaceChildren();
  addText(container, "p", "Une erreur est survenue lors du chargement du véhicule.");
});
