// Inicialização do Parse (Back4App)
Parse.initialize("IGwVwH0zSAnEHPBT2Qbt6oQHyVrwDKwBFXYEqGFq", "Lkk1txHc43gHL6KPphncYmJunckXZRKiIvfB32lh");
Parse.serverURL = 'https://parseapi.back4app.com';

const BACK4APP = {
  APP_ID: "IGwVwH0zSAnEHPBT2Qbt6oQHyVrwDKwBFXYEqGFq",
  JAVASCRIPT_KEY: "Lkk1txHc43gHL6KPphncYmJunckXZRKiIvfB32lh",
  SERVER_URL: "https://parseapi.back4app.com"
};

// Alterado para o nome correto da sua classe no Back4App
const CLASS_NAME = "UsageData";

const FIELDS = [
  ["User_ID", "ID do respondente", "text"], ["Age", "Idade", "number"],
  ["Gender", "Gênero", "text"], ["Country", "País", "text"],
  ["User_Type", "Perfil", "select"], ["Education_Level", "Escolaridade", "text"],
  ["Profession", "Profissão", "text"], ["Monthly_Income", "Renda mensal", "number"],
  ["AI_Tool", "Ferramenta de IA", "text"], ["AI_Purpose", "Finalidade", "text"],
  ["AI_Usage_Hours_Per_Day", "Uso de IA por dia", "text"], ["Tasks_Performed", "Atividades realizadas", "textarea"],
  ["Monthly_AI_Cost", "Custo mensal de IA", "number"], ["Productivity_Score", "Produtividade (0 a 10)", "number"],
  ["Accuracy_Rating", "Precisão (0 a 10)", "number"], ["Satisfaction_Score", "Satisfação (0 a 10)", "number"],
  ["Time_Saved_Hours_Per_Week", "Horas economizadas por semana", "number"],
  ["Work_or_Study_Hours_Per_Day", "Horas de trabalho/estudo por dia", "number"],
  ["Would_Recommend", "Recomendaria?", "select"]
];
const NUMERIC_FIELDS = new Set(["Age", "Monthly_Income", "Monthly_AI_Cost", "Productivity_Score", "Accuracy_Rating", "Satisfaction_Score", "Time_Saved_Hours_Per_Week", "Work_or_Study_Hours_Per_Day"]);
const COLORS = ["#397b55", "#78a987", "#b4d2b5", "#d4a373", "#8caa91", "#547b68", "#a6c8a8", "#c4a484"];
const PURPOSE_LABELS = {
  "Office Work": "Trabalho de escritório", "Customer Support": "Suporte ao cliente", "Writing": "Escrita",
  "Data Analysis": "Análise de dados", "Research": "Pesquisa", "Content Creation": "Criação de conteúdo",
  "Studying": "Estudo", "Programming": "Programação"
};

let records = [];
let charts = {};
let currentPage = 0;
let editingObjectId = null;
const pageSize = 8;
const $ = (id) => document.getElementById(id);

function showStatus(message, isError = false) {
  const status = $("mensagemStatus");
  status.textContent = message;
  status.classList.toggle("is-error", isError);
  if (message && !isError) setTimeout(() => { if (status.textContent === message) status.textContent = ""; }, 5000);
}

function apiHeaders() {
  const headers = { "X-Parse-Application-Id": BACK4APP.APP_ID, "Content-Type": "application/json" };
  if (BACK4APP.JAVASCRIPT_KEY) headers["X-Parse-Javascript-Key"] = BACK4APP.JAVASCRIPT_KEY;
  return headers;
}

