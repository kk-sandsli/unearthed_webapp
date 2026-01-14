// i18n.js
(function (global) {
  var STORAGE_KEY = "unearthed-lang";

  var MESSAGES = {
    en: {
      appName: "Unearthed",
      appTagline: "Find reporting for detectorists - A prototype webapp by Kodeklubben Sandsli",
      pageHeading: "Report a find",
      pageSub: "Fill in the details below. Your GPS will be used, and the official PDF will be filled automatically.",

      finderTitle: "Finder",
      ownerTitle: "Land owner",

      labelName: "Name",
      labelAddress: "Address",
      labelPhone: "Telephone",
      labelEmail: "Email",

      phName: "Your full name",
      phAddress: "Street, no., postcode, place",
      phPhone: "+47 ...",
      phEmail: "you@example.com",
      phOwnerName: "Name of land owner",

      labelObjectName: "Object name",
      phObjectName: "e.g. Bronze brooch",
      labelObjectType: "Type of object",

      optTool: "Tool",
      optWeapon: "Weapon",
      optJewelry: "Jewelry",
      optPottery: "Pottery",
      optOther: "Other",

      labelMaterial: "Assumed material",
      phMaterial: "e.g. bronze, copper, iron",
      labelAge: "Estimated age",
      phAge: "e.g. Viking age, 17th c.",

      labelAreaType: "Area type",
      optArealAker: "Field",
      optArealBeite: "Pasture",
      optArealHage: "Garden",
      optArealSkog: "Forest",
      optArealFjell: "Mountain",
      optArealStrand: "Beach",
      optArealVann: "Water",

      labelDepth: "Find depth (cm)",
      phDepth: "e.g. 25",

      labelLocation: "Location",
      phLocation: "Will be filled from GPS",

      labelPhoto: "Upload photo",
      labelNotes: "Notes",
      phNotes: "Context, associated finds, depth, etc.",

      btnUseLocation: "Use current location",
      btnDownload: "Download official form (filled)",

      cbEmailFinder: "Send copy (data + PDF) to finder",
      cbEmailOwner: "Send copy (data + PDF) to land owner",
      emailHint: "Note: to actually send these emails you need a small server-side endpoint.",
      locationSaved: "Location saved ✔",
      labelKommune: "Municipality",
      phKommune: "Auto-filled from GPS",
      labelGnr: "Farm no. (Gnr)",
      phGnr: "Auto-filled from GPS",
      labelBnr: "Holding no. (Bnr)",
      phBnr: "Auto-filled from GPS",
    },
    no: {
      appName: "Unearthed",
      appTagline: "Registrering av funn for metallsøkere - En prototype webapp fra Kodeklubben Sandsli",
      pageHeading: "Registrer funn",
      pageSub: "Fyll ut feltene nedenfor. GPS-posisjonen din brukes, og det offisielle skjemaet fylles ut automatisk.",

      finderTitle: "Finner",
      ownerTitle: "Grunneier",

      labelName: "Navn",
      labelAddress: "Adresse",
      labelPhone: "Telefon",
      labelEmail: "E-post",

      phName: "Ditt fulle navn",
      phAddress: "Gate, nr., postnr., sted",
      phPhone: "+47 ...",
      phEmail: "deg@example.com",
      phOwnerName: "Navn på grunneier",

      labelObjectName: "Gjenstand",
      phObjectName: "f.eks. bronseknapp",
      labelObjectType: "Type gjenstand",

      optTool: "Redskap",
      optWeapon: "Våpen",
      optJewelry: "Smykke",
      optPottery: "Keramikk",
      optOther: "Annet",

      labelMaterial: "Antatt materiale",
      phMaterial: "f.eks. bronse, kobber, jern",
      labelAge: "Antatt alder",
      phAge: "f.eks. vikingtid, 1600-tall",

      labelAreaType: "Arealtype",
      optArealAker: "Åker",
      optArealBeite: "Beite",
      optArealHage: "Hage",
      optArealSkog: "Skog",
      optArealFjell: "Fjell",
      optArealStrand: "Strand",
      optArealVann: "Vann",

      labelDepth: "Funndybde (cm)",
      phDepth: "f.eks. 25",

      labelLocation: "Posisjon (GPS)",
      phLocation: "Hentes fra GPS",

      labelPhoto: "Last opp bilde",
      labelNotes: "Notater",
      phNotes: "Kontekst, tilknyttede funn, dybde osv.",

      btnUseLocation: "Bruk nåværende posisjon",
      btnDownload: "Last ned utfylt skjema",

      cbEmailFinder: "Send kopi (data + PDF) til finner",
      cbEmailOwner: "Send kopi (data + PDF) til grunneier",
      emailHint: "NB: For å sende e-post må vi ha et endepunkt på serveren.",
      locationSaved: "Posisjon lagret ✔",
      labelKommune: "Kommune",
      phKommune: "Hentes fra GPS",
      labelGnr: "Gårdsnummer (Gnr)",
      phGnr: "Hentes fra GPS",
      labelBnr: "Bruksnummer (Bnr)",
      phBnr: "Hentes fra GPS",
    },
    es: {
      appName: "Unearthed",
      appTagline: "Registro de hallazgos para detectoristas - Un prototipo de aplicación web de Kodeklubben Sandsli",
      pageHeading: "Registrar hallazgo",
      pageSub: "Rellena los datos. Se usará tu GPS y se completará el PDF oficial automáticamente.",

      finderTitle: "Descubridor",
      ownerTitle: "Propietario del terreno",

      labelName: "Nombre",
      labelAddress: "Dirección",
      labelPhone: "Teléfono",
      labelEmail: "Correo",

      phName: "Tu nombre completo",
      phAddress: "Calle, nº, código postal, ciudad",
      phPhone: "+34 ...",
      phEmail: "tú@example.com",
      phOwnerName: "Nombre del propietario",

      labelObjectName: "Nombre del objeto",
      phObjectName: "p. ej. broche de bronce",
      labelObjectType: "Tipo de objeto",

      optTool: "Herramienta",
      optWeapon: "Arma",
      optJewelry: "Joyería",
      optPottery: "Cerámica",
      optOther: "Otro",

      labelMaterial: "Material supuesto",
      phMaterial: "p. ej. bronce, cobre, hierro",
      labelAge: "Edad estimada",
      phAge: "p. ej. época vikinga, s. XVII",

      labelAreaType: "Tipo de zona",
      optArealAker: "Campo",
      optArealBeite: "Pastoreo",
      optArealHage: "Jardín",
      optArealSkog: "Bosque",
      optArealFjell: "Montaña",
      optArealStrand: "Playa",
      optArealVann: "Agua",

      labelDepth: "Profundidad (cm)",
      phDepth: "p. ej. 25",

      labelLocation: "Ubicación (GPS)",
      phLocation: "Se rellenará con el GPS",

      labelPhoto: "Subir foto",
      labelNotes: "Notas",
      phNotes: "Contexto, hallazgos asociados, profundidad, etc.",

      btnUseLocation: "Usar ubicación actual",
      btnDownload: "Descargar formulario oficial (relleno)",

      cbEmailFinder: "Enviar copia (datos + PDF) al descubridor",
      cbEmailOwner: "Enviar copia (datos + PDF) al propietario",
      emailHint: "Nota: para enviar correos hace falta un endpoint en el servidor.",
      locationSaved: "Ubicación guardada ✔",
      labelKommune: "Municipio",
      phKommune: "Se rellena desde GPS",
      labelGnr: "Nº de finca (Gnr)",
      phGnr: "Se rellena desde GPS",
      labelBnr: "Nº de parcela (Bnr)",
      phBnr: "Se rellena desde GPS",
    },
  };

  function applyTranslations(lang) {
    var dict = MESSAGES[lang] || MESSAGES.en;

    // elements that just need text
    var i18nEls = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < i18nEls.length; i++) {
      var el = i18nEls[i];
      var key = el.getAttribute("data-i18n");
      if (!key) continue;
      var text = dict[key];
      if (typeof text === "string") {
        el.textContent = text;
      }
    }

    // placeholders
    var phEls = document.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < phEls.length; j++) {
      var phEl = phEls[j];
      var phKey = phEl.getAttribute("data-i18n-placeholder");
      if (!phKey) continue;
      var phText = dict[phKey];
      if (typeof phText === "string") {
        phEl.placeholder = phText;
      }
    }

    // top-right label
    var label = document.getElementById("langLabel");
    if (label) label.textContent = (lang || "en").toUpperCase();

    // set html lang
    document.documentElement.lang = lang;
  }

  function setLanguage(lang) {
    if (!MESSAGES[lang]) lang = "en";
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations(lang);
  }

  function initLanguage() {
    var saved = localStorage.getItem(STORAGE_KEY) || "no";
    setLanguage(saved);
  }

  // expose
  global.setLanguage = setLanguage;

  // Expose translations for other modules
  global.AppI18n = {
    setLanguage: setLanguage,
    translations: MESSAGES,
  };

  document.addEventListener("DOMContentLoaded", initLanguage);
})(window);

