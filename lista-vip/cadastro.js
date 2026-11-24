const form = document.querySelector("form");
if (form) {
  const register = form.closest(".register");
  const contact = form.querySelector("[data-contact]");
  const channels = form.querySelector("[data-channels]");
  const next = form.querySelector(".next");
  const back = form.querySelector(".back");
  const submit = form.querySelector(".submit");
  const receipt = register.querySelector(".receipt");
  const heading = form.querySelector("h2");
  const deck = form.querySelector(".form-deck");
  const steps = form.dataset.steps === "true";
  function showChannels(show) {
    contact.hidden = show;
    channels.hidden = !show;
    next.hidden = show;
    back.hidden = !show;
    submit.hidden = !show;
    heading.textContent = show ? "Suas preferências" : "Seu convite";
    deck.textContent = show
      ? "Escolha como a Vinoteca pode falar com você."
      : "Deixe seus dados para entrar na lista.";
    document.querySelector("[data-one]").toggleAttribute("aria-current", !show);
    document.querySelector("[data-two]").toggleAttribute("aria-current", show);
    document.querySelector(show ? "[data-two]" : "[data-one]").setAttribute("aria-current", "step");
    (show ? channels : contact).querySelector("input").focus();
  }
  next?.addEventListener("click", () => {
    if (form.reportValidity()) showChannels(true);
  });
  back?.addEventListener("click", () => showChannels(false));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (steps && !contact.hidden) {
      showChannels(true);
      return;
    }
    form.reset();
    form.hidden = true;
    receipt.hidden = false;
    receipt.focus();
  });
  register.querySelector(".restart").addEventListener("click", () => {
    form.hidden = false;
    receipt.hidden = true;
    if (steps) showChannels(false);
    else contact.querySelector("input").focus();
  });
}