async function apiRequest(path, options = {}) {
  if (!BACK4APP.APP_ID || BACK4APP.APP_ID.startsWith("PREENCHA_")) {
    throw new Error("Configure o App ID do novo app Back4App no início do arquivo script.js.");
  }
  const response = await fetch(`${BACK4APP.SERVER_URL}/${path}`, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error || `Erro do Back4App (${response.status}). Confira as permissões da classe ${CLASS_NAME}.`);
  return result;
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(list, field) {
  const values = list.map((item) => parseNumber(item[field])).filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function displayPurpose(value) { return PURPOSE_LABELS[value] || value || "Não informado"; }
function displayProfile(value) { return value === "Student" ? "Estudantes" : "Profissionais"; }

function updatePurposeFilter() {
  const select = $("filtroFinalidade");
  const previous = select.value;
  select.innerHTML = '<option value="todos">Todas</option>';
  [...new Set(records.map((item) => item.AI_Purpose).filter(Boolean))].sort().forEach((purpose) => {
    const option = document.createElement("option");
    option.value = purpose;
    option.textContent = displayPurpose(purpose);
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
}

function getFilteredRecords() {
  const profile = $("filtroPerfil").value;
  const purpose = $("filtroFinalidade").value;
  return records.filter((item) => (profile === "todos" || item.User_Type === profile) && (purpose === "todos" || item.AI_Purpose === purpose));
}

function getHours(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).replace(",", ".");
  const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!numbers.length) return null;
  return text.includes("-") && numbers.length > 1 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
}

function updateIndicators(list) {
  const satisfaction = average(list, "Satisfaction_Score");
  const productivity = average(list, "Productivity_Score");
  $("valorSatisfacao").textContent = satisfaction.toFixed(1);
  $("valorProdutividade").textContent = productivity.toFixed(1);
  $("totalRespondentes").textContent = records.length.toLocaleString("pt-BR");
  $("totalFiltrado").textContent = `${list.length} registros neste filtro`;
}

function makeLegend(items, total) {
  const legend = $("legendaFerramentas");
  legend.replaceChildren();
  items.forEach((item, index) => {
    const row = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = "sw";
    swatch.style.background = COLORS[index % COLORS.length];
    const name = document.createElement("span");
    name.textContent = item.name;
    const percent = document.createElement("b");
    percent.textContent = `${total ? ((item.count / total) * 100).toFixed(1) : "0.0"}%`;
    row.append(swatch, name, percent);
    legend.appendChild(row);
  });
}

function makeChart(id, config) {
  if (charts[id]) charts[id].destroy();
  const canvas = $(id);
  charts[id] = new Chart(canvas, config);
}

function renderCharts(list) {
  if (typeof Chart === "undefined") {
    showStatus("Não foi possível carregar o Chart.js. Confira a conexão com a internet.", true);
    return;
  }
  Chart.defaults.font.family = "Nunito, Trebuchet MS, sans-serif";
  Chart.defaults.color = "#52665a";

  const toolCounts = {};
  list.forEach((item) => { if (item.AI_Tool) toolCounts[item.AI_Tool] = (toolCounts[item.AI_Tool] || 0) + 1; });
  const tools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  makeLegend(tools, list.length);
  makeChart("graficoFerramentas", {
    type: "doughnut",
    data: { labels: tools.map((item) => item.name), datasets: [{ data: tools.map((item) => item.count), backgroundColor: tools.map((_, index) => COLORS[index % COLORS.length]), borderWidth: 2, borderColor: "#ffffff" }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "66%", plugins: { legend: { display: false } } }
  });

  const purposes = [...new Set(list.map((item) => item.AI_Purpose).filter(Boolean))].sort();
  const productivityByPurpose = purposes.map((purpose) => average(list.filter((item) => item.AI_Purpose === purpose), "Productivity_Score"));
  makeChart("graficoProdutividade", {
    type: "bar",
    data: { labels: purposes.map(displayPurpose), datasets: [{ label: "Produtividade média", data: productivityByPurpose, backgroundColor: purposes.map((_, index) => COLORS[index % COLORS.length]), borderRadius: 4 }] },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, max: 10, title: { display: true, text: "Nota média (0 a 10)" } } }, plugins: { legend: { display: false } } }
  });

  const profiles = ["Student", "Professional"];
  const answers = ["Yes", "Maybe", "No"];
  const answerNames = { Yes: "Sim", Maybe: "Talvez", No: "Não" };
  const answerColors = { Yes: "#397b55", Maybe: "#d4a373", No: "#bd7777" };
  makeChart("graficoRecomendacao", {
    type: "bar",
    data: { labels: profiles.map(displayProfile), datasets: answers.map((answer) => ({ label: answerNames[answer], data: profiles.map((profile) => list.filter((item) => item.User_Type === profile && item.Would_Recommend === answer).length), backgroundColor: answerColors[answer] })) },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: "Número de respostas" } } } }
  });

  const comparisonLabels = ["Produtividade", "Satisfação", "Precisão", "Tempo economizado"];
  makeChart("graficoComparacao", {
    type: "bar",
    data: { labels: comparisonLabels, datasets: profiles.map((profile, index) => {
      const group = list.filter((item) => item.User_Type === profile);
      return { label: displayProfile(profile), data: [average(group, "Productivity_Score"), average(group, "Satisfaction_Score"), average(group, "Accuracy_Rating"), average(group, "Time_Saved_Hours_Per_Week")], backgroundColor: index === 0 ? "#397b55" : "#a6c8a8" };
    }) },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: "Média (notas e horas/semana)" } } } }
  });

  const ranges = [{ name: "Até 1h", min: 0, max: 1 }, { name: "1–2h", min: 1, max: 2 }, { name: "2–3h", min: 2, max: 3 }, { name: "3–4h", min: 3, max: 4 }, { name: "4h+", min: 4, max: Infinity }];
  const satisfactionByHours = ranges.map((range) => {
    const group = list.filter((item) => { const hours = getHours(item.AI_Usage_Hours_Per_Day); return hours !== null && hours >= range.min && hours < range.max; });
    return average(group, "Satisfaction_Score");
  });
  makeChart("graficoSatisfacao", {
    type: "line",
    data: { labels: ranges.map((range) => range.name), datasets: [{ label: "Satisfação média", data: satisfactionByHours, borderColor: "#397b55", backgroundColor: "rgba(57, 123, 85, 0.18)", fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: "#fff", pointBorderWidth: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 10, title: { display: true, text: "Satisfação média (0 a 10)" } }, x: { title: { display: true, text: "Horas de uso por dia" } } } }
  });
}

