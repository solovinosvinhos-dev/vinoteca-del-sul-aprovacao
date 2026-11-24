const byId = (id) => document.getElementById(id);
const form = byId("vip");
const details = byId("dados");
const channels = byId("canais");
const next = byId("avancar");
const back = byId("voltar");
const submit = byId("enviar");
const status = byId("form-estado");
const welcome = byId("wa-toggle");
const panel = byId("wa-painel");
const modeNote = byId("modo");
let mode,
  sending = false,
  lastBody,
  submissionId;

function toggleWelcome(open) {
  panel.hidden = !open;
  welcome.setAttribute("aria-expanded", String(open));
  if (open) {
    byId("wa-badge").hidden = true;
    welcome.setAttribute("aria-label", "Conversa com a Vinoteca");
    try {
      sessionStorage.setItem("vinoteca-saudacao-lida", "1");
    } catch {}
    byId("wa-fechar").focus();
  } else welcome.focus();
}
try {
  if (sessionStorage.getItem("vinoteca-saudacao-lida")) {
    byId("wa-badge").hidden = true;
    welcome.setAttribute("aria-label", "Conversa com a Vinoteca");
  }
} catch {}
welcome.addEventListener("click", () => toggleWelcome(panel.hidden));
byId("wa-fechar").addEventListener("click", () => toggleWelcome(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) toggleWelcome(false);
});

function setStep(second) {
  details.hidden = second;
  channels.hidden = !second;
  next.hidden = second;
  submit.hidden = !second;
  submit.disabled = !second;
  back.hidden = !second;
  byId("passo1").removeAttribute("aria-current");
  byId("passo2").removeAttribute("aria-current");
  byId(second ? "passo2" : "passo1").setAttribute("aria-current", "step");
  byId("form-titulo").textContent = second ? "Suas preferências" : "Seu convite";
  byId("form-descricao").textContent = second
    ? "Por onde quer receber as novidades da casa?"
    : "Deixe seus dados para entrar na lista VIP.";
  status.textContent = "";
  (second ? channels : details).querySelector("input:not([name=website])").focus();
}
function advance() {
  const name = form.elements.namedItem("name");
  const phone = form.elements.namedItem("phone");
  const digits = phone.value.replace(/\D/g, "");
  phone.setCustomValidity(
    /^[\d()+.\s-]+$/.test(phone.value) && /^[1-9]\d{9,10}$/.test(digits)
      ? ""
      : "Informe o DDD e o número do WhatsApp, com 10 ou 11 dígitos.",
  );
  name.setCustomValidity(name.value.trim().length < 2 ? "Informe seu nome." : "");
  if (form.reportValidity()) setStep(true);
}
form.elements.namedItem("name").addEventListener("input", (e) => e.target.setCustomValidity(""));
form.elements.namedItem("phone").addEventListener("input", (e) => e.target.setCustomValidity(""));
next.addEventListener("click", advance);
back.addEventListener("click", () => setStep(false));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!mode || sending) return;
  if (channels.hidden) {
    advance();
    return;
  }
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const payload = {
    name: data.get("name"),
    email: data.get("email"),
    phone: data.get("phone"),
    website: data.get("website") || "",
    whatsapp_opt_in: form.elements.whatsapp_opt_in.checked,
    email_opt_in: form.elements.email_opt_in.checked,
  };
  const serialized = JSON.stringify(payload);
  if (serialized !== lastBody) {
    submissionId = crypto.randomUUID();
    lastBody = serialized;
  }
  sending = true;
  submit.disabled = back.disabled = channels.disabled = true;
  status.textContent = "Concluindo seu cadastro…";
  try {
    if (mode === "live") {
      const response = await fetch("/api/lista-vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotency_key: submissionId }),
        signal: AbortSignal.timeout(14000),
      });
      if (!response.ok || (await response.json()).ok !== true) {
        if (response.status === 429)
          throw new Error("Muitas tentativas. Tente novamente mais tarde.");
        if (response.status === 409)
          throw new Error("Para concluir o cadastro, fale com a Vinoteca pelo WhatsApp.");
        throw new Error(
          "Não foi possível confirmar seu cadastro. Seus dados continuam aqui para tentar novamente.",
        );
      }
    }
    form.reset();
    form.hidden = true;
    lastBody = submissionId = null;
    const receipt = byId("confirmacao");
    byId("confirmacao-texto").textContent =
      mode === "preview"
        ? "Demonstração concluída. Os dados ficaram neste navegador e foram descartados."
        : "Seu cadastro na lista VIP da Vinoteca foi recebido.";
    receipt.hidden = false;
    byId("confirmacao-titulo").textContent =
      mode === "preview" ? "Prévia concluída." : "Boas-vindas à lista.";
    receipt.focus();
  } catch (error) {
    status.textContent =
      error instanceof Error && error.name === "Error"
        ? error.message
        : "A conexão foi interrompida. Confira sua conexão e tente novamente.";
  } finally {
    sending = false;
    channels.disabled = submit.disabled = back.disabled = false;
  }
});

document.querySelector("[data-restart]").addEventListener("click", () => {
  byId("confirmacao").hidden = true;
  form.hidden = false;
  setStep(false);
});

async function initialize() {
  try {
    const r = await fetch("/api/lista-vip", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error();
    const config = await r.json();
    if (!["live", "preview"].includes(config.mode)) throw new Error();
    mode = config.mode;
    details.disabled = next.disabled = false;
    byId("form-descricao").textContent = "Deixe seus dados para entrar na lista VIP.";
    modeNote.textContent =
      mode === "preview"
        ? "Prévia para aprovação. Use dados fictícios para experimentar o cadastro."
        : "";
    modeNote.hidden = mode === "live";
  } catch {
    modeNote.textContent =
      "O cadastro está temporariamente indisponível. Você também pode falar com a Vinoteca pelo WhatsApp.";
  }
}
initialize();
