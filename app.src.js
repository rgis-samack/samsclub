/**
 * ==============================================================================
 * SAM'S CLUB — GERADOR DE CRACHÁS DE INVENTÁRIO PRO (DESIGN APPLE & FLUENT 2)
 * Desenvolvido por: Felipe Samack (Samack D697)
 * Copyright (c) 2026 Felipe Samack. Todos os direitos reservados.
 * ==============================================================================
 */

const SUPABASE_URL = "https://euvhtrwbyxjezbwwwbxb.supabase.co";
const SUPABASE_KEY = "sb_publishable_C_hnCysx4ulNklCJv0UO9g_YFGMgyBv";

const supabaseClient = (typeof window.supabase !== "undefined")
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

let processedCrachas = [];
let currentPdfBlobUrl = null;
let isSamsBlocked = false;
let lastBlockMessage = "";
let initialTelemetriaEnviada = false;

document.addEventListener("DOMContentLoaded", () => {
    configurarDragAndDrop();
    configurarEventos();
    ativarProtecaoAntiCopia();
    verificarAcessoSupabase(true);

    // Heartbeat em tempo real a cada 15s contra o Supabase
    setInterval(() => {
        if (!isSamsBlocked) {
            verificarAcessoSupabase(false);
        }
    }, 15000);
});

// --- SEGURANÇA & ANTI-CÓPIA ---
function ativarProtecaoAntiCopia() {
    document.addEventListener("contextmenu", e => e.preventDefault());

    document.addEventListener("keydown", e => {
        const k = (e.key || "").toUpperCase();
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        if (
            k === "F12" ||
            (isCtrl && isShift && ["I", "J", "C"].includes(k)) ||
            (isCtrl && ["U", "S", "P"].includes(k))
        ) {
            e.preventDefault();
        }
    });

    document.addEventListener("dragstart", e => {
        if (e.target && (e.target.tagName === "IMG" || e.target.tagName === "A")) {
            e.preventDefault();
        }
    });

    setInterval(() => {
        const threshold = 160;
        const widthDiff = window.outerWidth - window.innerWidth > threshold;
        const heightDiff = window.outerHeight - window.innerHeight > threshold;
        if (widthDiff || heightDiff) {
            try {
                const trap = Function("debugger");
                trap();
            } catch (err) {}
        }
    }, 1500);
}

// --- TELEMETRIA & DETECÇÃO DE DISPOSITIVO ---
function obterInfoDispositivo() {
    const ua = navigator.userAgent || "";
    let osName = "Desconhecido";
    if (/Windows/i.test(ua)) osName = "Windows";
    else if (/Android/i.test(ua)) osName = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) osName = "iOS";
    else if (/Mac OS/i.test(ua)) osName = "macOS";
    else if (/Linux/i.test(ua)) osName = "Linux";

    const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    const screenW = window.screen.width;
    const screenH = window.screen.height;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let deviceType = "Desktop";
    if (/Mobi|Android|iPhone/i.test(ua) || (isTouch && vpW < 768)) {
        deviceType = "Mobile";
    } else if (/iPad|Tablet/i.test(ua) || (isTouch && vpW >= 768 && vpW <= 1024)) {
        deviceType = "Tablet";
    }

    return {
        osName,
        deviceType,
        isTouch,
        resolution: `${screenW}x${screenH}`,
        viewport: `${vpW}x${vpH}`,
        userAgent: ua
    };
}