function renderTable(list) {
  const body = $("tabelaRegistros");
  body.replaceChildren();
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  currentPage = Math.min(currentPage, pageCount - 1);
  const visible = list.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  visible.forEach((record) => {
    const row = document.createElement("tr");
    const cells = [record.User_ID || "—", displayProfile(record.User_Type), record.AI_Tool || "—", displayPurpose(record.AI_Purpose), record.Productivity_Score ?? "—", record.Satisfaction_Score ?? "—"];
    cells.forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; row.appendChild(cell); });
    const actions = document.createElement("td");
    const actionGroup = document.createElement("div"); actionGroup.className = "row-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Editar"; edit.setAttribute("aria-label", `Editar ${record.User_ID}`); edit.addEventListener("click", () => openForm(record));
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Excluir"; remove.className = "delete-button"; remove.setAttribute("aria-label", `Excluir ${record.User_ID}`); remove.addEventListener("click", () => deleteRecord(record));
    actionGroup.append(edit, remove); actions.appendChild(actionGroup); row.appendChild(actions); body.appendChild(row);
  });
  $("estadoTabela").hidden = visible.length > 0;
  $("estadoTabela").textContent = list.length ? "" : "Nenhum registro encontrado. Importe o CSV ou adicione uma resposta.";
  $("paginaInfo").textContent = `Exibindo ${list.length ? currentPage * pageSize + 1 : 0}–${Math.min((currentPage + 1) * pageSize, list.length)} de ${list.length}`;
  $("paginaAnterior").disabled = currentPage === 0;
  $("paginaProxima").disabled = currentPage >= pageCount - 1;
}

