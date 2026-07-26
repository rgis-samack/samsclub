/* ===============================================================================
   SAM'S CLUB INVENTORY SYSTEM — GITHUB PAGES JAVASCRIPT ENGINE
   by Samack 697 | RGIS 2026 (Réplica 100% Exata do Programa .exe / crachas_core.py)
=============================================================================== */

const SUPABASE_URL = "https://euvhtrwbyxjezbwwwbxb.supabase.co";
const SUPABASE_KEY = "sb_publishable_C_hnCysx4ulNklCJv0UO9g_YFGMgyBv";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Estado da Aplicação
let processedCrachas = [];
let currentPdfBlobUrl = null;

// 1. Inicialização do App com Proteção Anti-Inspeção
document.addEventListener("DOMContentLoaded", () => {
    configurarDragAndDrop();
    configurarEventos();
    verificarAcessoSupabase();
    ativarProtecaoAntiCopia();
});

function ativarProtecaoAntiCopia() {
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("keydown", (e) => {
        if (e.key === "F12" || 
            (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) || 
            (e.ctrlKey && e.key.toUpperCase() === "U")) {
            e.preventDefault();
        }
    });
}

// 2. Trava Remota & Telemetria no Supabase
async function verificarAcessoSupabase() {
    if (!supabaseClient) return;

    try {
        const { data: ctrlData } = await supabaseClient
            .from("controle_acesso")
            .select("*")
            .eq("id", 1)
            .single();

        if (ctrlData && ctrlData.sistema_ativo === false) {
            alert(`🔴 ACESSO SUSPENSO: ${ctrlData.mensagem_bloqueio || 'Aplicativo desativado pela administração (Samack 697).'}`);
            document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; background:#0A0F1D; color:#FF3366; font-family:sans-serif; font-size:1.5rem; text-align:center; padding:20px;">
                🔴 ACESSO SUSPENSO<br><br><span style="font-size:1.1rem; color:white;">${ctrlData.mensagem_bloqueio || 'Aplicativo desativado pela administração (Samack 697).'}</span>
            </div>`;
            return;
        }

        fetch("https://ip-api.com/json/?fields=query,city,regionName,country,isp")
            .then(res => res.json())
            .then(geo => {
                const hwidWeb = "WEB-" + btoa(navigator.userAgent + screen.width + screen.height).substring(0, 16);
                supabaseClient.from("logs_acesso").insert([{
                    data_hora: new Date().toISOString(),
                    nome_pc: "Navegador Web (" + (navigator.platform || "Web") + ")",
                    usuario_win: "Usuário Web",
                    os_info: navigator.userAgent.substring(0, 60),
                    hwid: hwidWeb,
                    ip_publico: geo.query || "Desconhecido",
                    cidade: geo.city || "Desconhecida",
                    estado: geo.regionName || "—",
                    pais: geo.country || "Brasil",
                    provedor: geo.isp || "—",
                    status: "LIBERADO"
                }]).then(() => {});
            }).catch(() => {});

    } catch (e) {
        console.warn("Aviso Supabase:", e);
    }
}

// 3. Suporte a Drag & Drop em Toda a Tela
function configurarDragAndDrop() {
    const overlay = document.getElementById("drag-overlay");

    window.addEventListener("dragover", (e) => {
        e.preventDefault();
        overlay.classList.add("drag-active");
    });

    window.addEventListener("dragleave", (e) => {
        if (e.relatedTarget === null) {
            overlay.classList.remove("drag-active");
        }
    });

    window.addEventListener("drop", (e) => {
        e.preventDefault();
        overlay.classList.remove("drag-active");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processarArquivo(e.dataTransfer.files[0]);
        }
    });
}

// 4. Configuração dos Eventos dos Botões
function configurarEventos() {
    const btnSelect = document.getElementById("btn-file-select");
    const fileInput = document.getElementById("file-input");

    btnSelect.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            processarArquivo(e.target.files[0]);
        }
    });

    document.getElementById("btn-gerar-duplo").addEventListener("click", () => gerarPdfWeb(true));
    document.getElementById("btn-gerar-unico").addEventListener("click", () => gerarPdfWeb(false));

    document.getElementById("btn-abrir-pdf").addEventListener("click", () => {
        if (currentPdfBlobUrl) window.open(currentPdfBlobUrl, "_blank");
    });

    document.getElementById("btn-imprimir-pdf").addEventListener("click", () => {
        if (currentPdfBlobUrl) {
            const printWin = window.open(currentPdfBlobUrl, "_blank");
            if (printWin) {
                printWin.focus();
                printWin.print();
            }
        }
    });

    document.getElementById("input-inicio").addEventListener("input", atualizarListaFiltrada);
    document.getElementById("input-fim").addEventListener("input", atualizarListaFiltrada);
}

// 5. Leitura e Parse de Planilha Exatamente Igual ao crachas_core.py
function processarArquivo(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

            processarLinhasFormatadas(jsonRows, file.name);
        } catch (err) {
            alert("Erro ao ler planilha: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function normStr(s) {
    return s === null || s === undefined ? "" : String(s).trim().toLowerCase();
}

function normTag(s) {
    if (!s) return "";
    const st = String(s).trim();
    const num = parseInt(st, 10);
    return !isNaN(num) ? String(num) : st.toLowerCase();
}

function fmtNum(val) {
    if (!val && val !== 0) return "";
    const st = String(val).trim();
    const num = parseInt(st, 10);
    return !isNaN(num) ? String(num) : st;
}

function processarLinhasFormatadas(rows, fileName) {
    if (!rows || rows.length < 2) {
        alert("Planilha vazia ou formato inválido.");
        return;
    }

    const headers = rows[0].map(h => normStr(h));
    
    // Mapeamento de colunas igual ao COLUMN_ALIASES de crachas_core.py
    const aliases = {
        tag: ["area", "área", "tag"],
        nome: ["nome do contato", "nomecontador", "nome_contador", "nome"],
        codigo: ["codigo interno", "código interno", "codinterno", "cod_interno", "codigo", "código", "codbarras", "cod"],
        descricao: ["descricao", "descrição", "desc"],
        quantidade: ["qtd", "quantidade"]
    };

    const mapping = {};
    for (let key in aliases) {
        let foundIdx = -1;
        for (let alias of aliases[key]) {
            foundIdx = headers.findIndex(h => h.includes(alias));
            if (foundIdx !== -1) break;
        }
        mapping[key] = foundIdx;
    }

    if (mapping.tag === -1) mapping.tag = 0;
    if (mapping.nome === -1) mapping.nome = 1;
    if (mapping.codigo === -1) mapping.codigo = 2;
    if (mapping.descricao === -1) mapping.descricao = 3;
    if (mapping.quantidade === -1) mapping.quantidade = 4;

    const dataRows = rows.slice(1).filter(r => r && r.length > 0);

    // Ordena sequencialmente por TAG / Área antes de agrupar (exatamente como crachas_core.py)
    dataRows.sort((rA, rB) => {
        const tagA = String(rA[mapping.tag] || "").trim();
        const tagB = String(rB[mapping.tag] || "").trim();
        const numA = parseInt(tagA, 10);
        const numB = parseInt(tagB, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return tagA.localeCompare(tagB);
    });

    // Converte linhas em objetos Cracha (agrupando até 2 produtos por TAG)
    processedCrachas = [];
    let i = 0;
    const n = dataRows.length;

    while (i < n) {
        const r1 = dataRows[i];
        const tag1Raw = String(r1[mapping.tag] || "").trim();
        if (!tag1Raw) { i++; continue; }

        const tag1 = normTag(tag1Raw);
        const nome1 = String(r1[mapping.nome] || "AUXILIAR").trim();
        const p1 = {
            codigo: String(r1[mapping.codigo] || "").trim(),
            descricao: String(r1[mapping.descricao] || "").trim(),
            quantidade: String(r1[mapping.quantidade] || "").trim()
        };

        if (i + 1 < n) {
            const r2 = dataRows[i + 1];
            const tag2Raw = String(r2[mapping.tag] || "").trim();
            const tag2 = normTag(tag2Raw);

            if (tag1 === tag2) {
                const p2 = {
                    codigo: String(r2[mapping.codigo] || "").trim(),
                    descricao: String(r2[mapping.descricao] || "").trim(),
                    quantidade: String(r2[mapping.quantidade] || "").trim()
                };
                processedCrachas.push({ tag: tag1Raw, nome: nome1, produtos: [p1, p2] });
                i += 2;
                continue;
            }
        }

        processedCrachas.push({ tag: tag1Raw, nome: nome1, produtos: [p1] });
        i += 1;
    }

    document.getElementById("status-text").innerText = `✅ ${processedCrachas.length} crachá(s) carregado(s) a partir de: ${fileName}`;
    document.getElementById("status-text").style.color = "var(--green-primary)";
    document.getElementById("status-text").style.fontWeight = "bold";

    atualizarListaFiltrada();
}

function atualizarListaFiltrada() {
    const inicio = document.getElementById("input-inicio").value.trim();
    const fim = document.getElementById("input-fim").value.trim();

    let filtrados = processedCrachas;
    if (inicio || fim) {
        const numIni = inicio ? parseInt(inicio, 10) : 0;
        const numFim = fim ? parseInt(fim, 10) : 999999;

        filtrados = processedCrachas.filter(c => {
            const numTag = parseInt(c.tag, 10);
            if (!isNaN(numTag)) return numTag >= numIni && numTag <= numFim;
            return true;
        });
    }

    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    let totalProdutos = 0;
    const areasSet = new Set();

    filtrados.forEach(c => {
        areasSet.add(c.tag);
        c.produtos.forEach(p => {
            totalProdutos++;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="center"><b>${c.tag}</b></td>
                <td>${c.nome}</td>
                <td class="center">${p.codigo}</td>
                <td>${p.descricao}</td>
                <td class="center">${p.quantidade}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    const pagsDuplo = Math.ceil(filtrados.length);
    const pagsUnico = filtrados.length;

    document.getElementById("val-total-itens").innerText = totalProdutos.toLocaleString("pt-BR") + " itens";
    document.getElementById("val-total-areas").innerText = areasSet.size + " Áreas";
    document.getElementById("val-pags-duplo").innerText = pagsDuplo + " págs A4";
    document.getElementById("val-pags-unico").innerText = pagsUnico + " págs A4";
}

// 6. Gerador Vetorial PDF no Navegador — RÉPLICA 100% EXATA de _desenhar_cracha_padrao em crachas_core.py
function gerarPdfWeb(modoDuplo = true) {
    if (!processedCrachas || processedCrachas.length === 0) {
        alert("Carregue uma planilha antes de gerar o PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    const inicio = document.getElementById("input-inicio").value.trim();
    const fim = document.getElementById("input-fim").value.trim();

    let listToRender = processedCrachas;
    if (inicio || fim) {
        const numIni = inicio ? parseInt(inicio, 10) : 0;
        const numFim = fim ? parseInt(fim, 10) : 999999;
        listToRender = processedCrachas.filter(c => {
            const numTag = parseInt(c.tag, 10);
            if (!isNaN(numTag)) return numTag >= numIni && numTag <= numFim;
            return true;
        });
    }

    if (listToRender.length === 0) {
        alert("Nenhum crachá encontrado dentro do filtro de área informado.");
        return;
    }

    for (let i = 0; i < listToRender.length; i++) {
        if (i > 0) doc.addPage();
        desenharCrachaExato(doc, listToRender[i], i === 0);
    }

    const blob = doc.output("blob");
    currentPdfBlobUrl = URL.createObjectURL(blob);

    document.getElementById("btn-abrir-pdf").disabled = false;
    document.getElementById("btn-imprimir-pdf").disabled = false;

    window.open(currentPdfBlobUrl, "_blank");
}

// Helper Auto-Fit de Texto em jsPDF (mede string e reduz fonte até caber)
function drawAutoFitTextJS(doc, text, fontStyle, maxFontSize, minFontSize, maxWidth, x, y, align = "left") {
    if (!text && text !== 0) return;
    const textStr = String(text).trim();
    if (!textStr) return;

    let size = maxFontSize;
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(size);

    while (size > minFontSize) {
        if (doc.getTextWidth(textStr) <= maxWidth) break;
        size -= 0.5;
        doc.setFontSize(size);
    }

    doc.text(textStr, x, y, { align: align });
}

// Desenha 1 Crachá idêntico a _desenhar_cracha_padrao em crachas_core.py
function desenharCrachaExato(doc, cracha, isFirstPage = false) {
    const X_LEFT = 38.3;
    const X_RIGHT = 543.4;
    const W = X_RIGHT - X_LEFT; // 505.1 pt

    // 1. Crédito "by Samack 697" no topo da 1ª página
    if (isFirstPage) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 45, 98); // Azul Sam's Club #002D62
        doc.text("by Samack 697", X_LEFT, 32);
    }

    doc.setLineWidth(1.5);
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    // 2. Borda Externa do Cartão (X_LEFT = 38.3, Y_TOP = 56.2, W = 505.1, H = 720.6)
    doc.rect(X_LEFT, 56.2, W, 720.6);

    // Linhas Horizontais Divisórias Exatas
    const hlines = [130.4, 189.2, 291.6, 321.3, 438.2, 482.5, 584.9, 614.6, 731.5];
    doc.setLineWidth(1);
    hlines.forEach(yVal => {
        doc.line(X_LEFT, yVal, X_RIGHT, yVal);
    });

    // --- ROW 1: TAG ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(52);
    doc.text("TAG", X_LEFT + 206, 115);
    drawAutoFitTextJS(doc, fmtNum(cracha.tag), "bold", 48, 20, 160, X_RIGHT - 24, 112, "right");

    // --- ROW 2: NOME ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.text("NOME:", X_LEFT + 4, 175);
    drawAutoFitTextJS(doc, cracha.nome, "normal", 28, 12, X_RIGHT - (X_LEFT + 175), X_LEFT + 171, 172, "left");

    // Produtos do crachá (máximo 2 produtos)
    const prods = cracha.produtos || [];
    const prod1 = prods[0] || { codigo: "0", descricao: "0", quantidade: "0" };
    const prod2 = prods[1] || null;

    // --- ITEM 1 ---
    // Descrição Header 1
    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("DESCRIÇÃO", X_LEFT + W / 2, 215, { align: "center" });

    // Descrição Value 1 (Auto-fit)
    drawAutoFitTextJS(doc, prod1.descricao, "bold", 28, 10, W - 28, X_LEFT + W / 2, 262, "center");

    // Produto / Quantidade Header 1
    doc.setFont("helvetica", "normal");
    doc.setFontSize(26);
    doc.text("PRODUTO", X_LEFT + 30, 315);
    doc.text("QUANTIDADE", X_RIGHT - 12, 315, { align: "right" });

    // Produto / Quantidade Values 1
    drawAutoFitTextJS(doc, fmtNum(prod1.codigo), "bold", 62, 20, 250, X_LEFT + 73, 395, "left");
    drawAutoFitTextJS(doc, fmtNum(prod1.quantidade), "bold", 48, 16, 140, X_RIGHT - 50, 395, "right");

    // Validade 1
    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("VALIDADE", X_LEFT + 34, 468);
    drawAutoFitTextJS(doc, "______/__________/___________", "normal", 24, 12, X_RIGHT - (X_LEFT + 165) - 6, X_LEFT + 165, 468, "left");

    // --- ITEM 2 ---
    const p2_desc = prod2 ? String(prod2.descricao).trim() : "0";
    const p2_cod = prod2 ? fmtNum(prod2.codigo) : "0";
    const p2_qtd = prod2 ? fmtNum(prod2.quantidade) : "0";

    // Descrição Header 2
    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("DESCRIÇÃO", X_LEFT + W / 2, 508, { align: "center" });

    // Descrição Value 2 (Auto-fit)
    drawAutoFitTextJS(doc, p2_desc, "bold", 28, 10, W - 28, X_LEFT + W / 2, 555, "center");

    // Produto / Quantidade Header 2
    doc.setFont("helvetica", "normal");
    doc.setFontSize(26);
    doc.text("PRODUTO", X_LEFT + 30, 608);
    doc.text("QUANTIDADE", X_RIGHT - 12, 608, { align: "right" });

    // Produto / Quantidade Values 2
    const x_cod2 = (p2_cod !== "0") ? (X_LEFT + 73) : (X_LEFT + 152);
    drawAutoFitTextJS(doc, p2_cod, "bold", 62, 20, 250, x_cod2, 688, "left");
    drawAutoFitTextJS(doc, p2_qtd, "bold", 48, 16, 140, X_RIGHT - 50, 688, "right");

    // Validade 2
    doc.setFont("helvetica", "normal");
    doc.setFontSize(24);
    doc.text("VALIDADE", X_LEFT + 34, 761);
    drawAutoFitTextJS(doc, "______/__________/___________", "normal", 24, 12, X_RIGHT - (X_LEFT + 165) - 6, X_LEFT + 165, 761, "left");
}