async function verificarAcessoSupabase(mostrarAlerta = true) {
    try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 3500);

        const url = `${SUPABASE_URL}/rest/v1/controle_acesso?or=(app_name.eq.sams_club,app_name.eq.global)&select=*`;
        const res = await fetch(url, {
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`
            },
            signal: ctrl.signal
        });
        clearTimeout(timeoutId);

        let configBloqueio = null;

        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
                const samsRow = rows.find(r => r.app_name === "sams_club");
                const globalRow = rows.find(r => r.app_name === "global");

                if (samsRow && samsRow.sistema_ativo === false) {
                    configBloqueio = samsRow;
                } else if (globalRow && globalRow.sistema_ativo === false) {
                    configBloqueio = globalRow;
                }
            }
        }

        if (configBloqueio) {
            const motivo = configBloqueio.mensagem_bloqueio || "Acesso temporariamente bloqueado para manutenção da equipe Samack.";
            isSamsBlocked = true;
            lastBlockMessage = motivo;
            processedCrachas = [];

            if (mostrarAlerta) {
                try { alert("🔴 ACESSO SUSPENSO: " + motivo); } catch (e) {}
            }

            document.body.innerHTML = `
                <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0B0D14; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 2rem;">
                    <div style="width: 84px; height: 84px; border-radius: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <h1 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; color: #ffffff;">Acesso Temporariamente Suspenso</h1>
                    <p style="font-size: 1rem; color: #94a3b8; max-width: 460px; line-height: 1.6; margin-bottom: 1.5rem;">
                        ${motivo}
                    </p>
                    <div style="padding: 10px 18px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; font-family: monospace; font-size: 0.82rem; color: #fca5a5; margin-bottom: 2rem;">
                        STATUS: BLOQUEADO (KILL-SWITCH ATIVO NO SUPABASE)
                    </div>
                    <div style="font-size: 0.85rem; color: #64748b; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 1.5rem; max-width: 400px;">
                        Sam's Club • Inventário D697 • by Samack 697<br>
                        Contato: <a href="mailto:felipesamackofficial@gmail.com" style="color: #38bdf8; text-decoration: none;">felipesamackofficial@gmail.com</a>
                    </div>
                </div>
            `;

            // Telemetria de tentativa bloqueada
            obterGeolocalizacaoWeb().then(geo => {
                const info = obterInfoDispositivo();
                const hwid = "WEB-" + btoa(info.userAgent + info.resolution).substring(0, 16);

                fetch(`${SUPABASE_URL}/rest/v1/logs_acesso`, {
                    method: "POST",
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": `Bearer ${SUPABASE_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify([{
                        data_hora: new Date().toISOString(),
                        nome_pc: `${info.deviceType} (${info.osName})`,
                        usuario_win: `Disp: ${info.deviceType} [${info.resolution}]`,
                        os_info: info.userAgent.substring(0, 100),
                        hwid: hwid,
                        ip_publico: geo.ip || "Desconhecido",
                        cidade: geo.cidade || "Desconhecida",
                        estado: geo.estado || "—",
                        pais: geo.pais || "Brasil",
                        provedor: geo.provedor || "—",
                        status: "BLOQUEADO",
                        app_name: "sams_club",
                        acao: "Tentativa Bloqueada",
                        detalhes_geracao: `https://rgis-samack.github.io/samsclub/ | Viewport: ${info.viewport}`
                    }])
                }).catch(() => {});
            });

            return false;
        }

        isSamsBlocked = false;

        // Telemetria inicial de acesso liberado
        if (!initialTelemetriaEnviada) {
            initialTelemetriaEnviada = true;
            obterGeolocalizacaoWeb().then(geo => {
                const info = obterInfoDispositivo();
                const hwid = "WEB-" + btoa(info.userAgent + info.resolution).substring(0, 16);

                fetch(`${SUPABASE_URL}/rest/v1/logs_acesso`, {
                    method: "POST",
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": `Bearer ${SUPABASE_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify([{
                        data_hora: new Date().toISOString(),
                        nome_pc: `${info.deviceType} (${info.osName})`,
                        usuario_win: `Disp: ${info.deviceType} [${info.resolution}]`,
                        os_info: info.userAgent.substring(0, 100),
                        hwid: hwid,
                        ip_publico: geo.ip || "Desconhecido",
                        cidade: geo.cidade || "Desconhecida",
                        estado: geo.estado || "—",
                        pais: geo.pais || "Brasil",
                        provedor: geo.provedor || "—",
                        status: "LIBERADO",
                        app_name: "sams_club",
                        acao: "Acesso Sams Club Web",
                        detalhes_geracao: `https://rgis-samack.github.io/samsclub/ | Viewport: ${info.viewport}`
                    }])
                }).catch(() => {});
            });
        }

        return true;

    } catch (err) {
        console.warn("Aviso na verificação de acesso Sam's Club:", err);
        return true;
    }
}

async function obterGeolocalizacaoWeb() {
    const padrao = { ip: "Desconhecido", cidade: "Desconhecida", estado: "—", pais: "Brasil", provedor: "—" };
    try {
        const ctrl = new AbortController();
        const tId = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch("https://ipwho.is/", { signal: ctrl.signal });
        clearTimeout(tId);
        if (res.ok) {
            const d = await res.json();
            if (d && d.success !== false && d.ip) {
                return {
                    ip: d.ip,
                    cidade: d.city || padrao.cidade,
                    estado: d.region_code || padrao.estado,
                    pais: d.country || padrao.pais,
                    provedor: (d.connection && (d.connection.isp || d.connection.org)) || "—"
                };
            }
        }
    } catch (e) {}

    try {
        const res = await fetch("https://api.ipify.org?format=json");
        if (res.ok) {
            const d = await res.json();
            padrao.ip = d.ip || padrao.ip;
        }
    } catch (e) {}

    return padrao;
}