function updateDashboard() {
  const filtered = getFilteredRecords();
  updateIndicators(filtered);
  renderCharts(filtered);
  renderTable(filtered);
}

async function loadRecords() {
  try {
    const result = await apiRequest(`classes/${CLASS_NAME}?limit=1000&order=User_ID`);
    records = result.results || [];
    updatePurposeFilter();
    updateDashboard();
    showStatus("");
  } catch (error) {
    $("totalRespondentes").textContent = "—";
    $("estadoTabela").textContent = error.message;
    $("estadoTabela").hidden = false;
    showStatus(error.message, true);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = (rows.shift() || []).map((header) => header.trim().replace(/^\uFEFF/, ""));
  return rows.filter((values) => values.some((value) => value.trim())).map((values) => {
    const item = Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()]));
    NUMERIC_FIELDS.forEach((field) => {
      if (item[field] === "") item[field] = null;
      else {
        const numeric = Number(item[field]);
        if (Number.isFinite(numeric)) item[field] = numeric;
        else { const found = item[field].match(/-?\d+(?:\.\d+)?/); item[field] = found ? Number(found[0]) : null; }
      }
    });
    item.ACL = { "*": { read: true, write: true } };
    return item;
  });
}

async function importCsv(file) {
  if (!file) return;
  try {
    const incoming = parseCsv(await file.text());
    const known = new Set(records.map((item) => item.User_ID));
    const fresh = incoming.filter((item) => item.User_ID && !known.has(item.User_ID) && known.add(item.User_ID));
    if (!fresh.length) { showStatus("Não há novos registros para importar."); return; }
    $("btnImportarCsv").disabled = true;
    showStatus(`Importando ${fresh.length} registros...`);
    for (let start = 0; start < fresh.length; start += 40) {
      const requests = fresh.slice(start, start + 40).map((item) => ({ method: "POST", path: `/classes/${CLASS_NAME}`, body: item }));
      const result = await apiRequest("batch", { method: "POST", body: JSON.stringify({ requests }) });
      const failed = result.find((item) => item.error);
      if (failed) throw new Error(failed.error.error || "Falha ao importar parte do CSV.");
    }
    await loadRecords();
    showStatus(`${fresh.length} registros importados.`);
  } catch (error) { showStatus(error.message, true); }
  finally { $("btnImportarCsv").disabled = false; $("arquivoCsv").value = ""; }
}

function addFormFields(record = {}) {
  const container = $("camposRegistro");
  container.replaceChildren();
  FIELDS.forEach(([key, label, type]) => {
    const wrapper = document.createElement("label");
    wrapper.className = `form-field${type === "textarea" ? " wide" : ""}`;
    const title = document.createElement("span"); title.textContent = label;
    let input;
    if (type === "select") {
      input = document.createElement("select");
      const options = key === "User_Type" ? [["Student", "Estudante"], ["Professional", "Profissional"]] : [["Yes", "Sim"], ["Maybe", "Talvez"], ["No", "Não"]];
      options.forEach(([value, text]) => { const option = document.createElement("option"); option.value = value; option.textContent = text; input.appendChild(option); });
    } else if (type === "textarea") { input = document.createElement("textarea"); input.rows = 3; }
    else { input = document.createElement("input"); input.type = type; if (type === "number") input.step = "any"; }
    input.name = key; input.value = record[key] ?? "";
    if (["User_ID", "User_Type", "AI_Tool", "AI_Purpose"].includes(key)) input.required = true;
    if (["Productivity_Score", "Accuracy_Rating", "Satisfaction_Score"].includes(key)) { input.min = "0"; input.max = "10"; }
    wrapper.append(title, input); container.appendChild(wrapper);
  });
}

function openForm(record = null) {
  editingObjectId = record ? record.objectId : null;
  $("tituloModal").textContent = record ? "Editar registro" : "Novo registro";
  $("salvarRegistro").textContent = record ? "Salvar alterações" : "Criar registro";
  $("erroFormulario").textContent = "";
  addFormFields(record || { User_Type: "Student", Would_Recommend: "Yes" });
  $("modalRegistro").hidden = false;
  $("camposRegistro").querySelector("input")?.focus();
}