// --- DRAG & DROP & EVENTOS ---
function configurarDragAndDrop() {
    const overlay = document.getElementById("drag-overlay");
    window.addEventListener("dragover", e => {
        e.preventDefault();
        overlay.classList.add("active");
    });
    window.addEventListener("dragleave", e => {
        if (e.relatedTarget === null) {
            overlay.classList.remove("active");
        }
    });
    window.addEventListener("drop", e => {
        e.preventDefault();
        overlay.classList.remove("active");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processarArquivo(e.dataTransfer.files[0]);
        }
    });
}

function configurarEventos() {
    const btnSelect = document.getElementById("btn-file-select");
    const fileInput = document.getElementById("file-input");

    btnSelect?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", e => {
        if (e.target.files && e.target.files.length > 0) {
            processarArquivo(e.target.files[0]);
        }
    });

    document.getElementById("btn-gerar-duplo")?.addEventListener("click", () => gerarPdfWeb(true));
    document.getElementById("btn-gerar-unico")?.addEventListener("click", e => {
        if (typeof gerarPdfUnico === "function") {
            gerarPdfUnico(e);
        } else {
            gerarPdfWeb(false);
        }
    });

    document.getElementById("btn-abrir-pdf")?.addEventListener("click", () => {
        if (currentPdfBlobUrl) window.open(currentPdfBlobUrl, "_blank");
    });

    document.getElementById("btn-imprimir-pdf")?.addEventListener("click", () => {
        if (currentPdfBlobUrl) {
            const w = window.open(currentPdfBlobUrl, "_blank");
            if (w) {
                w.focus();
                w.print();
            }
        }
    });

    document.getElementById("input-inicio")?.addEventListener("input", atualizarListaFiltrada);
    document.getElementById("input-fim")?.addEventListener("input", atualizarListaFiltrada);

    // Modal de Termos de Uso & Licença Comercial
    const modalTermos = document.getElementById("modal-termos");
    const btnAbrirTermos = document.getElementById("btn-abrir-termos");
    const btnFecharTermos = document.getElementById("btn-fechar-termos");
    const btnEntendiTermos = document.getElementById("btn-entendi-termos");

    const abrirModal = () => {
        if (modalTermos) modalTermos.classList.add("active");
    };
    const fecharModal = () => {
        if (modalTermos) modalTermos.classList.remove("active");
    };

    btnAbrirTermos?.addEventListener("click", abrirModal);
    btnFecharTermos?.addEventListener("click", fecharModal);
    btnEntendiTermos?.addEventListener("click", fecharModal);

    modalTermos?.addEventListener("click", e => {
        if (e.target === modalTermos) fecharModal();
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && modalTermos?.classList.contains("active")) {
            fecharModal();
        }
    });
}

function processarArquivo(file) {
    if (isSamsBlocked) {
        alert("🔴 ACESSO SUSPENSO: " + (lastBlockMessage || "Aplicativo desativado pela administração."));
        return;
    }

    const reader = new FileReader();
    const isCsv = file.name.toLowerCase().endsWith(".csv");

    reader.onload = e => {
        try {
            let rows = [];
            if (isCsv) {
                const dec = new TextDecoder("utf-8");
                const text = dec.decode(e.target.result);
                rows = parseCsvText(text);
            } else {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
            }
            processarLinhasFormatadas(rows, file.name);
        } catch (err) {
            alert("Erro ao ler planilha: " + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function parseCsvText(csv) {
    const lines = csv.split(/\r\n|\n/);
    if (!lines.length) return [];
    const firstLine = lines[0];
    const sep = firstLine.includes(";") ? ";" : (firstLine.includes("\t") ? "\t" : ",");
    const result = [];
    for (let line of lines) {
        if (!line.trim()) continue;
        const row = line.split(sep).map(c => c.replace(/^["']|["']$/g, "").trim());
        result.push(row);
    }
    return result;
}

function normStr(s) {
    return s === null || s === undefined ? "" : String(s).trim().toLowerCase();
}

function normTag(tag) {
    if (!tag) return "";
    const str = String(tag).trim();
    const num = parseInt(str, 10);
    return !isNaN(num) ? String(num) : str.toLowerCase();
}

function fmtNum(n) {
    if (!n && n !== 0) return "";
    const str = String(n).trim();
    const num = parseInt(str, 10);
    return !isNaN(num) ? String(num) : str;
}

function processarLinhasFormatadas(rows, filename) {
    if (!rows || rows.length < 2) {
        alert("Planilha vazia ou formato inválido.");
        return;
    }

    const headers = rows[0].map(h => normStr(h));
    const colMapKeys = {
        tag: ["area", "área", "tag"],
        nome: ["nome do contato", "nomecontador", "nome_contador", "nome"],
        codigo: ["codigo interno", "código interno", "codinterno", "cod_interno", "codigo", "código", "codbarras", "cod", "sku"],
        descricao: ["descricao", "descrição", "desc", "produto"],
        quantidade: ["qtd", "quantidade", "quant"]
    };

    const colIndices = {};
    for (let key in colMapKeys) {
        let idx = -1;
        for (let alias of colMapKeys[key]) {
            idx = headers.findIndex(h => h.includes(alias));
            if (idx !== -1) break;
        }
        colIndices[key] = idx;
    }

    if (colIndices.tag === -1) colIndices.tag = 0;
    if (colIndices.nome === -1) colIndices.nome = 1;
    if (colIndices.codigo === -1) colIndices.codigo = 2;
    if (colIndices.descricao === -1) colIndices.descricao = 3;
    if (colIndices.quantidade === -1) colIndices.quantidade = 4;

    const dataRows = rows.slice(1).filter(r => r && r.length > 0 && r[colIndices.tag] !== "");

    dataRows.sort((a, b) => {
        const aTag = String(a[colIndices.tag] || "").trim();
        const bTag = String(b[colIndices.tag] || "").trim();
        const aNum = parseInt(aTag, 10);
        const bNum = parseInt(bTag, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return aTag.localeCompare(bTag);
    });

    processedCrachas = [];
    let i = 0;
    const total = dataRows.length;

    while (i < total) {
        const row1 = dataRows[i];
        const tag1 = String(row1[colIndices.tag] || "").trim();
        if (!tag1) {
            i++;
            continue;
        }

        const tagNorm1 = normTag(tag1);
        const nome1 = String(row1[colIndices.nome] || "AUXILIAR").trim();
        const p1 = {
            codigo: String(row1[colIndices.codigo] || "").trim(),
            descricao: String(row1[colIndices.descricao] || "").trim(),
            quantidade: String(row1[colIndices.quantidade] || "").trim()
        };

        if (i + 1 < total) {
            const row2 = dataRows[i + 1];
            const tag2 = String(row2[colIndices.tag] || "").trim();
            const tagNorm2 = normTag(tag2);

            if (tagNorm1 === tagNorm2) {
                const p2 = {
                    codigo: String(row2[colIndices.codigo] || "").trim(),
                    descricao: String(row2[colIndices.descricao] || "").trim(),
                    quantidade: String(row2[colIndices.quantidade] || "").trim()
                };
                processedCrachas.push({ tag: tag1, nome: nome1, produtos: [p1, p2] });
                i += 2;
                continue;
            }
        }

        processedCrachas.push({ tag: tag1, nome: nome1, produtos: [p1] });
        i += 1;
    }

    const statusEl = document.getElementById("status-text");
    if (statusEl) {
        statusEl.textContent = `${processedCrachas.length} crachá(s) carregado(s) com sucesso (${filename})`;
        statusEl.style.color = "var(--green-accent)";
        statusEl.style.fontWeight = "600";
    }

    atualizarListaFiltrada();
}

function atualizarListaFiltrada() {
    const iniVal = document.getElementById("input-inicio").value.trim();
    const fimVal = document.getElementById("input-fim").value.trim();

    let filtered = processedCrachas;
    if (iniVal || fimVal) {
        const minArea = iniVal ? parseInt(iniVal, 10) : 0;
        const maxArea = fimVal ? parseInt(fimVal, 10) : 999999;
        filtered = processedCrachas.filter(item => {
            const num = parseInt(item.tag, 10);
            if (!isNaN(num)) return num >= minArea && num <= maxArea;
            return true;
        });
    }

    const emptyContainer = document.getElementById("empty-state-container");
    const tableElement = document.getElementById("data-table");
    const tableBody = document.getElementById("table-body");

    if (filtered && filtered.length > 0) {
        if (emptyContainer) emptyContainer.style.display = "none";
        if (tableElement) tableElement.style.display = "table";
    } else {
        if (emptyContainer) {
            emptyContainer.style.display = "flex";
            const titleEl = emptyContainer.querySelector(".empty-hero-title");
            const subEl = emptyContainer.querySelector(".empty-hero-subtitle");
            if (processedCrachas && processedCrachas.length > 0) {
                if (titleEl) titleEl.textContent = "NENHUMA ÁREA ENCONTRADA";
                if (subEl) subEl.textContent = "Ajuste os filtros de Área Inicial ou Final para exibir os registros.";
            } else {
                if (titleEl) titleEl.textContent = "FAÇA O UPLOAD DO ARQUIVO CONSOLIDADO";
                if (subEl) subEl.textContent = "Importe a planilha para visualizar a listagem organizada e gerar os crachás oficiais.";
            }
        }
        if (tableElement) tableElement.style.display = "none";
    }

    if (tableBody) {
        tableBody.innerHTML = "";
        let totalItens = 0;
        const uniqueAreas = new Set();

        const fragment = document.createDocumentFragment();
        filtered.forEach(item => {
            uniqueAreas.add(item.tag);
            item.produtos.forEach(prod => {
                totalItens++;
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="center font-mono font-semibold">${item.tag}</td>
                    <td>${item.nome}</td>
                    <td class="center font-mono font-semibold text-accent">${prod.codigo}</td>
                    <td>${prod.descricao}</td>
                    <td class="center font-mono font-semibold">${prod.quantidade}</td>
                `;
                fragment.appendChild(tr);
            });
        });
        tableBody.appendChild(fragment);

        const pagsDuplo = Math.ceil(filtered.length);

        const valItens = document.getElementById("val-total-itens");
        const valAreas = document.getElementById("val-total-areas");
        const valDuplo = document.getElementById("val-pags-duplo");

        if (valItens) valItens.textContent = `${totalItens.toLocaleString("pt-BR")} itens`;
        if (valAreas) valAreas.textContent = `${uniqueAreas.size} Áreas`;
        if (valDuplo) valDuplo.textContent = `${pagsDuplo} págs A4`;
    }
}

function drawAutoFitTextJS(doc, text, fontStyle, maxFontSize, minFontSize, maxWidth, x, y, align = "left") {
    if (!text && text !== 0) return;
    const str = String(text).trim();
    if (!str) return;

    let fontSize = maxFontSize;
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);

    while (fontSize > minFontSize) {
        if (doc.getTextWidth(str) <= maxWidth) break;
        fontSize -= 0.5;
        doc.setFontSize(fontSize);
    }
    doc.text(str, x, y, { align: align });
}

function gerarPdfWeb(duplo = true) {
    if (isSamsBlocked) {
        alert("🔴 ACESSO SUSPENSO: " + (lastBlockMessage || "Aplicativo desativado pela administração."));
        return;
    }

    if (!processedCrachas || processedCrachas.length === 0) {
        alert("Carregue uma planilha antes de gerar o PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    const iniVal = document.getElementById("input-inicio").value.trim();
    const fimVal = document.getElementById("input-fim").value.trim();

    let filtered = processedCrachas;
    if (iniVal || fimVal) {
        const minArea = iniVal ? parseInt(iniVal, 10) : 0;
        const maxArea = fimVal ? parseInt(fimVal, 10) : 999999;
        filtered = processedCrachas.filter(item => {
            const num = parseInt(item.tag, 10);
            if (!isNaN(num)) return num >= minArea && num <= maxArea;
            return true;
        });
    }

    if (filtered.length === 0) {
        alert("Nenhum crachá encontrado dentro do filtro de área informado.");
        return;
    }

    for (let i = 0; i < filtered.length; i++) {
        if (i > 0) doc.addPage();
        const isFirstOrLast = (i === 0 || i === filtered.length - 1 || Math.random() < 0.25);
        desenharCrachaExato(doc, filtered[i], isFirstOrLast);
    }

    const blob = doc.output("blob");
    currentPdfBlobUrl = URL.createObjectURL(blob);

    const btnAbrir = document.getElementById("btn-abrir-pdf");
    const btnImprimir = document.getElementById("btn-imprimir-pdf");
    if (btnAbrir) btnAbrir.disabled = false;
    if (btnImprimir) btnImprimir.disabled = false;

    window.open(currentPdfBlobUrl, "_blank");

    // Registro de geração no Supabase
    if (supabaseClient) {
        try {
            const info = obterInfoDispositivo();
            obterGeolocalizacaoWeb().then(geo => {
                const hwid = "WEB-" + btoa(info.userAgent + info.resolution).substring(0, 16);
                supabaseClient.from("logs_acesso").insert([{
                    data_hora: new Date().toISOString(),
                    nome_pc: `${info.deviceType} (${info.osName})`,
                    usuario_win: `Disp: ${info.deviceType} [${info.resolution}]`,
                    os_info: info.userAgent.substring(0, 100),
                    hwid: hwid,
                    ip_publico: geo.ip || "Desconhecido",
                    cidade: geo.cidade || "Desconhecida",
                    estado: geo.estado || "—",
                    pais: geo.pais || "Brasil",
                    provedor: geo.provedor || "—",
                    status: "LIBERADO",
                    app_name: "sams_club",
                    acao: "Geração Crachás Duplos",
                    detalhes_geracao: `Gerados ${filtered.length} crachás duplos | Viewport: ${info.viewport}`
                }]).then(() => {});
            });
        } catch (e) {}
    }
}

function desenharCrachaExato(doc, item, isFirstOrLast = false) {
    const margin_x = 38.3;
    const page_w = 543.4;
    const w = page_w - margin_x;

    // Assinatura discreta superior "by Samack 697"
    if (isFirstOrLast) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(0, 45, 98); // Azul Sam's Club (#002d62)
        doc.text("by Samack 697", margin_x, 32);
    }

    doc.setLineWidth(1.5);
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);
    doc.rect(margin_x, 56.2, w, 720.6);

    const lines = [130.4, 189.2, 291.6, 321.3, 438.2, 482.5, 584.9, 614.6, 731.5];
    doc.setLineWidth(1);
    lines.forEach(ly => {
        doc.line(margin_x, ly, page_w, ly);
    });

    // TAG
    doc.setFont("helvetica", "bold");
    doc.setFontSize(52);
    doc.text("TAG", margin_x + 206, 115);
    drawAutoFitTextJS(doc, fmtNum(item.tag), "bold", 48, 20, 160, page_w - 24, 112, "right");

    // NOME
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.text("NOME:", margin_x + 4, 175);
    drawAutoFitTextJS(doc, item.nome, "normal", 28, 12, page_w - (margin_x + 175), margin_x + 171, 172, "left");

    const prods = item.produtos || [];
    const p1 = prods[0] || { codigo: "0", descricao: "0", quantidade: "0" };
    const p2 = prods[1] || null;

    // --- PRODUTO 1 ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("DESCRIÇÃO", margin_x + w / 2, 215, { align: "center" });
    drawAutoFitTextJS(doc, p1.descricao, "bold", 28, 10, w - 28, margin_x + w / 2, 262, "center");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(26);
    doc.text("PRODUTO", margin_x + 30, 315);
    doc.text("QUANTIDADE", page_w - 12, 315, { align: "right" });

    drawAutoFitTextJS(doc, fmtNum(p1.codigo), "bold", 62, 20, 250, margin_x + 73, 395, "left");
    drawAutoFitTextJS(doc, fmtNum(p1.quantidade), "bold", 48, 16, 140, page_w - 50, 395, "right");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("VALIDADE", margin_x + 34, 468);
    drawAutoFitTextJS(doc, "______/__________/___________", "normal", 24, 12, page_w - (margin_x + 165) - 6, margin_x + 165, 468, "left");

    // --- PRODUTO 2 ---
    const desc2 = p2 ? String(p2.descricao).trim() : "0";
    const cod2 = p2 ? fmtNum(p2.codigo) : "0";
    const qtd2 = p2 ? fmtNum(p2.quantidade) : "0";

    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("DESCRIÇÃO", margin_x + w / 2, 508, { align: "center" });
    drawAutoFitTextJS(doc, desc2, "bold", 28, 10, w - 28, margin_x + w / 2, 555, "center");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(26);
    doc.text("PRODUTO", margin_x + 30, 608);
    doc.text("QUANTIDADE", page_w - 12, 608, { align: "right" });

    const xCod2 = cod2 !== "0" ? margin_x + 73 : margin_x + 152;
    drawAutoFitTextJS(doc, cod2, "bold", 62, 20, 250, xCod2, 688, "left");
    drawAutoFitTextJS(doc, qtd2, "bold", 48, 16, 140, page_w - 50, 688, "right");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("VALIDADE", margin_x + 34, 761);
    drawAutoFitTextJS(doc, "______/__________/___________", "normal", 24, 12, page_w - (margin_x + 165) - 6, margin_x + 165, 761, "left");
}