function closeForm() { $("modalRegistro").hidden = true; editingObjectId = null; }

async function saveRecord(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  FIELDS.forEach(([key]) => { if (NUMERIC_FIELDS.has(key)) values[key] = values[key] === "" ? null : Number(values[key]); });
  values.ACL = { "*": { read: true, write: true } };
  const button = $("salvarRegistro"); button.disabled = true;
  try {
    const path = editingObjectId ? `classes/${CLASS_NAME}/${encodeURIComponent(editingObjectId)}` : `classes/${CLASS_NAME}`;
    await apiRequest(path, { method: editingObjectId ? "PUT" : "POST", body: JSON.stringify(values) });
    closeForm(); await loadRecords(); showStatus(editingObjectId ? "Registro atualizado." : "Registro criado.");
  } catch (error) { $("erroFormulario").textContent = error.message; }
  finally { button.disabled = false; }
}

async function deleteRecord(record) {
  if (!record.objectId || !confirm(`Excluir o registro ${record.User_ID}? Esta ação não pode ser desfeita.`)) return;
  try {
    await apiRequest(`classes/${CLASS_NAME}/${encodeURIComponent(record.objectId)}`, { method: "DELETE" });
    await loadRecords(); showStatus("Registro excluído.");
  } catch (error) { showStatus(error.message, true); }
}

$("filtroPerfil").addEventListener("change", () => { currentPage = 0; updateDashboard(); });
$("filtroFinalidade").addEventListener("change", () => { currentPage = 0; updateDashboard(); });
$("btnNovoRegistro").addEventListener("click", () => openForm());
$("btnImportarCsv").addEventListener("click", () => $("arquivoCsv").click());
$("arquivoCsv").addEventListener("change", (event) => importCsv(event.target.files[0]));
$("formRegistro").addEventListener("submit", saveRecord);
$("fecharModal").addEventListener("click", closeForm);
$("cancelarModal").addEventListener("click", closeForm);
$("modalRegistro").addEventListener("click", (event) => { if (event.target === $("modalRegistro")) closeForm(); });
$("paginaAnterior").addEventListener("click", () => { currentPage = Math.max(0, currentPage - 1); renderTable(getFilteredRecords()); });
$("paginaProxima").addEventListener("click", () => { currentPage++; renderTable(getFilteredRecords()); });

loadRecords();

// --- CONSUMO DE API PÚBLICA (Open-Meteo) COM NEXO NO PROJETO ---
async function carregarApiPublicaClima() {
  const containerClima = document.getElementById("infoClima");
  if (!containerClima) return;

  try {
    // Coordenadas de Recife/PE e parâmetros para clima atual
    const url = "https://api.open-meteo.com/v1/forecast?latitude=-8.0539&longitude=-34.8811&current=temperature_2m,relative_humidity_2m,weather_code";
    
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error("Erro ao acessar a API de clima");

    const dados = await resposta.json();
    const temp = dados.current.temperature_2m;
    const umidade = dados.current.relative_humidity_2m;
    
    // Descrição simples baseada no código do tempo da Open-Meteo
    const codigoClima = dados.current.weather_code;
    let condicao = "Condição estável";
    if (codigoClima === 0) condicao = "Céu limpo";
    else if (codigoClima >= 1 && codigoClima <= 3) condicao = "Parcialmente nublado";
    else if (codigoClima >= 51 && codigoClima <= 67) condicao = "Chuvoso";

    containerClima.textContent = `${temp}°C — ${condicao} (Umidade: ${umidade}%)`;
  } catch (erro) {
    console.error("Erro ao buscar dados da API pública:", erro);
    containerClima.textContent = "Dados meteorológicos indisponíveis";
  }
}

// Executa a chamada da API pública ao carregar o script
carregarApiPublicaClima();